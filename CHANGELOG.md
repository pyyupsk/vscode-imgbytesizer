# Change Log

All notable changes to the "vscode-imgbytesizer" extension will be documented in this file.
Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.3.2] - 2026-05-09

### Added

- Fallow codebase intelligence: `.fallowrc.json`, baseline file, and `audit:code` script; CI runs `fallow-rs/fallow@v2` on every push with severity-aware `new-only` gating

### Changed

- Refactor `commands.ts`: extract `src/constants.ts` for image extensions / format options / target-size presets; route both commands through a shared `validateImageAndGetPath` + `processImageResize` flow (~110 lines deleted)
- Refactor `utils.ts`: extract `buildArgs` as the single source of truth for the imgbytesizer arg list; split `runImgbytesizer` into `ensureOutputDir` + `interpretResult` helpers (69 LOC / 15 cyclomatic → 24 / 6)
- Refactor `commands.ts`: extract `promptOutputPath`, `promptMinDimension`, `promptExactSize` helpers from `getUserOptions` (49 LOC / 11 cyclomatic → 27 / 8)
- Migrate linter and formatter from ESLint + Prettier to oxc (oxlint + oxfmt)
- Migrate package manager from pnpm to Bun
- Bump devDependencies to latest (TypeScript 6, sinon 22, @vscode/vsce 3.9, etc.)
- Pin all GitHub Actions to commit SHAs

### Fixed

- Use `Number.parseInt` and `Number.isNaN` over the global forms in `promptMinDimension`
- Drop the redundant duplicate success notification in `processImageResize`
- Rename shadowed `path` identifiers in `getImgbytesizerPath` and `validateImgbytesizerPath` to silence `no-shadow`

### Security

- Resolve 30+ Dependabot advisories across `form-data`, `fast-uri`, `lodash`, `undici`, `flatted`, `picomatch`, `minimatch`, `glob`, `tar-fs`, `serialize-javascript`, and `diff` (all dev/build transitive deps)
- Pass `VSCE_PAT` via env in the publish workflow instead of a CLI flag

## [0.3.1] - 2025-05-25

### Changed

- Downgrade @types/vscode to ^1.96.0 for better compatibility

### Security

- Replace execSync with spawnSync for improved security
- Add path validation for imgbytesizer executable

## [0.3.0] - 2025-05-25

### Added

- Input validation and user option prompts for advanced resize
- SonarCloud integration
- Improved test coverage

### Changed

- Refactor code for better maintainability
- Update dependencies to latest versions

### Fixed

- Null coalescing operator usage for `outputPath` in `getUserOptions`

## [0.2.0] - 2025-05-13

### Added

- Extension icon for the VS Code marketplace

### Changed

- Update publisher name in package.json

### Fixed

- Cache directory name in CI workflow
- Permissions for release workflow

## [0.1.0] - Initial Release

### Added

- Initial release of Image ByteSizer
- Basic resize command
- Advanced resize command with options
- Context menu integration for image files
- Extension settings for default options
