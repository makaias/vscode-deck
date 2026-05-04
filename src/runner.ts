import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { CommandStep } from './config';

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
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
}

function crlf(s: string): string {
  return s.replace(/\r?\n/g, '\r\n');
}

function resolveCwd(cwd: string | undefined): string | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const firstPath = folders[0]?.uri.fsPath;
  if (!cwd) return firstPath;
  return cwd.replace(/\$\{workspaceFolder(?::([^}]+))?\}/g, (_, name?: string) => {
    if (name) {
      const match = folders.find((f) => f.name === name);
      return match ? match.uri.fsPath : '';
    }
    return firstPath ?? '';
  });
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

interface ActiveRun {
  pty?: DeckPty;
  cancelled: boolean;
}

export class CommandRunner {
  private active = new Map<string, ActiveRun>();
  private emitter = new vscode.EventEmitter<ReadonlySet<string>>();
  readonly onDidChangeRunning = this.emitter.event;

  get runningKeys(): ReadonlySet<string> {
    return new Set(this.active.keys());
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

  private fireChange() {
    this.emitter.fire(this.runningKeys);
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
      this.fireChange();
    }

    const ensurePty = (): DeckPty => {
      if (run.pty) return run.pty;
      run.pty = new DeckPty();
      const terminal = vscode.window.createTerminal({
        name: `Deck: ${label}`,
        pty: run.pty,
      });
      terminal.show(true);
      run.pty.writeLine(
        `\x1b[1m=== ${label} (${new Date().toLocaleTimeString()}) ===\x1b[0m`,
      );
      return run.pty;
    };

    let aborted = false;
    try {
      for (let i = 0; i < steps.length; i++) {
        if (run.cancelled) {
          aborted = true;
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
            aborted = true;
            break;
          }
          if (code !== 0 && !step.continueOnError) {
            const hasMore = i < steps.length - 1;
            if (hasMore) {
              p.writeLine(
                `\x1b[31m! exited with code ${code}; aborting chain\x1b[0m`,
              );
            }
            aborted = true;
            break;
          }
        }
      }
      if (!aborted) {
        run.pty?.writeLine('\x1b[32m=== done ===\x1b[0m');
      }
    } catch (err) {
      run.pty?.writeLine(`\x1b[31m! error: ${(err as Error).message}\x1b[0m`);
      vscode.window.showErrorMessage(`VSCode Deck: ${(err as Error).message}`);
    } finally {
      if (runKey) {
        this.active.delete(runKey);
        this.fireChange();
      }
    }
  }

  dispose() {
    for (const run of this.active.values()) {
      run.cancelled = true;
      run.pty?.cancelCurrent();
    }
    this.active.clear();
    this.emitter.dispose();
  }
}
