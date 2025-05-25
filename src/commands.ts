import path from 'path';
import vscode from 'vscode';

import * as utils from './utils';

/**
 * Command handler for simple image resizing
 */
export async function resizeImage(uri?: vscode.Uri): Promise<void> {
  try {
    // Check if imgbytesizer is installed
    const isInstalled = await utils.checkImgbytesizerInstalled();
    if (!isInstalled) {
      vscode.window.showErrorMessage(
        'ImgByteSizer is not installed. Please install it first. https://github.com/pyyupsk/imgbytesizer#installation'
      );
      return;
    }

    // Get the image path
    let imagePath: string;
    if (uri) {
      imagePath = uri.fsPath;
    } else {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        imagePath = activeEditor.document.uri.fsPath;
      } else {
        vscode.window.showErrorMessage('Please select an image file in the explorer or editor.');
        return;
      }
    }

    // Verify file is an image
    const ext = path.extname(imagePath).toLowerCase();
    if (!['.jpeg', '.jpg', '.png', '.webp'].includes(ext)) {
      vscode.window.showErrorMessage(
        'Selected file is not a supported image (jpg, jpeg, png, webp).'
      );
      return;
    }

    // Get target size
    const targetSize = await showTargetSizeQuickPick();
    if (!targetSize) {
      return; // User cancelled
    }

    // Get default options
    const defaultOptions = utils.getDefaultOptions();

    // Build options
    const options: utils.ImgByteOptions = {
      exactSize: defaultOptions.exactSize,
      format: defaultOptions.format === 'same' ? undefined : defaultOptions.format,
      minDimension: defaultOptions.minDimension === 0 ? undefined : defaultOptions.minDimension,
      outputPath: utils.getDefaultOutputPath(imagePath, defaultOptions.format),
      targetSize,
    };

    // Show progress
    await vscode.window.withProgress(
      {
        cancellable: false,
        location: vscode.ProgressLocation.Notification,
        title: `Resizing image to ${targetSize}...`,
      },
      async (opts) => {
        const result = await utils.runImgbytesizer(imagePath, options);

        if (result.success) {
          const openFile = await vscode.window.showInformationMessage(
            `${result.message} Output saved to: ${result.outputPath}`,
            'Open File'
          );

          if (openFile === 'Open File' && result.outputPath) {
            const outputUri = vscode.Uri.file(result.outputPath);
            vscode.commands.executeCommand('vscode.open', outputUri);
          }
        } else {
          vscode.window.showErrorMessage(result.message);
        }

        opts.report({ message: result.message });
      }
    );
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
  // Check if imgbytesizer is installed
  const isInstalled = await utils.checkImgbytesizerInstalled();
  if (!isInstalled) {
    vscode.window.showErrorMessage(
      'ImgByteSizer is not installed. Please install it first. https://github.com/pyyupsk/imgbytesizer#installation'
    );
    return undefined;
  }

  // Get the image path
  let imagePath: string;
  if (uri) {
    imagePath = uri.fsPath;
  } else {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
      imagePath = activeEditor.document.uri.fsPath;
    } else {
      vscode.window.showErrorMessage('Please select an image file in the explorer or editor.');
      return undefined;
    }
  }

  // Verify file is an image
  const ext = path.extname(imagePath).toLowerCase();
  if (!['.jpeg', '.jpg', '.png', '.webp'].includes(ext)) {
    vscode.window.showErrorMessage(
      'Selected file is not a supported image (jpg, jpeg, png, webp).'
    );
    return undefined;
  }

  return imagePath;
}

/**
 * Prompts the user for options
 */
async function getUserOptions(
  imagePath: string,
  originalExt: string
): Promise<undefined | utils.ImgByteOptions> {
  // Step 1: Get target size
  const targetSize = await showTargetSizeQuickPick();
  if (!targetSize) return undefined;

  // Step 2: Get output format
  const format = await showFormatQuickPick(originalExt);
  if (format === undefined) return undefined;

  // Step 3: Get output path
  const defaultOutputPath = utils.getDefaultOutputPath(
    imagePath,
    format === 'same' ? undefined : format
  );
  const outputPath = await vscode.window.showInputBox({
    prompt: 'Enter output path (leave empty for default)',
    value: defaultOutputPath,
  });
  if (outputPath === undefined) return undefined;

  // Step 4: Get minimum dimension
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

  // Step 5: Get exact size option
  const exactSizeOptions = ['Yes', 'No'];
  const exactSizeResult = await vscode.window.showQuickPick(exactSizeOptions, {
    canPickMany: false,
    placeHolder: 'Pad file to exact size?',
  });
  if (exactSizeResult === undefined) return undefined;

  return {
    exactSize: exactSizeResult === 'Yes',
    format: format === 'same' ? undefined : format,
    minDimension: minDimension === 0 ? undefined : minDimension,
    outputPath: outputPath || defaultOutputPath,
    targetSize,
  };
}

/**
 * Resizes the image
 */
async function processImageResize(imagePath: string, options: utils.ImgByteOptions): Promise<void> {
  await vscode.window.withProgress(
    {
      cancellable: false,
      location: vscode.ProgressLocation.Notification,
      title: `Resizing image to ${options.targetSize}...`,
    },
    async () => {
      const result = await utils.runImgbytesizer(imagePath, options);

      if (result.success) {
        const openFile = await vscode.window.showInformationMessage(
          `${result.message} Output saved to: ${result.outputPath}`,
          'Open File'
        );

        if (openFile === 'Open File' && result.outputPath) {
          const outputUri = vscode.Uri.file(result.outputPath);
          vscode.commands.executeCommand('vscode.open', outputUri);
        }

        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );
}

/**
 * Shows format selection quick pick
 */
async function showFormatQuickPick(originalExt: string): Promise<string | undefined> {
  const formats = ['same', 'jpg', 'png', 'webp'];
  const formatLabels = {
    jpg: 'JPEG',
    png: 'PNG',
    same: `Same as original (${originalExt.replace('.', '')})`,
    webp: 'WebP',
  };

  const selected = await vscode.window.showQuickPick(
    formats.map((f) => ({
      label: formatLabels[f as keyof typeof formatLabels],
      value: f,
    })),
    { placeHolder: 'Select output format' }
  );

  return selected?.value;
}

/**
 * Shows a quick pick for target size selection
 */
async function showTargetSizeQuickPick(): Promise<string | undefined> {
  const defaultOptions = ['100KB', '250KB', '500KB', '1MB', '2MB', '5MB', '10MB'];
  const customOption = 'Custom size...';

  const selected = await vscode.window.showQuickPick([...defaultOptions, customOption], {
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
