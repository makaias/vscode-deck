# Changelog

## Unreleased

- **Input prompts in commands** — `${input:name}` and `${input:name:default}` placeholders in any string field (shell `command`, shell `cwd`, vscode `args`) prompt the user when the button is clicked. Same name used multiple times in a chain prompts only once. Pressing Escape on any prompt aborts the chain cleanly.
- **Search & filter** — both the deck (sidebar/floating) and the editor have a search bar that filters buttons by title, id, and category in real time. Categories with no matches are hidden; collapsed categories with matches expand automatically while the search is active. Deck-side query is persisted across reloads.
- **Last-run status indicator** — small green/red/yellow dot in each button's top-right corner showing the last run's outcome (success/failure/cancelled). Hidden during runs (the spinner takes over). Terminal output also gains a colored footer (`=== done ===` / `=== failed (exit N) ===` / `=== cancelled ===`).
- **Terminal reuse per button** — repeated clicks on the same button reuse one terminal instead of spawning a new one each time. The terminal pty is preserved across runs (including cancels). Manually closing a cached terminal drops it from the cache; next run creates a fresh one.
- **Local-file icons that actually load** — `"icon": "./icons/build.png"` and similar paths now resolve through `webview.asWebviewUri()` and `localResourceRoots`, so the README's claim that local paths work is finally true. Icons outside the workspace are supported too (their parent dirs are added to the resource roots dynamically).
- **Cross-platform reliability** — POSIX kill escalates to `SIGKILL` after a 1-second grace period if a process ignores `SIGTERM`, matching the immediate-kill semantics of Windows `taskkill /T /F`. `cwd` substitution normalizes mixed forward/backward slashes on Windows.

## 0.1.0

- **JSON schema for `.vscode/deck.json`** — IntelliSense, type-checking, hover docs, and an inline color picker via `contributes.jsonValidation`. Catches typos like `commmand` at edit time.
- **Running indicator with click-to-cancel** — buttons show a spinner with a dimmed icon while their commands execute. Hover reveals a red stop square; clicking a running button kills the process tree and aborts the chain.
- **Visual editor** (`Deck: Edit Buttons (Visual)`) — drag-and-drop reorder within and across categories, ▲▼ arrows for category and step ordering, inline category rename (with merge-on-duplicate), `+ New category` / `+ Add button` affordances, live icon and color preview, native color picker, explicit save with dirty indicator and Ctrl/Cmd+S.
- **Per-button keybindings** — new `vscodeDeck.runButton` command takes a button id or title (or `{ id, title, category }` object). Bind any button in `keybindings.json`. The visual editor includes a "Copy keybinding" button that puts a ready-to-paste snippet on your clipboard. New optional `id` field on buttons for stable identifiers that survive title renames.
- **`vscodeDeck.show`** — focuses the deck sidebar; bindable to a keyboard shortcut.

## 0.0.1

Initial release.
