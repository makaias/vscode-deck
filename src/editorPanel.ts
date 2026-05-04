import * as vscode from 'vscode';
import { ConfigLoader, DeckConfig } from './config';
import { getEditorHtml } from './editorWebview';

interface IncomingMessage {
  type: string;
  config?: DeckConfig;
}

export class DeckEditorPanel {
  private static current?: DeckEditorPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(context: vscode.ExtensionContext, config: ConfigLoader) {
    if (DeckEditorPanel.current) {
      DeckEditorPanel.current.panel.reveal();
      DeckEditorPanel.current.pushConfig();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'vscodeDeck.editor',
      'Deck Editor',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      },
    );
    DeckEditorPanel.current = new DeckEditorPanel(context, config, panel);
  }

  private constructor(
    private context: vscode.ExtensionContext,
    private config: ConfigLoader,
    panel: vscode.WebviewPanel,
  ) {
    this.panel = panel;
    this.panel.webview.html = getEditorHtml(
      panel.webview,
      context.extensionUri,
      config.config,
    );
    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.webview.onDidReceiveMessage((msg: IncomingMessage) => this.onMessage(msg)),
    );
  }

  private pushConfig() {
    this.panel.webview.postMessage({ type: 'config', config: this.config.config });
  }

  private async onMessage(msg: IncomingMessage) {
    if (msg.type === 'save' && msg.config) {
      try {
        await this.config.saveConfig(msg.config);
        this.panel.webview.postMessage({ type: 'saved' });
      } catch (err) {
        const message = (err as Error).message;
        vscode.window.showErrorMessage(`Deck Editor: ${message}`);
        this.panel.webview.postMessage({ type: 'saveError', message });
      }
    } else if (msg.type === 'reload') {
      this.config.reload();
      this.pushConfig();
    } else if (msg.type === 'editJson') {
      vscode.commands.executeCommand('vscodeDeck.editConfig');
    } else if (msg.type === 'generateFromWorkspace') {
      await vscode.commands.executeCommand('vscodeDeck.generateFromWorkspace');
      // generateFromWorkspace writes the file; pull the fresh config in
      this.config.reload();
      this.pushConfig();
    }
  }

  dispose() {
    DeckEditorPanel.current = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
