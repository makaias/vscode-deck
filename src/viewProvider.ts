import * as vscode from 'vscode';
import { ConfigLoader, DeckConfig } from './config';
import { CommandRunner } from './runner';
import { getHtml, getIconResourceRoots, RenderedConfig } from './webview';

export class DeckViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private config: ConfigLoader,
    private runner: CommandRunner,
  ) {
    context.subscriptions.push(
      config.onDidChange(() => this.push()),
      runner.onDidChangeRunning((keys) => this.pushRunState(keys)),
      runner.onDidChangeStatus((statuses) => this.pushStatuses(statuses)),
    );
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    this.applyOptions();
    view.webview.html = getHtml(
      view.webview,
      this.context.extensionUri,
      this.renderedConfig(this.config.config),
      this.runner.runningKeys,
      this.runner.statuses,
    );
    view.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
  }

  private applyOptions() {
    if (!this.view) return;
    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: getIconResourceRoots(
        this.context.extensionUri,
        this.renderedConfig(this.config.config),
      ),
    };
  }

  private renderedConfig(c: DeckConfig): RenderedConfig {
    if (c.mode === 'floating') return { ...c, _placeholder: true };
    return c;
  }

  private push() {
    if (!this.view) return;
    this.applyOptions();
    this.view.webview.html = getHtml(
      this.view.webview,
      this.context.extensionUri,
      this.renderedConfig(this.config.config),
      this.runner.runningKeys,
      this.runner.statuses,
    );
  }

  private pushRunState(keys: ReadonlySet<string>) {
    this.view?.webview.postMessage({ type: 'runState', running: Array.from(keys) });
  }

  private pushStatuses(statuses: ReadonlyMap<string, import('./runner').RunStatus>) {
    this.view?.webview.postMessage({
      type: 'statuses',
      statuses: Array.from(statuses),
    });
  }

  private async onMessage(msg: { type: string; index?: number; key?: string }) {
    if (msg.type === 'run' && typeof msg.index === 'number') {
      const btn = this.config.config.buttons[msg.index];
      if (btn) this.runner.run(btn.title, btn.commands, String(msg.index));
    } else if (msg.type === 'cancel' && typeof msg.key === 'string') {
      this.runner.cancel(msg.key);
    } else if (msg.type === 'openFloating') {
      vscode.commands.executeCommand('vscodeDeck.openFloating');
    } else if (msg.type === 'editConfig') {
      vscode.commands.executeCommand('vscodeDeck.editConfig');
    } else if (msg.type === 'editButtons') {
      vscode.commands.executeCommand('vscodeDeck.editButtons');
    }
  }
}
