# Changelog

## 0.1.0

- **JSON schema for `.vscode/deck.json`** — IntelliSense, type-checking, hover docs, and an inline color picker via `contributes.jsonValidation`. Catches typos like `commmand` at edit time.
- **Running indicator with click-to-cancel** — buttons show a spinner with a dimmed icon while their commands execute. Hover reveals a red stop square; clicking a running button kills the process tree and aborts the chain.
- **Visual editor** (`Deck: Edit Buttons (Visual)`) — drag-and-drop reorder within and across categories, ▲▼ arrows for category and step ordering, inline category rename (with merge-on-duplicate), `+ New category` / `+ Add button` affordances, live icon and color preview, native color picker, explicit save with dirty indicator and Ctrl/Cmd+S.
- **Per-button keybindings** — new `vscodeDeck.runButton` command takes a button id or title (or `{ id, title, category }` object). Bind any button in `keybindings.json`. The visual editor includes a "Copy keybinding" button that puts a ready-to-paste snippet on your clipboard. New optional `id` field on buttons for stable identifiers that survive title renames.
- **`vscodeDeck.show`** — focuses the deck sidebar; bindable to a keyboard shortcut.

## 0.0.1

Initial release.
