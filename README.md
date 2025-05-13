# ImgByteSizer - VSCode Extension

A VSCode extension that integrates the `imgbytesizer` command-line to resize and optimize images to match specific file sizes while maintaining the best possible quality.

## Requirements

- VSCode version 1.96.0 or higher
- `imgbytesizer` command-line tool (https://github.com/pyyupsk/imgbytesizer)

## Installation

1. Install the extension from the VSCode marketplace
2. The extension will detect if `imgbytesizer` is installed and offer to install it if needed
3. Alternatively, you can manually install it with: `pip install imgbytesizer`

## Usage

### Basic Usage

1. Right-click on an image file in the explorer or editor
2. Select "ImgByteSizer: Resize Image to Target Size"
3. Choose a target file size
4. The image will be resized using default settings and saved with "\_resized" suffix

### Advanced Usage

1. Right-click on an image file in the explorer or editor
2. Select "ImgByteSizer: Resize Image with Advanced Options"
3. Follow the prompts to configure:
   - Target file size
   - Output format
   - Output path
   - Minimum dimensions
   - Exact size padding

## Extension Settings

This extension contributes the following settings:

- `imgbytesizer.defaultTargetSize`: Default target file size (e.g., '1MB', '500KB')
- `imgbytesizer.defaultFormat`: Default output format (same, jpg, png, webp)
- `imgbytesizer.defaultMinDimension`: Default minimum width/height in pixels (0 to disable)
- `imgbytesizer.defaultExact`: Whether to pad file to get exact target size by default
- `imgbytesizer.imgbytesizerPath`: Path to the imgbytesizer executable (Leave empty to use 'imgbytesizer' as default)

## How It Works

This extension is a wrapper around the `imgbytesizer` command-line, which:

1. Analyzes the input image
2. Uses binary search to find optimal quality settings
3. Resizes and compresses the image to match the target file size
4. Maintains the best possible quality within the size constraints

## About imgbytesizer

The `imgbytesizer` is a command-line tool that resizes images to match a target file size while maintaining quality. It's particularly useful when you need to meet specific size requirements (like upload limits) without manually trying different compression settings.

For more information about the command-line, see the [imgbytesizer documentation](https://github.com/pyyupsk/imgbytesizer).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
