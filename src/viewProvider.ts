import * as vscode from 'vscode';
import { ConfigLoader, DeckConfig } from './config';
import { CommandRunner } from './runner';
import { getHtml, RenderedConfig } from './webview';

export class DeckViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private config: ConfigLoader,
    private runner: CommandRunner,
  ) {
    config.onDidChange(() => this.push());
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    view.webview.html = getHtml(
      view.webview,
      this.context.extensionUri,
      this.renderedConfig(this.config.config),
    );
    view.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
  }

  private renderedConfig(c: DeckConfig): RenderedConfig {
    if (c.mode === 'floating') return { ...c, _placeholder: true };
    return c;
  }

  private push() {
    if (!this.view) return;
    this.view.webview.html = getHtml(
      this.view.webview,
      this.context.extensionUri,
      this.renderedConfig(this.config.config),
    );
  }

  private async onMessage(msg: { type: string; index?: number }) {
    if (msg.type === 'run' && typeof msg.index === 'number') {
      const btn = this.config.config.buttons[msg.index];
      if (btn) {
        await this.runner.run(btn.title, btn.commands);
        this.view?.webview.postMessage({ type: 'runDone' });
      }
    } else if (msg.type === 'openFloating') {
      vscode.commands.executeCommand('vscodeDeck.openFloating');
    } else if (msg.type === 'editConfig') {
      vscode.commands.executeCommand('vscodeDeck.editConfig');
    }
  }
}
