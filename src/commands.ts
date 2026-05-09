import path from 'path';
import vscode from 'vscode';

import {
  FORMAT_LABELS,
  FORMAT_OPTIONS,
  IMGBYTESIZER_INSTALL_URL,
  SUPPORTED_IMAGE_EXTENSIONS,
  TARGET_SIZE_PRESETS,
} from './constants';
import * as utils from './utils';

/**
 * Command handler for simple image resizing
 */
export async function resizeImage(uri?: vscode.Uri): Promise<void> {
  try {
    const imagePath = await validateImageAndGetPath(uri);
    if (!imagePath) return;

    const targetSize = await showTargetSizeQuickPick();
    if (!targetSize) return;

    const defaults = utils.getDefaultOptions();
    const format = defaults.format === 'same' ? undefined : defaults.format;

    const options: utils.ImgByteOptions = {
      exactSize: defaults.exactSize,
      format,
      minDimension: defaults.minDimension === 0 ? undefined : defaults.minDimension,
      outputPath: utils.getDefaultOutputPath(imagePath, format),
      targetSize,
    };

    await processImageResize(imagePath, options);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error resizing image: ${errorMsg}`);
  }
}

/**
 * Command handler for advanced image resizing with all options
 */
export async function resizeImageWithOptions(uri?: vscode.Uri): Promise<void> {
  try {
    const imagePath = await validateImageAndGetPath(uri);
    if (!imagePath) return;

    const options = await getUserOptions(imagePath, path.extname(imagePath));
    if (!options) return;

    await processImageResize(imagePath, options);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error resizing image: ${errorMsg}`);
  }
}

/**
 * Validates the image file and returns its path
 */
export async function validateImageAndGetPath(uri?: vscode.Uri): Promise<string | undefined> {
  const isInstalled = await utils.checkImgbytesizerInstalled();
  if (!isInstalled) {
    vscode.window.showErrorMessage(
      `ImgByteSizer is not installed. Please install it first. ${IMGBYTESIZER_INSTALL_URL}`
    );
    return undefined;
  }

  const imagePath = resolveImagePath(uri);
  if (!imagePath) {
    vscode.window.showErrorMessage('Please select an image file in the explorer or editor.');
    return undefined;
  }

  const ext = path.extname(imagePath).toLowerCase() as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];
  if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    vscode.window.showErrorMessage(
      `Selected file is not a supported image (${SUPPORTED_IMAGE_EXTENSIONS.map((e) => e.slice(1)).join(', ')}).`
    );
    return undefined;
  }

  return imagePath;
}

function resolveImagePath(uri?: vscode.Uri): string | undefined {
  if (uri) return uri.fsPath;
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.uri.scheme === 'file') {
    return activeEditor.document.uri.fsPath;
  }
  return undefined;
}

/**
 * Prompts the user for options
 */
async function getUserOptions(
  imagePath: string,
  originalExt: string
): Promise<undefined | utils.ImgByteOptions> {
  const targetSize = await showTargetSizeQuickPick();
  if (!targetSize) return undefined;

  const format = await showFormatQuickPick(originalExt);
  if (format === undefined) return undefined;

  const defaultOutputPath = utils.getDefaultOutputPath(
    imagePath,
    format === 'same' ? undefined : format
  );
  const outputPath = await vscode.window.showInputBox({
    prompt: 'Enter output path (leave empty for default)',
    value: defaultOutputPath,
  });
  if (outputPath === undefined) return undefined;

  const defaultMinDimension = utils.getDefaultOptions().minDimension ?? 0;
  const minDimensionInput = await vscode.window.showInputBox({
    prompt: 'Enter minimum dimension in pixels (0 to disable)',
    validateInput: (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        return 'Please enter a valid number (0 or positive integer).';
      }
      return null;
    },
    value: defaultMinDimension.toString(),
  });
  if (minDimensionInput === undefined) return undefined;
  const minDimension = parseInt(minDimensionInput, 10);

  const exactSizeResult = await vscode.window.showQuickPick(['Yes', 'No'], {
    canPickMany: false,
    placeHolder: 'Pad file to exact size?',
  });
  if (exactSizeResult === undefined) return undefined;

  return {
    exactSize: exactSizeResult === 'Yes',
    format: format === 'same' ? undefined : format,
    minDimension: minDimension === 0 ? undefined : minDimension,
    outputPath: outputPath ?? defaultOutputPath,
    targetSize,
  };
}

/**
 * Runs the resize and surfaces the result to the user
 */
async function processImageResize(imagePath: string, options: utils.ImgByteOptions): Promise<void> {
  await vscode.window.withProgress(
    {
      cancellable: false,
      location: vscode.ProgressLocation.Notification,
      title: `Resizing image to ${options.targetSize}...`,
    },
    async (progress) => {
      const result = await utils.runImgbytesizer(imagePath, options);

      if (!result.success) {
        vscode.window.showErrorMessage(result.message);
        return;
      }

      const choice = await vscode.window.showInformationMessage(
        `${result.message} Output saved to: ${result.outputPath}`,
        'Open File'
      );

      if (choice === 'Open File' && result.outputPath) {
        const outputUri = vscode.Uri.file(result.outputPath);
        vscode.commands.executeCommand('vscode.open', outputUri);
      }

      progress.report({ message: result.message });
    }
  );
}

/**
 * Shows format selection quick pick
 */
async function showFormatQuickPick(originalExt: string): Promise<string | undefined> {
  const labelFor = (f: (typeof FORMAT_OPTIONS)[number]) =>
    f === 'same' ? `Same as original (${originalExt.replace('.', '')})` : FORMAT_LABELS[f];

  const selected = await vscode.window.showQuickPick(
    FORMAT_OPTIONS.map((f) => ({ label: labelFor(f), value: f })),
    { placeHolder: 'Select output format' }
  );

  return selected?.value;
}

/**
 * Shows a quick pick for target size selection
 */
async function showTargetSizeQuickPick(): Promise<string | undefined> {
  const customOption = 'Custom size...';

  const selected = await vscode.window.showQuickPick([...TARGET_SIZE_PRESETS, customOption], {
    placeHolder: 'Select target file size',
  });

  if (selected === customOption) {
    const defaultSize = utils.getDefaultOptions().targetSize ?? '500KB';
    return vscode.window.showInputBox({
      placeHolder: 'e.g., 500KB, 1.5MB',
      prompt: 'Enter target size (e.g., 500KB, 1.5MB)',
      validateInput: (value) => {
        if (!utils.isValidTargetSize(value)) {
          return 'Please enter a valid size (e.g., 500KB, 1.5MB)';
        }
        return null;
      },
      value: defaultSize,
    });
  }

  return selected;
}
