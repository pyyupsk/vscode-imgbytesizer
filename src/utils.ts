import vscode from 'vscode';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

export interface ImgByteOptions {
  targetSize: string;
  outputPath?: string;
  format?: string;
  minDimension?: number;
  exactSize?: boolean;
}

/**
 * Checks if imgbytesizer is installed and accessible
 */
export async function checkImgbytesizerInstalled(): Promise<boolean> {
  try {
    const imgbytesizerPath = getImgbytesizerPath();
    execSync(`${imgbytesizerPath} -v`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the ImgByteSizer path from configuration or uses 'imgbytesizer' as default
 */
export function getImgbytesizerPath(): string {
  const config = vscode.workspace.getConfiguration('imgbytesizer');
  const imgbytesizerPath = config.get<string>('imgbytesizerPath');
  return imgbytesizerPath ? imgbytesizerPath.trim() : 'imgbytesizer';
}

/**
 * Gets default options from VS Code configuration
 */
export function getDefaultOptions(): Partial<ImgByteOptions> {
  const config = vscode.workspace.getConfiguration('imgbytesizer');
  return {
    targetSize: config.get<string>('defaultTargetSize') || '500KB',
    format: config.get<string>('defaultFormat') || 'same',
    minDimension: config.get<number>('defaultMinDimension') || 0,
    exactSize: config.get<boolean>('defaultExact') ?? true,
  };
}

/**
 * Generates a default output filename based on input path
 */
export function getDefaultOutputPath(imagePath: string, format?: string): string {
  const parsedPath = path.parse(imagePath);
  const newExt = format && format !== 'same' ? `.${format}` : parsedPath.ext;
  const baseName = path.join(parsedPath.dir, parsedPath.name);
  return `${baseName}_resized${newExt}`;
}

/**
 * Validates the target size string format
 */
export function isValidTargetSize(targetSize: string): boolean {
  return /^\d+(\.\d+)?(KB|MB|B)$/i.test(targetSize);
}

/**
 * Builds the imgbytesizer command with the provided options
 */
export function buildCommand(imagePath: string, options: ImgByteOptions): string {
  const imgbytesizerPath = getImgbytesizerPath();
  let command = `${imgbytesizerPath} "${imagePath}" ${options.targetSize}`;

  if (options.outputPath) {
    command += ` -o "${options.outputPath}"`;
  }

  if (options.format && options.format !== 'same') {
    command += ` -f ${options.format}`;
  }

  if (options.minDimension && options.minDimension > 0) {
    command += ` --min-dimension ${options.minDimension}`;
  }

  if (options.exactSize === false) {
    command += ' --no-exact';
  }

  return command;
}

/**
 * Runs the imgbytesizer command
 */
export async function runImgbytesizer(
  imagePath: string,
  options: ImgByteOptions
): Promise<{ success: boolean; message: string; outputPath?: string }> {
  try {
    if (!fs.existsSync(imagePath)) {
      return { success: false, message: `Image file not found: ${imagePath}` };
    }

    // Ensure output directory exists
    const outputPath = options.outputPath || getDefaultOutputPath(imagePath, options.format);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = buildCommand(imagePath, { ...options, outputPath });

    // Execute the command and capture output
    const output = execSync(command, { encoding: 'utf8' });

    if (!fs.existsSync(outputPath)) {
      return {
        success: false,
        message: `Failed to create output file: ${outputPath}. Command output: ${output}`,
      };
    }

    return {
      success: true,
      message: `Image resized successfully to ${options.targetSize}`,
      outputPath,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Error: ${errorMsg}` };
  }
}
