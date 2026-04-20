import * as vscode from 'vscode';
import { ConfigLoader } from './config';
import { CommandRunner } from './runner';
import { DeckViewProvider } from './viewProvider';
import { DeckPanel } from './panel';

export function activate(context: vscode.ExtensionContext) {
  const config = new ConfigLoader(context);
  const runner = new CommandRunner();
  const viewProvider = new DeckViewProvider(context, config, runner);

  context.subscriptions.push(
    config,
    runner,
    vscode.window.registerWebviewViewProvider('vscodeDeck.view', viewProvider),
    vscode.commands.registerCommand('vscodeDeck.openFloating', () => {
      DeckPanel.createOrShow(context, config, runner);
    }),
    vscode.commands.registerCommand('vscodeDeck.reload', () => {
      config.reload();
    }),
    vscode.commands.registerCommand('vscodeDeck.editConfig', () => config.openConfigFile()),
    vscode.commands.registerCommand('vscodeDeck.generateFromWorkspace', () =>
      config.generateFromWorkspace(),
    ),
  );

  if (config.config.mode === 'floating' && vscode.workspace.workspaceFolders?.length) {
    DeckPanel.createOrShow(context, config, runner);
  }
}

export function deactivate() {}
