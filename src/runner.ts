import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { CommandStep } from './config';

export class CommandRunner {
  private output = vscode.window.createOutputChannel('VSCode Deck');
  private running = false;

  async run(label: string, steps: CommandStep[]): Promise<void> {
    if (this.running) {
      vscode.window.showWarningMessage('VSCode Deck: a button is already running.');
      return;
    }
    this.running = true;
    this.output.show(true);
    this.output.appendLine(`\n=== ${label} (${new Date().toLocaleTimeString()}) ===`);
    try {
      for (const step of steps) {
        if (step.type === 'vscode') {
          this.output.appendLine(`> vscode: ${step.command}`);
          await vscode.commands.executeCommand(step.command, ...(step.args ?? []));
        } else if (step.type === 'shell') {
          const code = await this.runShell(step.command, step.cwd);
          if (code !== 0) {
            this.output.appendLine(`! exited with code ${code}; aborting chain`);
            vscode.window.showErrorMessage(
              `VSCode Deck: "${label}" failed at: ${step.command}`,
            );
            return;
          }
        }
      }
      this.output.appendLine('=== done ===');
    } catch (err) {
      this.output.appendLine(`! error: ${(err as Error).message}`);
      vscode.window.showErrorMessage(`VSCode Deck: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private runShell(command: string, cwd?: string): Promise<number> {
    return new Promise((resolve) => {
      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const effectiveCwd = cwd
        ? cwd.replace('${workspaceFolder}', workspace ?? '')
        : workspace;
      this.output.appendLine(
        `> shell: ${command}${effectiveCwd ? `  (cwd: ${effectiveCwd})` : ''}`,
      );
      const child = spawn(command, {
        cwd: effectiveCwd,
        shell: true,
        env: process.env,
      });
      child.stdout.on('data', (d) => this.output.append(d.toString()));
      child.stderr.on('data', (d) => this.output.append(d.toString()));
      child.on('error', (err) => {
        this.output.appendLine(`! spawn error: ${err.message}`);
        resolve(1);
      });
      child.on('close', (code) => resolve(code ?? 0));
    });
  }

  dispose() {
    this.output.dispose();
  }
}
