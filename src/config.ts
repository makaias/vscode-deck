import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { buildDefaultConfig } from './presets';

export type CommandStep =
  | { type: 'vscode'; command: string; args?: unknown[] }
  | { type: 'shell'; command: string; cwd?: string; continueOnError?: boolean };

export interface DeckButton {
  title: string;
  icon?: string;
  color?: string;
  category?: string;
  commands: CommandStep[];
}

export interface DeckConfig {
  mode: 'sidebar' | 'floating';
  columns: number;
  buttons: DeckButton[];
}

const DEFAULT_CONFIG: DeckConfig = {
  mode: 'sidebar',
  columns: 4,
  buttons: [],
};

export class ConfigLoader implements vscode.Disposable {
  private _config: DeckConfig = DEFAULT_CONFIG;
  private _watcher?: vscode.FileSystemWatcher;
  private _emitter = new vscode.EventEmitter<DeckConfig>();
  readonly onDidChange = this._emitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.reload();
    this.setupWatcher();
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('vscodeDeck.configPath')) {
          this.setupWatcher();
          this.reload();
        }
      },
      null,
      context.subscriptions,
    );
    vscode.workspace.onDidChangeWorkspaceFolders(
      () => {
        this.setupWatcher();
        this.reload();
      },
      null,
      context.subscriptions,
    );
  }

  get config(): DeckConfig {
    return this._config;
  }

  private getConfigFileUri(): vscode.Uri | undefined {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return undefined;
    const relative =
      vscode.workspace.getConfiguration('vscodeDeck').get<string>('configPath') ??
      '.vscode/deck.json';
    return vscode.Uri.joinPath(workspace.uri, relative);
  }

  async openConfigFile() {
    const uri = this.getConfigFileUri();
    if (!uri) {
      vscode.window.showErrorMessage('Open a workspace folder to edit Deck configuration.');
      return;
    }
    try {
      await fs.promises.access(uri.fsPath);
    } catch {
      await fs.promises.mkdir(path.dirname(uri.fsPath), { recursive: true });
      const seed: DeckConfig = { mode: 'sidebar', columns: 4, buttons: [] };
      await fs.promises.writeFile(uri.fsPath, JSON.stringify(seed, null, 2), 'utf8');
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  async generateFromWorkspace() {
    const uri = this.getConfigFileUri();
    if (!uri) {
      vscode.window.showErrorMessage('Open a workspace folder to generate Deck configuration.');
      return;
    }
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => ({
      name: f.name,
      path: f.uri.fsPath,
    }));
    if (folders.length === 0) {
      vscode.window.showErrorMessage('No workspace folders to scan.');
      return;
    }
    const detected = buildDefaultConfig(folders);
    if (detected.length === 0) {
      vscode.window.showInformationMessage(
        'VSCode Deck: no recognized projects detected in this workspace.',
      );
      return;
    }
    let existing: Partial<DeckConfig> = {};
    try {
      existing = JSON.parse(await fs.promises.readFile(uri.fsPath, 'utf8')) as Partial<DeckConfig>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        vscode.window.showErrorMessage(
          `VSCode Deck: couldn't read existing config: ${(err as Error).message}`,
        );
        return;
      }
    }
    const existingButtons = Array.isArray(existing.buttons) ? existing.buttons : [];
    if (existingButtons.length > 0) {
      const pick = await vscode.window.showWarningMessage(
        `Replace ${existingButtons.length} existing Deck button(s) with ${detected.length} auto-detected one(s)?`,
        { modal: true },
        'Overwrite',
      );
      if (pick !== 'Overwrite') return;
    }
    const seed: DeckConfig = {
      mode: existing.mode === 'floating' ? 'floating' : 'sidebar',
      columns: typeof existing.columns === 'number' ? existing.columns : 4,
      buttons: detected,
    };
    await fs.promises.mkdir(path.dirname(uri.fsPath), { recursive: true });
    await fs.promises.writeFile(uri.fsPath, JSON.stringify(seed, null, 2), 'utf8');
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  }

  reload() {
    const uri = this.getConfigFileUri();
    if (!uri) {
      this._config = DEFAULT_CONFIG;
      this._emitter.fire(this._config);
      return;
    }
    try {
      const text = fs.readFileSync(uri.fsPath, 'utf8');
      const parsed = JSON.parse(text) as Partial<DeckConfig>;
      this._config = {
        mode: parsed.mode === 'floating' ? 'floating' : 'sidebar',
        columns: typeof parsed.columns === 'number' ? parsed.columns : DEFAULT_CONFIG.columns,
        buttons: Array.isArray(parsed.buttons) ? parsed.buttons : [],
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        vscode.window.showErrorMessage(
          `VSCode Deck: failed to load config: ${(err as Error).message}`,
        );
      }
      this._config = DEFAULT_CONFIG;
    }
    this._emitter.fire(this._config);
  }

  private setupWatcher() {
    this._watcher?.dispose();
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return;
    const relative =
      vscode.workspace.getConfiguration('vscodeDeck').get<string>('configPath') ??
      '.vscode/deck.json';
    const pattern = new vscode.RelativePattern(workspace, relative);
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this._watcher.onDidChange(() => this.reload());
    this._watcher.onDidCreate(() => this.reload());
    this._watcher.onDidDelete(() => this.reload());
  }

  dispose() {
    this._watcher?.dispose();
    this._emitter.dispose();
  }
}
