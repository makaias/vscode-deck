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

export class CommandRunner {
  async run(label: string, steps: CommandStep[]): Promise<void> {
    const pty = new DeckPty();
    const terminal = vscode.window.createTerminal({
      name: `Deck: ${label}`,
      pty,
    });
    terminal.show(true);
    pty.writeLine(
      `\x1b[1m=== ${label} (${new Date().toLocaleTimeString()}) ===\x1b[0m`,
    );
    try {
      for (const step of steps) {
        if (step.type === 'vscode') {
          pty.writeLine(`\x1b[36m> vscode: ${step.command}\x1b[0m`);
          await vscode.commands.executeCommand(step.command, ...(step.args ?? []));
        } else if (step.type === 'shell') {
          const effectiveCwd = resolveCwd(step.cwd);
          const code = await pty.runCommand(step.command, effectiveCwd);
          if (code !== 0) {
            pty.writeLine(
              `\x1b[31m! exited with code ${code}; aborting chain\x1b[0m`,
            );
            return;
          }
        }
      }
      pty.writeLine('\x1b[32m=== done ===\x1b[0m');
    } catch (err) {
      pty.writeLine(`\x1b[31m! error: ${(err as Error).message}\x1b[0m`);
      vscode.window.showErrorMessage(`VSCode Deck: ${(err as Error).message}`);
    }
  }

  dispose() {
    /* terminals are owned by VSCode once created */
  }
}
