# Change Log

All notable changes to the "vscode-imgbytesizer" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.1] - 2025-05-25

- Downgrade @types/vscode to ^1.96.0 for better compatibility
- Replace execSync with spawnSync for improved security
- Add path validation for imgbytesizer executable

## [0.3.0] - 2025-05-25

- Add SonarCloud integration
- Refactor code for better maintainability
- Update dependencies to latest versions
- Fix null coalescing operator usage
- Improve test coverage

## [0.2.0] - 2025-05-13

- Add extension icon to vscode marketplace
- Update publisher name in package.json
- Fix cache directory name in CI workflow
- Fix permissions for release workflow

## [0.1.0] - Initial Release

- Initial release of Image ByteSizer
- Add basic resize command
- Add advanced resize with options command
- Add context menu integration for image files
- Add extension settings for default options
