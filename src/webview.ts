import * as path from 'path';
import * as vscode from 'vscode';
import { DeckConfig, DeckButton } from './config';

export interface RenderedConfig extends DeckConfig {
  _placeholder?: boolean;
}

const IMG_EXT_RE = /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i;

/**
 * If `icon` looks like a local file path that should be loaded via
 * `webview.asWebviewUri`, returns the absolute filesystem path. Returns
 * undefined for emoji/text/inline SVG/data URIs/HTTP(S) URLs.
 */
export function resolveLocalIconPath(icon: string): string | undefined {
  const trimmed = icon.trim();
  if (!trimmed) return undefined;
  if (/^<svg[\s>]/i.test(trimmed)) return undefined;
  if (/^(https?|data|file):/i.test(trimmed)) return undefined;
  if (path.isAbsolute(trimmed)) return trimmed;
  if (/^\.{1,2}[\\/]/.test(trimmed) || /^\\\\/.test(trimmed)) {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsRoot) return undefined;
    return path.resolve(wsRoot, trimmed);
  }
  // Bare path with image extension (e.g. "icons/build.png" — no leading "./")
  if (IMG_EXT_RE.test(trimmed) && /[\\/]/.test(trimmed)) {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsRoot) return undefined;
    return path.resolve(wsRoot, trimmed);
  }
  return undefined;
}

function rewriteIcon(webview: vscode.Webview, button: DeckButton): DeckButton {
  if (typeof button.icon !== 'string') return button;
  const local = resolveLocalIconPath(button.icon);
  if (!local) return button;
  const uri = webview.asWebviewUri(vscode.Uri.file(local));
  return { ...button, icon: uri.toString() };
}

/**
 * Returns the directories that need to be in `webview.options.localResourceRoots`
 * for local-file icons to load. Always includes every workspace folder; adds
 * the parent dir of each icon path that resolves outside the workspace.
 */
export function getIconResourceRoots(
  extensionUri: vscode.Uri,
  config: RenderedConfig,
): vscode.Uri[] {
  const dirs = new Map<string, vscode.Uri>();
  const mediaDir = vscode.Uri.joinPath(extensionUri, 'media');
  dirs.set(mediaDir.fsPath, mediaDir);
  for (const f of vscode.workspace.workspaceFolders ?? []) {
    if (!dirs.has(f.uri.fsPath)) dirs.set(f.uri.fsPath, f.uri);
  }
  for (const btn of config.buttons || []) {
    if (typeof btn.icon !== 'string') continue;
    const local = resolveLocalIconPath(btn.icon);
    if (!local) continue;
    const dir = path.dirname(local);
    if (!dirs.has(dir)) dirs.set(dir, vscode.Uri.file(dir));
  }
  return Array.from(dirs.values());
}

export function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  config: RenderedConfig,
  running: ReadonlySet<string> = new Set(),
): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'main.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'main.css'),
  );
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `img-src ${webview.cspSource} https: data:`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  const bodyStyle =
    typeof config.iconSize === 'number' && config.iconSize > 0
      ? ` style="--deck-icon-size: ${config.iconSize}px"`
      : '';
  // Replace local-file icon paths with webview URIs the browser can actually load.
  const rendered: RenderedConfig = {
    ...config,
    buttons: (config.buttons || []).map((b) => rewriteIcon(webview, b)),
  };
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${styleUri}">
</head>
<body${bodyStyle}>
<div id="root"></div>
<script nonce="${nonce}">
window.__deckConfig = ${JSON.stringify(rendered)};
window.__deckRunning = ${JSON.stringify(Array.from(running))};
</script>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}
