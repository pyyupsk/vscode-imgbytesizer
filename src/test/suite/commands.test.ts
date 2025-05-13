import assert from "assert";
import vscode from "vscode";
import sinon, { SinonStubbedInstance } from "sinon";
import path from "path";
import fs from "fs";

import * as commands from "../../commands";
import * as utils from "../../utils";

suite("Commands Test Suite", () => {
  let sandbox: sinon.SinonSandbox;

  // Stubs for vscode.window and other APIs
  let showErrorMessageStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;
  let showQuickPickStub: sinon.SinonStub;
  let showInputBoxStub: sinon.SinonStub;
  let withProgressStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  let activeTextEditorStub: sinon.SinonStubbedInstance<
    Partial<vscode.TextEditor>
  >;

  // Stubs for utils functions
  let checkImgbytesizerInstalledStub: sinon.SinonStub;
  let runImgbytesizerStub: sinon.SinonStub;
  let getDefaultOptionsStub: sinon.SinonStub;
  let getDefaultOutputPathStub: sinon.SinonStub;
  let isValidTargetSizeStub: sinon.SinonStub; // For showTargetSizeQuickPick custom input

  const testFileDir = path.join(__dirname, "..", "test_files_commands_temp"); // Temp dir for test files
  const testImageFileName = "dummy_image.jpg";
  const testImagePath = path.join(testFileDir, testImageFileName);
  const testImageUri = vscode.Uri.file(testImagePath);

  // Create dummy file and directory for tests that require a URI
  suiteSetup(() => {
    if (!fs.existsSync(testFileDir)) {
      fs.mkdirSync(testFileDir, { recursive: true });
    }
    if (!fs.existsSync(testImagePath)) {
      fs.writeFileSync(testImagePath, "dummy image content for testing");
    }
  });

  // Clean up dummy file and directory
  suiteTeardown(() => {
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    if (fs.existsSync(testFileDir)) {
      try {
        fs.rmdirSync(testFileDir); // if empty
      } catch (e) {
        console.warn(
          `Could not remove temp dir ${testFileDir}, it might not be empty or due to permissions. Manual cleanup might be needed.`,
        );
      }
    }
  });

  setup(() => {
    sandbox = sinon.createSandbox();

    // Stub vscode.window methods
    showErrorMessageStub = sandbox.stub(vscode.window, "showErrorMessage");
    showInformationMessageStub = sandbox.stub(
      vscode.window,
      "showInformationMessage",
    );
    showQuickPickStub = sandbox.stub(vscode.window, "showQuickPick");
    showInputBoxStub = sandbox.stub(vscode.window, "showInputBox");
    withProgressStub = sandbox
      .stub(vscode.window, "withProgress")
      .callsFake(async (_options, task) => {
        const progress = { report: sinon.stub() };
        const token = {
          isCancellationRequested: false,
          onCancellationRequested: sinon.stub(),
        } as any;
        return task(progress, token); // Immediately execute the task
      });
    executeCommandStub = sandbox.stub(vscode.commands, "executeCommand");

    // Stub activeTextEditor
    // By default, no active editor or one that doesn't match
    activeTextEditorStub = sandbox
      .stub(vscode.window, "activeTextEditor")
      .value(undefined) as SinonStubbedInstance<Partial<vscode.TextEditor>>;

    // Stub utils functions
    checkImgbytesizerInstalledStub = sandbox.stub(
      utils,
      "checkImgbytesizerInstalled",
    );
    runImgbytesizerStub = sandbox.stub(utils, "runImgbytesizer");
    getDefaultOptionsStub = sandbox.stub(utils, "getDefaultOptions").returns({
      targetSize: "200KB", // Test with different defaults than utils.test.ts
      format: "png",
      minDimension: 50,
      exactSize: false,
    });
    getDefaultOutputPathStub = sandbox
      .stub(utils, "getDefaultOutputPath")
      .returns("/mocked/output_default.png");
    isValidTargetSizeStub = sandbox
      .stub(utils, "isValidTargetSize")
      .returns(true); // Default to valid
  });

  teardown(() => {
    sandbox.restore();
  });

  suite("resizeImage Command", () => {
    test("Should show error if imgbytesizer is not installed and return", async () => {
      checkImgbytesizerInstalledStub.resolves(false);
      await commands.resizeImage(testImageUri);
      assert.ok(
        showErrorMessageStub.calledOnceWith(
          sinon.match(/ImgByteSizer is not installed/),
        ),
      );
      assert.ok(runImgbytesizerStub.notCalled);
    });

    test("Should show error if no image URI and no active editor with file", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      // activeTextEditorStub is already undefined by default in setup
      await commands.resizeImage(undefined);
      assert.ok(
        showErrorMessageStub.calledOnceWith(
          "Please select an image file in the explorer or editor.",
        ),
      );
    });

    test("Should use active editor if URI is undefined and editor has a file URI", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      const editorUri = vscode.Uri.file(
        path.join(testFileDir, "editor_active.png"),
      );
      fs.writeFileSync(editorUri.fsPath, "dummy"); // ensure file exists

      // Mock active editor
      const document = { uri: editorUri };
      const activeEditorStub = { document };
      sinon.stub(vscode.window, "activeTextEditor").value(activeEditorStub);

      showQuickPickStub.resolves("100KB"); // User selects target size
      runImgbytesizerStub.resolves({
        success: true,
        message: "Resized",
        outputPath: editorUri.fsPath + "_resized",
      });

      await commands.resizeImage(undefined);

      assert.ok(runImgbytesizerStub.calledOnce);
      assert.strictEqual(
        runImgbytesizerStub.firstCall.args[0],
        editorUri.fsPath,
      );
      fs.unlinkSync(editorUri.fsPath); // cleanup
    });

    test("Should show error for unsupported file type", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      const nonImageUri = vscode.Uri.file(path.join(testFileDir, "test.txt"));
      fs.writeFileSync(nonImageUri.fsPath, "text content");

      await commands.resizeImage(nonImageUri);
      assert.ok(
        showErrorMessageStub.calledOnceWith(
          sinon.match(/Selected file is not a supported image/),
        ),
      );
      fs.unlinkSync(nonImageUri.fsPath);
    });

    test("Should return if user cancels target size selection (showTargetSizeQuickPick returns undefined)", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      showQuickPickStub.resolves(undefined); // Simulates user cancelling QuickPick

      await commands.resizeImage(testImageUri);
      assert.ok(showQuickPickStub.calledOnce); // It was called
      assert.ok(runImgbytesizerStub.notCalled); // But processing stopped
    });

    test("Should call runImgbytesizer with correct options and handle success", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      showQuickPickStub.resolves("1MB"); // User selects target size
      const expectedOutputPath = "/mocked/output_default.png"; // from getDefaultOutputPathStub
      runImgbytesizerStub.resolves({
        success: true,
        message: "Resized!",
        outputPath: expectedOutputPath,
      });
      showInformationMessageStub.resolves("Open File"); // User chooses to open

      await commands.resizeImage(testImageUri);

      assert.ok(getDefaultOptionsStub.calledOnce);
      const defaultOptsFromUtil = utils.getDefaultOptions(); // what our stub returns

      assert.ok(
        runImgbytesizerStub.calledOnceWith(testImagePath, {
          targetSize: "1MB",
          outputPath: expectedOutputPath,
          format:
            defaultOptsFromUtil.format === "same"
              ? undefined
              : defaultOptsFromUtil.format,
          minDimension:
            defaultOptsFromUtil.minDimension === 0
              ? undefined
              : defaultOptsFromUtil.minDimension,
          exactSize: defaultOptsFromUtil.exactSize,
        }),
      );
      assert.ok(withProgressStub.calledOnce);
      assert.ok(
        showInformationMessageStub.calledWith(
          sinon.match("Resized!"),
          "Open File",
        ),
      );
      assert.ok(
        executeCommandStub.calledOnceWith(
          "vscode.open",
          vscode.Uri.file(expectedOutputPath),
        ),
      );
    });

    test("Should handle runImgbytesizer failure", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      showQuickPickStub.resolves("500KB");
      runImgbytesizerStub.resolves({
        success: false,
        message: "Conversion failed badly.",
      });

      await commands.resizeImage(testImageUri);
      assert.ok(
        showErrorMessageStub.calledOnceWith("Conversion failed badly."),
      );
    });

    test("Should handle unexpected error during resizeImage", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      showQuickPickStub.rejects(new Error("Unexpected QuickPick error")); // Simulate error

      await commands.resizeImage(testImageUri);
      assert.ok(
        showErrorMessageStub.calledOnceWith(
          sinon.match(/Error resizing image: Unexpected QuickPick error/),
        ),
      );
    });
  });

  suite("resizeImageWithOptions Command", () => {
    // Helper to simulate a sequence of user inputs
    const simulateUserInputs = (inputs: {
      targetSize?: string | undefined;
      customTargetSize?: string | undefined;
      format?: { label: string; value: string } | string | undefined; // showQuickPick returns object for format
      outputPath?: string | undefined;
      minDimension?: string | undefined;
      exactSize?: string | undefined; // "Yes" or "No"
    }) => {
      let qpCall = 0;
      let ibCall = 0;
      showQuickPickStub.callsFake(() => {
        qpCall++;
        if (qpCall === 1) {
          return Promise.resolve(inputs.targetSize);
        } // Target Size
        if (qpCall === 2 && inputs.targetSize === "Custom size...") {
          return Promise.resolve(inputs.format);
        } // Format (after custom size input)
        if (qpCall === 2 && inputs.targetSize !== "Custom size...") {
          return Promise.resolve(inputs.format);
        } // Format
        if (qpCall === 3) {
          return Promise.resolve(inputs.exactSize);
        } // Exact Size
        return Promise.resolve(undefined);
      });
      showInputBoxStub.callsFake(() => {
        ibCall++;
        if (inputs.targetSize === "Custom size..." && ibCall === 1) {
          return Promise.resolve(inputs.customTargetSize);
        } // Custom Target Size
        if (ibCall === 1 && inputs.targetSize !== "Custom size...") {
          return Promise.resolve(inputs.outputPath);
        } // Output Path
        if (ibCall === 2 && inputs.targetSize === "Custom size...") {
          return Promise.resolve(inputs.outputPath);
        } // Output Path (after custom size)
        if (ibCall === 2 && inputs.targetSize !== "Custom size...") {
          return Promise.resolve(inputs.minDimension);
        } // Min Dimension
        if (ibCall === 3 && inputs.targetSize === "Custom size...") {
          return Promise.resolve(inputs.minDimension);
        } // Min Dimension (after custom size)
        return Promise.resolve(undefined);
      });
    };

    test("Should proceed through all steps and call runImgbytesizer with chosen options", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      simulateUserInputs({
        targetSize: "250KB",
        format: { label: "JPEG", value: "jpg" }, // showFormatQuickPick returns {label, value} then command takes .value
        outputPath: "/my/output.jpg",
        minDimension: "150",
        exactSize: "Yes",
      });
      runImgbytesizerStub.resolves({
        success: true,
        message: "Success!",
        outputPath: "/my/output.jpg",
      });

      await commands.resizeImageWithOptions(testImageUri);

      assert.ok(runImgbytesizerStub.calledOnce);
      const opts = runImgbytesizerStub.firstCall
        .args[1] as utils.ImgByteOptions;
      assert.strictEqual(opts.targetSize, "250KB");
      assert.strictEqual(opts.format, "jpg");
      assert.strictEqual(opts.outputPath, "/my/output.jpg");
      assert.strictEqual(opts.minDimension, 150);
      assert.strictEqual(opts.exactSize, true);
      assert.ok(showInformationMessageStub.calledWith(sinon.match("Success!")));
    });

    test("Should use custom target size if selected and entered", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      const customSize = "777KB";
      simulateUserInputs({
        targetSize: "Custom size...",
        customTargetSize: customSize,
        format: { label: "PNG", value: "png" },
        outputPath: "", // Use default
        minDimension: "0",
        exactSize: "No",
      });
      isValidTargetSizeStub.withArgs(customSize).returns(true);
      runImgbytesizerStub.resolves({
        success: true,
        message: "Done",
        outputPath: "/mocked/output_default.png",
      });

      await commands.resizeImageWithOptions(testImageUri);

      assert.ok(runImgbytesizerStub.calledOnce);
      const opts = runImgbytesizerStub.firstCall
        .args[1] as utils.ImgByteOptions;
      assert.strictEqual(opts.targetSize, customSize);
      assert.strictEqual(opts.format, "png");
      assert.strictEqual(opts.outputPath, "/mocked/output_default.png"); // Default path used
      assert.strictEqual(opts.minDimension, undefined); // 0 means undefined
      assert.strictEqual(opts.exactSize, false);
    });

    test("Should stop if user cancels at any QuickPick/InputBox step", async () => {
      checkImgbytesizerInstalledStub.resolves(true);

      // Cancel at target size
      showQuickPickStub.onFirstCall().resolves(undefined);
      await commands.resizeImageWithOptions(testImageUri);
      assert.ok(
        runImgbytesizerStub.notCalled,
        "Not called if target size cancelled",
      );
      runImgbytesizerStub.resetHistory(); // Reset for next sub-test
      showQuickPickStub.reset(); // Ensure fresh stubs for subsequent calls

      // Cancel at format
      showQuickPickStub.onFirstCall().resolves("1MB"); // Target size
      showQuickPickStub.onSecondCall().resolves(undefined); // Format cancelled
      await commands.resizeImageWithOptions(testImageUri);
      assert.ok(
        runImgbytesizerStub.notCalled,
        "Not called if format cancelled",
      );
      runImgbytesizerStub.resetHistory();
      showQuickPickStub.reset();
      showInputBoxStub.reset();

      // Cancel at output path
      showQuickPickStub.onFirstCall().resolves("1MB"); // Target size
      showQuickPickStub
        .onSecondCall()
        .resolves({ label: "Same", value: "same" }); // Format
      showInputBoxStub.onFirstCall().resolves(undefined); // Output path cancelled
      await commands.resizeImageWithOptions(testImageUri);
      assert.ok(
        runImgbytesizerStub.notCalled,
        "Not called if output path cancelled",
      );
    });

    test("showTargetSizeQuickPick internal: custom input validation fail should prevent proceeding", async () => {
      checkImgbytesizerInstalledStub.resolves(true);
      showQuickPickStub.onFirstCall().resolves("Custom size..."); // Select custom size
      isValidTargetSizeStub.withArgs("badsize").returns(false); // Make validation fail

      // Simulate showInputBox returning undefined because validateInput failed (user might clear or cancel)
      showInputBoxStub.onFirstCall().callsFake(async (options) => {
        if (options.validateInput) {
          const validationMessage = options.validateInput("badsize");
          assert.strictEqual(
            validationMessage,
            "Please enter a valid size (e.g., 500KB, 1.5MB)",
          );
        }
        return undefined; // Simulate user cancelling after validation error
      });

      await commands.resizeImageWithOptions(testImageUri);
      assert.ok(
        runImgbytesizerStub.notCalled,
        "runImgbytesizer should not be called after failed custom size validation",
      );
    });
  });
});
