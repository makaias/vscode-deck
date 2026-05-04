import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigLoader, DeckConfig } from './config';
import { getEditorHtml } from './editorWebview';
import { getIconResourceRoots, resolveLocalIconPath } from './webview';

interface IncomingMessage {
  type: string;
  config?: DeckConfig;
  text?: string;
  toast?: string;
  raw?: string;
}

export class DeckEditorPanel {
  private static current?: DeckEditorPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private iconResourceDirs = new Set<string>();

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
    this.applyOptions();
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

  private applyOptions() {
    const baseRoots = getIconResourceRoots(
      this.context.extensionUri,
      this.config.config,
    );
    const extraRoots = Array.from(this.iconResourceDirs).map((d) =>
      vscode.Uri.file(d),
    );
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [...baseRoots, ...extraRoots],
    };
  }

  private pushConfig() {
    this.applyOptions();
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
      this.config.reload();
      this.pushConfig();
    } else if (msg.type === 'copyToClipboard' && typeof msg.text === 'string') {
      await vscode.env.clipboard.writeText(msg.text);
      vscode.window.showInformationMessage(
        msg.toast || 'VSCode Deck: copied to clipboard.',
      );
    } else if (msg.type === 'openKeybindings') {
      vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
    } else if (msg.type === 'resolveIcon' && typeof msg.raw === 'string') {
      const local = resolveLocalIconPath(msg.raw);
      let resolved: string | null = null;
      if (local) {
        const dir = path.dirname(local);
        if (!this.iconResourceDirs.has(dir)) {
          this.iconResourceDirs.add(dir);
          this.applyOptions();
        }
        resolved = this.panel.webview.asWebviewUri(vscode.Uri.file(local)).toString();
      }
      this.panel.webview.postMessage({
        type: 'iconResolved',
        raw: msg.raw,
        resolved,
      });
    }
  }

  dispose() {
    DeckEditorPanel.current = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
