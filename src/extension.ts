import * as vscode from 'vscode';
import { ConfigLoader, DeckButton } from './config';
import { CommandRunner } from './runner';
import { DeckViewProvider } from './viewProvider';
import { DeckPanel } from './panel';
import { DeckEditorPanel } from './editorPanel';

type RunButtonArgs =
  | string
  | { id?: string; title?: string; category?: string }
  | undefined;

function findButton(
  buttons: DeckButton[],
  args: RunButtonArgs,
): { btn: DeckButton; index: number } | undefined {
  if (args === undefined || args === null) return undefined;
  if (typeof args === 'string') {
    let idx = buttons.findIndex((b) => b.id === args);
    if (idx === -1) idx = buttons.findIndex((b) => b.title === args);
    return idx === -1 ? undefined : { btn: buttons[idx], index: idx };
  }
  if (typeof args === 'object') {
    if (args.id) {
      const idx = buttons.findIndex((b) => b.id === args.id);
      if (idx !== -1) return { btn: buttons[idx], index: idx };
    }
    if (args.title) {
      const idx = buttons.findIndex(
        (b) =>
          b.title === args.title &&
          (args.category === undefined || (b.category || '') === (args.category || '')),
      );
      if (idx !== -1) return { btn: buttons[idx], index: idx };
    }
  }
  return undefined;
}

export function activate(context: vscode.ExtensionContext) {
  const config = new ConfigLoader(context);
  const runner = new CommandRunner();
  const viewProvider = new DeckViewProvider(context, config, runner);

  context.subscriptions.push(
    config,
    runner,
    vscode.window.registerWebviewViewProvider('vscodeDeck.view', viewProvider),
    vscode.commands.registerCommand('vscodeDeck.show', () =>
      vscode.commands.executeCommand('vscodeDeck.view.focus'),
    ),
    vscode.commands.registerCommand('vscodeDeck.openFloating', () => {
      DeckPanel.createOrShow(context, config, runner);
    }),
    vscode.commands.registerCommand('vscodeDeck.reload', () => {
      config.reload();
    }),
    vscode.commands.registerCommand('vscodeDeck.editConfig', () => config.openConfigFile()),
    vscode.commands.registerCommand('vscodeDeck.editButtons', () => {
      DeckEditorPanel.createOrShow(context, config);
    }),
    vscode.commands.registerCommand('vscodeDeck.generateFromWorkspace', () =>
      config.generateFromWorkspace(),
    ),
    vscode.commands.registerCommand('vscodeDeck.runButton', (args: RunButtonArgs) => {
      const target = findButton(config.config.buttons, args);
      if (!target) {
        const label =
          typeof args === 'string'
            ? `"${args}"`
            : args && typeof args === 'object'
              ? JSON.stringify(args)
              : '(missing)';
        vscode.window.showErrorMessage(
          `VSCode Deck: no button matching ${label}. Set "args" in your keybinding to a button title or id.`,
        );
        return;
      }
      runner.run(target.btn.title, target.btn.commands, String(target.index));
    }),
  );

  if (config.config.mode === 'floating' && vscode.workspace.workspaceFolders?.length) {
    DeckPanel.createOrShow(context, config, runner);
  }
}

export function deactivate() {}
