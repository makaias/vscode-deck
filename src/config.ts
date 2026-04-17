import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type CommandStep =
  | { type: 'vscode'; command: string; args?: unknown[] }
  | { type: 'shell'; command: string; cwd?: string };

export interface DeckButton {
  title: string;
  icon?: string;
  color?: string;
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

const EXAMPLE_CONFIG: DeckConfig = {
  mode: 'sidebar',
  columns: 4,
  buttons: [
    {
      title: 'Save All',
      icon: '💾',
      commands: [{ type: 'vscode', command: 'workbench.action.files.saveAll' }],
    },
    {
      title: 'Maven Clean + Install',
      icon: '📦',
      color: '#d97706',
      commands: [
        { type: 'shell', command: 'mvn clean' },
        { type: 'shell', command: 'mvn install' },
      ],
    },
    {
      title: 'NPM Build',
      icon: '🔨',
      commands: [{ type: 'shell', command: 'npm run build' }],
    },
    {
      title: 'Open Terminal',
      icon: '⌨️',
      commands: [{ type: 'vscode', command: 'workbench.action.terminal.new' }],
    },
  ],
};

export class ConfigLoader implements vscode.Disposable {
  private _config: DeckConfig = DEFAULT_CONFIG;
  private _watcher?: vscode.FileSystemWatcher;
  private _emitter = new vscode.EventEmitter<DeckConfig>();
  readonly onDidChange = this._emitter.event;

  constructor(private context: vscode.ExtensionContext) {
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
      await fs.promises.writeFile(
        uri.fsPath,
        JSON.stringify(EXAMPLE_CONFIG, null, 2),
        'utf8',
      );
    }
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
