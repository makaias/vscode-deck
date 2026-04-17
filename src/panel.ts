import * as vscode from 'vscode';
import { ConfigLoader } from './config';
import { CommandRunner } from './runner';
import { getHtml } from './webview';

export class DeckPanel {
  private static current?: DeckPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    config: ConfigLoader,
    runner: CommandRunner,
  ) {
    if (DeckPanel.current) {
      DeckPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'vscodeDeck.panel',
      'Deck',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      },
    );
    DeckPanel.current = new DeckPanel(context, config, runner, panel);
    // Try to pop out to a real floating/auxiliary window.
    // This is best-effort — older VSCode versions will silently ignore it
    // and the user can still drag the editor tab out manually.
    vscode.commands
      .executeCommand('workbench.action.moveEditorToNewWindow')
      .then(undefined, () => {
        /* ignore */
      });
  }

  private constructor(
    private context: vscode.ExtensionContext,
    private config: ConfigLoader,
    private runner: CommandRunner,
    panel: vscode.WebviewPanel,
  ) {
    this.panel = panel;
    this.panel.webview.html = getHtml(
      panel.webview,
      context.extensionUri,
      config.config,
    );
    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg)),
      this.config.onDidChange((c) => {
        this.panel.webview.html = getHtml(
          this.panel.webview,
          this.context.extensionUri,
          c,
        );
      }),
    );
  }

  private async onMessage(msg: { type: string; index?: number }) {
    if (msg.type === 'run' && typeof msg.index === 'number') {
      const btn = this.config.config.buttons[msg.index];
      if (btn) this.runner.run(btn.title, btn.commands);
    } else if (msg.type === 'editConfig') {
      vscode.commands.executeCommand('vscodeDeck.editConfig');
    }
  }

  dispose() {
    DeckPanel.current = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
