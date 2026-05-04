import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { CommandStep } from './config';

function killPosix(pid: number, signal: NodeJS.Signals): boolean {
  // Try the negative pid first to signal the whole process group (created via
  // `detached: true` on POSIX). Fall back to the leader pid if the group
  // doesn't exist (e.g. a child that re-parented or never created a group).
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
}

function killTree(pid: number) {
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        shell: false,
        stdio: 'ignore',
      });
    } catch {
      /* ignore */
    }
    return;
  }
  // POSIX (Linux, macOS): graceful SIGTERM first; escalate to SIGKILL after a
  // grace period for processes that ignore SIGTERM. Matches the immediate-kill
  // semantics of `taskkill /T /F` on Windows when the target won't go quietly.
  if (!killPosix(pid, 'SIGTERM')) return;
  setTimeout(() => {
    try {
      // signal 0 only checks for existence — throws ESRCH if already gone.
      process.kill(pid, 0);
      killPosix(pid, 'SIGKILL');
    } catch {
      /* already exited */
    }
  }, 1000).unref();
}

// Matches `${input:name}` or `${input:name:default}`. The name captures
// anything up to a colon or closing brace; the default (optional) captures
// anything up to the closing brace, so it can include spaces and special chars.
const INPUT_RE = /\$\{input:([^:}]+)(?::([^}]*))?\}/g;

function collectInputs(
  value: unknown,
  into: Map<string, string | undefined>,
): void {
  if (typeof value === 'string') {
    INPUT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INPUT_RE.exec(value)) !== null) {
      const name = m[1];
      const def = m[2];
      if (!into.has(name)) into.set(name, def);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectInputs(v, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectInputs(v, into);
  }
}

function substituteValue<T>(value: T, values: ReadonlyMap<string, string>): T {
  if (typeof value === 'string') {
    return value.replace(INPUT_RE, (whole, name) =>
      values.has(name) ? values.get(name)! : whole,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteValue(v, values)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = substituteValue(v, values);
    }
    return out as unknown as T;
  }
  return value;
}

async function promptForInputs(
  label: string,
  inputs: Map<string, string | undefined>,
): Promise<Map<string, string> | undefined> {
  const values = new Map<string, string>();
  for (const [name, defaultValue] of inputs) {
    const value = await vscode.window.showInputBox({
      title: `Deck: ${label}`,
      prompt: name,
      value: defaultValue ?? '',
      valueSelection:
        defaultValue && defaultValue.length > 0
          ? [0, defaultValue.length]
          : undefined,
      ignoreFocusOut: true,
    });
    if (value === undefined) return undefined; // user pressed Escape
    values.set(name, value);
  }
  return values;
}

async function prepareSteps(
  steps: CommandStep[],
  label: string,
): Promise<CommandStep[] | undefined> {
  const inputs = new Map<string, string | undefined>();
  for (const step of steps) collectInputs(step, inputs);
  if (inputs.size === 0) return steps;
  const values = await promptForInputs(label, inputs);
  if (!values) return undefined;
  return steps.map((step) => substituteValue(step, values));
}

function crlf(s: string): string {
  return s.replace(/\r?\n/g, '\r\n');
}

function resolveCwd(cwd: string | undefined): string | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const firstPath = folders[0]?.uri.fsPath;
  if (!cwd) return firstPath;
  const substituted = cwd.replace(
    /\$\{workspaceFolder(?::([^}]+))?\}/g,
    (_, name?: string) => {
      if (name) {
        const match = folders.find((f) => f.name === name);
        return match ? match.uri.fsPath : '';
      }
      return firstPath ?? '';
    },
  );
  // Normalize so `${workspaceFolder}/sub` produces `c:\\path\\sub` on Windows
  // instead of mixed slashes (`c:\\path/sub`), which some tools dislike.
  return path.normalize(substituted);
}

class DeckPty implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;
  private child?: ChildProcess;
  private opened = false;
  private pending: string[] = [];

  open(): void {
    this.opened = true;
    for (const chunk of this.pending) this.writeEmitter.fire(chunk);
    this.pending = [];
  }

  close(): void {
    this.killChild();
  }

  handleInput(data: string): void {
    // Ctrl+C → cancel running command
    if (data === '\x03') {
      this.write('^C\r\n');
      this.killChild();
      return;
    }
    const c = this.child;
    if (!c || !c.stdin || c.stdin.destroyed) return;
    if (data === '\r') {
      this.write('\r\n');
      c.stdin.write('\n');
    } else if (data === '\x7f' || data === '\b') {
      this.write('\b \b');
    } else {
      this.write(data);
      c.stdin.write(data);
    }
  }

  private killChild() {
    const c = this.child;
    if (c && typeof c.pid === 'number' && !c.killed) {
      killTree(c.pid);
    }
  }

  cancelCurrent(): void {
    this.killChild();
  }

  private write(data: string) {
    if (this.opened) {
      this.writeEmitter.fire(data);
    } else {
      this.pending.push(data);
    }
  }

  writeLine(line: string) {
    this.write(line + '\r\n');
  }

  runCommand(command: string, cwd?: string): Promise<number> {
    return new Promise((resolve) => {
      this.write(`\x1b[33m> ${command}\x1b[0m\r\n`);
      const child = spawn(command, {
        cwd,
        shell: true,
        env: process.env,
        detached: process.platform !== 'win32',
      });
      this.child = child;
      child.stdout?.on('data', (d) => this.write(crlf(d.toString())));
      child.stderr?.on('data', (d) => this.write(crlf(d.toString())));
      child.on('error', (err) => {
        this.write(`\x1b[31mspawn error: ${err.message}\x1b[0m\r\n`);
        this.child = undefined;
        resolve(1);
      });
      child.on('close', (code) => {
        this.child = undefined;
        this.write(`\x1b[90m[exit ${code ?? 0}]\x1b[0m\r\n`);
        resolve(code ?? 0);
      });
    });
  }

  dispose() {
    this.killChild();
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }
}

export type RunStatus = 'success' | 'failure' | 'cancelled';

interface ActiveRun {
  pty?: DeckPty;
  cancelled: boolean;
}

interface CachedTerminal {
  pty: DeckPty;
  terminal: vscode.Terminal;
}

export class CommandRunner {
  private active = new Map<string, ActiveRun>();
  private terminals = new Map<string, CachedTerminal>();
  private lastStatuses = new Map<string, RunStatus>();
  private runningEmitter = new vscode.EventEmitter<ReadonlySet<string>>();
  private statusEmitter = new vscode.EventEmitter<ReadonlyMap<string, RunStatus>>();
  private terminalCloseListener: vscode.Disposable;
  readonly onDidChangeRunning = this.runningEmitter.event;
  readonly onDidChangeStatus = this.statusEmitter.event;

  constructor() {
    // When a user manually closes a cached terminal (the X on the tab),
    // drop it from the cache so the next run for that button creates a fresh
    // one instead of reaching for a disposed pty.
    this.terminalCloseListener = vscode.window.onDidCloseTerminal((t) => {
      for (const [key, entry] of this.terminals) {
        if (entry.terminal === t) {
          entry.pty.dispose();
          this.terminals.delete(key);
          break;
        }
      }
    });
  }

  get runningKeys(): ReadonlySet<string> {
    return new Set(this.active.keys());
  }

  get statuses(): ReadonlyMap<string, RunStatus> {
    return new Map(this.lastStatuses);
  }

  isRunning(runKey: string): boolean {
    return this.active.has(runKey);
  }

  cancel(runKey: string): boolean {
    const run = this.active.get(runKey);
    if (!run) return false;
    run.cancelled = true;
    run.pty?.cancelCurrent();
    return true;
  }

  private fireRunning() {
    this.runningEmitter.fire(this.runningKeys);
  }

  private fireStatus() {
    this.statusEmitter.fire(this.statuses);
  }

  private acquirePty(runKey: string | undefined, label: string): DeckPty {
    if (runKey) {
      const cached = this.terminals.get(runKey);
      if (cached) {
        cached.terminal.show(true);
        return cached.pty;
      }
    }
    const pty = new DeckPty();
    const terminal = vscode.window.createTerminal({ name: `Deck: ${label}`, pty });
    terminal.show(true);
    if (runKey) {
      this.terminals.set(runKey, { pty, terminal });
    }
    return pty;
  }

  async run(label: string, steps: CommandStep[], runKey?: string): Promise<void> {
    // Click-to-cancel: a run() call with the key of an already-active run cancels it.
    if (runKey && this.active.has(runKey)) {
      this.cancel(runKey);
      return;
    }

    const run: ActiveRun = { cancelled: false };
    if (runKey) {
      this.active.set(runKey, run);
      this.fireRunning();
    }

    // Collect any `${input:name}` placeholders from the chain and prompt for
    // them upfront. Returns undefined if the user pressed Escape on any prompt
    // — in that case we abort cleanly without setting a status (the chain
    // never actually started).
    const prepared = await prepareSteps(steps, label);
    if (!prepared || run.cancelled) {
      if (runKey) {
        this.active.delete(runKey);
        this.fireRunning();
      }
      return;
    }
    steps = prepared;

    const ensurePty = (): DeckPty => {
      if (run.pty) return run.pty;
      run.pty = this.acquirePty(runKey, label);
      run.pty.writeLine(
        `\x1b[1m=== ${label} (${new Date().toLocaleTimeString()}) ===\x1b[0m`,
      );
      return run.pty;
    };

    let outcome: RunStatus = 'success';
    let lastExitCode = 0;
    try {
      for (let i = 0; i < steps.length; i++) {
        if (run.cancelled) {
          outcome = 'cancelled';
          break;
        }
        const step = steps[i];
        if (step.type === 'vscode') {
          run.pty?.writeLine(`\x1b[36m> vscode: ${step.command}\x1b[0m`);
          await vscode.commands.executeCommand(step.command, ...(step.args ?? []));
        } else if (step.type === 'shell') {
          const p = ensurePty();
          const effectiveCwd = resolveCwd(step.cwd);
          const code = await p.runCommand(step.command, effectiveCwd);
          if (run.cancelled) {
            p.writeLine('\x1b[31m! cancelled\x1b[0m');
            outcome = 'cancelled';
            break;
          }
          if (code !== 0 && !step.continueOnError) {
            const hasMore = i < steps.length - 1;
            if (hasMore) {
              p.writeLine(
                `\x1b[31m! exited with code ${code}; aborting chain\x1b[0m`,
              );
            }
            outcome = 'failure';
            lastExitCode = code;
            break;
          }
        }
      }
      // Footer line — written only when a pty was actually created (i.e. at
      // least one shell step ran). Pure vscode-command chains stay silent.
      if (run.pty) {
        if (outcome === 'success') {
          run.pty.writeLine('\x1b[32m=== done ===\x1b[0m');
        } else if (outcome === 'cancelled') {
          run.pty.writeLine('\x1b[33m=== cancelled ===\x1b[0m');
        } else {
          run.pty.writeLine(`\x1b[31m=== failed (exit ${lastExitCode}) ===\x1b[0m`);
        }
      }
    } catch (err) {
      outcome = 'failure';
      run.pty?.writeLine(`\x1b[31m! error: ${(err as Error).message}\x1b[0m`);
      run.pty?.writeLine('\x1b[31m=== failed ===\x1b[0m');
      vscode.window.showErrorMessage(`VSCode Deck: ${(err as Error).message}`);
    } finally {
      if (runKey) {
        this.active.delete(runKey);
        this.lastStatuses.set(runKey, outcome);
        this.fireRunning();
        this.fireStatus();
      }
    }
  }

  dispose() {
    for (const run of this.active.values()) {
      run.cancelled = true;
      run.pty?.cancelCurrent();
    }
    this.active.clear();
    // Snapshot + clear before disposing so the onDidCloseTerminal handler
    // doesn't trip over a half-disposed cache.
    const entries = Array.from(this.terminals.values());
    this.terminals.clear();
    for (const entry of entries) {
      entry.pty.dispose();
      entry.terminal.dispose();
    }
    this.terminalCloseListener.dispose();
    this.runningEmitter.dispose();
    this.statusEmitter.dispose();
  }
}
