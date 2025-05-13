import vscode from 'vscode';
import path from 'path';
import * as utils from './utils';

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
    const defaultSize = utils.getDefaultOptions().targetSize || '500KB';
    return vscode.window.showInputBox({
      prompt: 'Enter target size (e.g., 500KB, 1.5MB)',
      placeHolder: 'e.g., 500KB, 1.5MB',
      value: defaultSize,
      validateInput: (value) => {
        if (!utils.isValidTargetSize(value)) {
          return 'Please enter a valid size (e.g., 500KB, 1.5MB)';
        }
        return null;
      },
    });
  }

  return selected;
}

/**
 * Shows format selection quick pick
 */
async function showFormatQuickPick(originalExt: string): Promise<string | undefined> {
  const formats = ['same', 'jpg', 'png', 'webp'];
  const formatLabels = {
    same: `Same as original (${originalExt.replace('.', '')})`,
    jpg: 'JPEG',
    png: 'PNG',
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
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
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
      targetSize,
      outputPath: utils.getDefaultOutputPath(imagePath, defaultOptions.format),
      format: defaultOptions.format === 'same' ? undefined : defaultOptions.format,
      minDimension: defaultOptions.minDimension === 0 ? undefined : defaultOptions.minDimension,
      exactSize: defaultOptions.exactSize,
    };

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Resizing image to ${targetSize}...`,
        cancellable: false,
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
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      vscode.window.showErrorMessage(
        'Selected file is not a supported image (jpg, jpeg, png, webp).'
      );
      return;
    }

    // Step 1: Get target size
    const targetSize = await showTargetSizeQuickPick();
    if (!targetSize) {
      return; // User cancelled
    }

    // Step 2: Get output format
    const format = await showFormatQuickPick(ext);
    if (format === undefined) {
      return; // User cancelled
    }

    // Step 3: Get output path
    const defaultOutputPath = utils.getDefaultOutputPath(
      imagePath,
      format === 'same' ? undefined : format
    );
    const outputPath = await vscode.window.showInputBox({
      prompt: 'Enter output path (leave empty for default)',
      value: defaultOutputPath,
    });
    if (outputPath === undefined) {
      return; // User cancelled
    }

    // Step 4: Get minimum dimension
    const defaultMinDimension = utils.getDefaultOptions().minDimension || 0;
    const minDimensionInput = await vscode.window.showInputBox({
      prompt: 'Enter minimum dimension in pixels (0 to disable)',
      value: defaultMinDimension.toString(),
      validateInput: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0) {
          return 'Please enter a valid number (0 or positive integer).';
        }
        return null;
      },
    });
    if (minDimensionInput === undefined) {
      return; // User cancelled
    }
    const minDimension = parseInt(minDimensionInput, 10);

    // Step 5: Get exact size option
    const defaultExact = utils.getDefaultOptions().exactSize ?? true;
    const exactSizeOptions = ['Yes', 'No'];
    const exactSizeResult = await vscode.window.showQuickPick(exactSizeOptions, {
      placeHolder: 'Pad file to exact size?',
      canPickMany: false,
    });
    if (exactSizeResult === undefined) {
      return; // User cancelled
    }
    const exactSize = exactSizeResult === 'Yes';

    // Build options
    const options: utils.ImgByteOptions = {
      targetSize,
      outputPath: outputPath || defaultOutputPath,
      format: format === 'same' ? undefined : format,
      minDimension: minDimension === 0 ? undefined : minDimension,
      exactSize,
    };

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Resizing image to ${targetSize}...`,
        cancellable: false,
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Error resizing image: ${errorMsg}`);
  }
}
