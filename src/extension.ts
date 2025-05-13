import vscode from 'vscode';

import * as commands from './commands';

export function activate(context: vscode.ExtensionContext) {
  // Register the image resize command
  const resizeImageCommand = vscode.commands.registerCommand(
    'imgbytesizer.resizeImage',
    (uri?: vscode.Uri) => commands.resizeImage(uri)
  );

  // Register the image resize with options command
  const resizeImageWithOptionsCommand = vscode.commands.registerCommand(
    'imgbytesizer.resizeImageWithOptions',
    (uri?: vscode.Uri) => commands.resizeImageWithOptions(uri)
  );

  // Add commands to context
  context.subscriptions.push(resizeImageCommand);
  context.subscriptions.push(resizeImageWithOptionsCommand);

  // Log activation
  console.log('Extension "imgbytesizer" is now active!');
}

export function deactivate() {
  // Cleanup if needed
}
