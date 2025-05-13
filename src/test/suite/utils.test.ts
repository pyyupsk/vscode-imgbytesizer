import assert from 'assert';
import vscode from 'vscode';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';

import * as utils from '../../utils';
import { ImgByteOptions } from '../../utils';

suite('Utils Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let mockWorkspaceConfig: any;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Default mock for vscode.workspace.getConfiguration
    mockWorkspaceConfig = {
      get: sinon.stub().callsFake((key: string) => {
        switch (key) {
          case 'imgbytesizerPath':
            return 'imgbytesizer'; // Default mock value
          case 'defaultTargetSize':
            return '500KB';
          case 'defaultFormat':
            return 'same';
          case 'defaultMinDimension':
            return 0;
          case 'defaultExact':
            return true;
          default:
            return undefined;
        }
      }),
    };
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockWorkspaceConfig);
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('getImgbytesizerPath()', () => {
    test("Should return default 'imgbytesizer' if no path is configured or empty", () => {
      mockWorkspaceConfig.get.withArgs('imgbytesizerPath').returns('');
      assert.strictEqual(utils.getImgbytesizerPath(), 'imgbytesizer');

      mockWorkspaceConfig.get.withArgs('imgbytesizerPath').returns(undefined);
      assert.strictEqual(utils.getImgbytesizerPath(), 'imgbytesizer');
    });

    test('Should return configured path if set', () => {
      const customPath = '/usr/local/bin/custom_imgbytesizer';
      mockWorkspaceConfig.get.withArgs('imgbytesizerPath').returns(customPath);
      assert.strictEqual(utils.getImgbytesizerPath(), customPath);
    });

    test('Should trim whitespace from configured path', () => {
      const customPathWithSpace = '  /usr/bin/img_bs  ';
      mockWorkspaceConfig.get.withArgs('imgbytesizerPath').returns(customPathWithSpace);
      assert.strictEqual(utils.getImgbytesizerPath(), '/usr/bin/img_bs');
    });
  });

  suite('checkImgbytesizerInstalled()', () => {
    let execSyncStub: sinon.SinonStub;

    setup(() => {
      // Stub execSync from the 'child_process' module
      // This requires that 'child_process' is require-able in the test env.
      execSyncStub = sandbox.stub(require('child_process'), 'execSync');
    });

    test('Should return true if imgbytesizer check command succeeds', async () => {
      execSyncStub.returns('imgbytesizer version 1.0.0'); // Simulate successful execution
      const isInstalled = await utils.checkImgbytesizerInstalled();
      assert.strictEqual(isInstalled, true);
      assert.ok(execSyncStub.calledOnceWith('imgbytesizer -v', { stdio: 'ignore' }));
    });

    test('Should return false if imgbytesizer check command fails', async () => {
      execSyncStub.throws(new Error('Command failed')); // Simulate failed execution
      const isInstalled = await utils.checkImgbytesizerInstalled();
      assert.strictEqual(isInstalled, false);
      assert.ok(execSyncStub.calledOnceWith('imgbytesizer -v', { stdio: 'ignore' }));
    });
  });

  suite('getDefaultOptions()', () => {
    test('Should return default options from configuration', () => {
      const defaultOptions = utils.getDefaultOptions();
      assert.deepStrictEqual(defaultOptions, {
        targetSize: '500KB',
        format: 'same',
        minDimension: 0,
        exactSize: true,
      });
    });

    test('Should correctly use fallback values if config is missing', () => {
      mockWorkspaceConfig.get.callsFake((key: string) => {
        // Simulate some keys being undefined
        if (key === 'defaultTargetSize') {
          return undefined;
        }
        if (key === 'defaultFormat') {
          return undefined;
        }
        if (key === 'defaultMinDimension') {
          return undefined;
        }
        if (key === 'defaultExact') {
          return undefined;
        } // `?? true` handles this
        return undefined;
      });
      const defaultOptions = utils.getDefaultOptions();
      assert.deepStrictEqual(defaultOptions, {
        targetSize: '500KB',
        format: 'same',
        minDimension: 0,
        exactSize: true,
      });
    });
  });

  suite('getDefaultOutputPath()', () => {
    test("Should generate default output path with original extension for 'same' format", () => {
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/image.jpg', 'same'),
        '/path/to/image_resized.jpg'
      );
    });

    test('Should generate default output path with original extension if format is undefined', () => {
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/image.png', undefined),
        '/path/to/image_resized.png'
      );
    });

    test('Should generate output path with new extension if format is specified', () => {
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/image.jpeg', 'webp'),
        '/path/to/image_resized.webp'
      );
    });

    test('Should handle file names with multiple dots', () => {
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/archive.tar.gz', 'zip'),
        '/path/to/archive.tar_resized.zip'
      );
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/archive.tar.gz', 'same'),
        '/path/to/archive.tar_resized.gz'
      );
    });

    test('Should handle files with no extension', () => {
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/imagenoext', 'jpg'),
        '/path/to/imagenoext_resized.jpg'
      );
      assert.strictEqual(
        utils.getDefaultOutputPath('/path/to/imagenoext', 'same'),
        '/path/to/imagenoext_resized' // No original ext to append
      );
    });
  });

  suite('isValidTargetSize()', () => {
    ['10KB', '250KB', '1MB', '1.5MB', '500B', '0.5KB'].forEach((size) => {
      test(`Should return true for valid size: ${size}`, () => {
        assert.strictEqual(utils.isValidTargetSize(size), true);
      });
    });

    ['10 K', 'MB', '1.GB', '10BB', 'KB10', '', '10.0.1MB'].forEach((size) => {
      test(`Should return false for invalid size: ${size}`, () => {
        assert.strictEqual(utils.isValidTargetSize(size), false);
      });
    });
  });

  suite('buildCommand()', () => {
    const imagePath = '/path/to/my image.png'; // Path with space
    let getImgbytesizerPathStub: sinon.SinonStub;

    setup(() => {
      // Stub getImgbytesizerPath to ensure consistent command prefix
      getImgbytesizerPathStub = sandbox.stub(utils, 'getImgbytesizerPath').returns('imgbytesizer');
    });

    test('Should build basic command with target size', () => {
      const options: ImgByteOptions = { targetSize: '250KB' };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 250KB`
      );
    });

    test('Should include output path if provided', () => {
      const options: ImgByteOptions = {
        targetSize: '1MB',
        outputPath: '/out path/img.png',
      };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 1MB -o "/out path/img.png"`
      );
    });

    test("Should include format if provided and not 'same'", () => {
      const options: ImgByteOptions = { targetSize: '50KB', format: 'webp' };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 50KB -f webp`
      );
    });

    test("Should not include format if 'same'", () => {
      const options: ImgByteOptions = { targetSize: '50KB', format: 'same' };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 50KB`
      );
    });

    test('Should include min-dimension if provided and > 0', () => {
      const options: ImgByteOptions = {
        targetSize: '100KB',
        minDimension: 200,
      };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 100KB --min-dimension 200`
      );
    });

    test('Should not include min-dimension if 0 or undefined', () => {
      const options1: ImgByteOptions = { targetSize: '100KB', minDimension: 0 };
      assert.strictEqual(
        utils.buildCommand(imagePath, options1),
        `imgbytesizer "${imagePath}" 100KB`
      );
      const options2: ImgByteOptions = { targetSize: '100KB' };
      assert.strictEqual(
        utils.buildCommand(imagePath, options2),
        `imgbytesizer "${imagePath}" 100KB`
      );
    });

    test('Should include --no-exact if exactSize is false', () => {
      const options: ImgByteOptions = { targetSize: '70KB', exactSize: false };
      assert.strictEqual(
        utils.buildCommand(imagePath, options),
        `imgbytesizer "${imagePath}" 70KB --no-exact`
      );
    });

    test('Should not include --no-exact if exactSize is true or undefined', () => {
      const options1: ImgByteOptions = { targetSize: '70KB', exactSize: true };
      assert.strictEqual(
        utils.buildCommand(imagePath, options1),
        `imgbytesizer "${imagePath}" 70KB`
      );
      const options2: ImgByteOptions = { targetSize: '70KB' };
      assert.strictEqual(
        utils.buildCommand(imagePath, options2),
        `imgbytesizer "${imagePath}" 70KB`
      );
    });

    test('Should build full command with all options', () => {
      const options: ImgByteOptions = {
        targetSize: '2MB',
        outputPath: '/final output/image name.webp',
        format: 'webp',
        minDimension: 300,
        exactSize: false,
      };
      const expected = `imgbytesizer "${imagePath}" 2MB -o "/final output/image name.webp" -f webp --min-dimension 300 --no-exact`;
      assert.strictEqual(utils.buildCommand(imagePath, options), expected);
    });
  });

  suite('runImgbytesizer()', () => {
    let existsSyncStub: sinon.SinonStub;
    let mkdirSyncStub: sinon.SinonStub;
    let execSyncStub: sinon.SinonStub; // Stub for child_process.execSync
    let buildCommandStub: sinon.SinonStub;
    let getDefaultOutputPathStub: sinon.SinonStub;

    const testImagePath = '/test/input image.jpg';
    const defaultMockedOutputPath = '/test/input image_resized.jpg';
    const defaultOptions: ImgByteOptions = { targetSize: '100KB' };

    setup(() => {
      existsSyncStub = sandbox.stub(fs, 'existsSync');
      mkdirSyncStub = sandbox.stub(fs, 'mkdirSync');
      execSyncStub = sandbox.stub(require('child_process'), 'execSync');
      buildCommandStub = sandbox.stub(utils, 'buildCommand').returns('mocked command to execute');
      // getDefaultOutputPath is stubbed to control its output during these tests
      getDefaultOutputPathStub = sandbox
        .stub(utils, 'getDefaultOutputPath')
        .returns(defaultMockedOutputPath);
    });

    test('Should return error if image file not found', async () => {
      existsSyncStub.withArgs(testImagePath).returns(false);
      const result = await utils.runImgbytesizer(testImagePath, defaultOptions);
      assert.deepStrictEqual(result, {
        success: false,
        message: `Image file not found: ${testImagePath}`,
      });
    });

    test('Should create output directory if it does not exist', async () => {
      existsSyncStub.withArgs(testImagePath).returns(true); // Input image exists
      existsSyncStub.withArgs(path.dirname(defaultMockedOutputPath)).returns(false); // Output dir doesn't exist
      existsSyncStub.withArgs(defaultMockedOutputPath).returns(true); // Simulate output file created
      execSyncStub.returns('Success output from command');

      await utils.runImgbytesizer(testImagePath, defaultOptions);
      assert.ok(
        mkdirSyncStub.calledOnceWith(path.dirname(defaultMockedOutputPath), {
          recursive: true,
        })
      );
    });

    test('Should run command and return success if output file is created', async () => {
      existsSyncStub.returns(true); // All paths exist or are created
      execSyncStub.returns('Process successful!');

      const result = await utils.runImgbytesizer(testImagePath, defaultOptions);

      assert.deepStrictEqual(result, {
        success: true,
        message: `Image resized successfully to ${defaultOptions.targetSize}`,
        outputPath: defaultMockedOutputPath,
      });
    });

    test('Should return error if execSync throws', async () => {
      existsSyncStub.returns(true); // Assume input file and output dir exist
      const errorMessage = 'Command execution failed badly';
      const execError = new Error(errorMessage);
      execSyncStub.throws(execError);

      const result = await utils.runImgbytesizer(testImagePath, defaultOptions);
      assert.deepStrictEqual(result, {
        success: false,
        message: `Error: ${errorMessage}`,
      });
    });

    test('Should use explicitly provided outputPath in options', async () => {
      const specificOutputPath = '/my/custom/output here.png';
      const optionsWithOutput: ImgByteOptions = {
        ...defaultOptions,
        outputPath: specificOutputPath,
      };

      existsSyncStub.returns(true);
      execSyncStub.returns('Success');

      const result = await utils.runImgbytesizer(testImagePath, optionsWithOutput);

      assert.ok(
        getDefaultOutputPathStub.notCalled,
        'getDefaultOutputPath should not be called if outputPath is provided in options'
      );
      assert.ok(
        existsSyncStub.calledWith(path.dirname(specificOutputPath)),
        'Should check existence of specific output directory'
      );

      assert.deepStrictEqual(result, {
        success: true,
        message: `Image resized successfully to ${optionsWithOutput.targetSize}`,
        outputPath: specificOutputPath,
      });
    });
  });
});
