# VSCode Deck

A Stream Deck–style button grid for VSCode. Configure buttons in a JSON file, click them to run VSCode commands or shell commands — singly or as sequential chains. Works in a sidebar panel or a floating window.

Designed as a single place to collect the commands you run the most: `mvn clean install`, `npm run dev`, `git pull`, "save all + format", opening tools, kicking off deploy scripts, whatever you wish your IDE had a one-click button for.

---

## Features

- **Sidebar or floating window** — pick your layout in the config.
- **VSCode commands and shell commands** in the same button, chained sequentially.
- **Real terminal for shell commands** — full `Ctrl+C` support, interactive stdin, proper shell quoting on Windows and Unix.
- **Parallel execution** — each button press spawns its own named terminal; clicking again while one is running just opens another.
- **Lazy terminal** — buttons that run only VSCode commands (e.g. Save All) execute silently without opening a terminal.
- **Collapsible categories** — group related buttons under headers that remember their state across sessions.
- **Overflow-scroll on hover** — long titles automatically slide to reveal the rest when you hover.
- **Workspace-aware auto-detection** — a command scans every workspace folder (and each folder's immediate subdirectories) for recognized project types and generates a starter config.
- **Multi-root workspace support** — each workspace folder becomes its own category with the correct `cwd` injected.
- **Flexible icons** — emojis, image URLs, local paths, or inline SVG (with theme-aware `currentColor` support).

---

## Installation

This isn't on the marketplace. To run locally:

```
git clone https://github.com/makaias/vscode-deck.git
cd vscode-deck
npm install
```

Open the folder in VSCode and press **F5** — that launches an Extension Development Host window with the extension loaded. The Deck icon (a grid) appears in the Activity Bar.

To package for sideloading:

```
npx @vscode/vsce package
```

That produces a `.vsix` you can install via **Extensions: Install from VSIX…** in the command palette.

---

## Getting started

1. Click the **Deck** icon in the Activity Bar (grid icon). The sidebar opens empty.
2. Run **`Deck: Generate Configuration from Workspace`** from the command palette (`Ctrl+Shift+P`). This scans your workspace and writes a starter `.vscode/deck.json` with buttons tailored to the tools it finds.
3. Or run **`Deck: Edit Configuration`** to open an empty `.vscode/deck.json` and author buttons yourself.

The config file is watched — saves are picked up instantly, no reload required.

---

## Configuration

The config lives at **`.vscode/deck.json`** (relative to the first workspace folder). Path is overridable via the `vscodeDeck.configPath` setting.

### Minimal config

```json
{
  "mode": "sidebar",
  "columns": 4,
  "buttons": []
}
```

### Full example

```json
{
  "mode": "sidebar",
  "columns": 4,
  "buttons": [
    {
      "title": "Save All",
      "icon": "💾",
      "commands": [
        { "type": "vscode", "command": "workbench.action.files.saveAll" }
      ]
    },
    {
      "title": "Maven Clean + Install",
      "icon": "📦",
      "color": "#d97706",
      "category": "Build",
      "commands": [
        { "type": "shell", "command": "mvn clean" },
        { "type": "shell", "command": "mvn install" }
      ]
    },
    {
      "title": "Dead Code",
      "icon": "🧹",
      "category": "Checks",
      "commands": [
        {
          "type": "shell",
          "command": "npm run knip",
          "continueOnError": true
        }
      ]
    }
  ]
}
```

### Top-level fields

| Field     | Type                        | Default     | Description                                                                                         |
|-----------|-----------------------------|-------------|-----------------------------------------------------------------------------------------------------|
| `mode`    | `"sidebar"` \| `"floating"` | `"sidebar"` | `sidebar` renders the grid in the Activity Bar panel. `floating` shows a placeholder with a button to open a popped-out window. |
| `columns` | number                      | `4`         | Number of buttons per row.                                                                          |
| `buttons` | `DeckButton[]`              | `[]`        | The buttons.                                                                                        |

### Button fields

| Field      | Type                                       | Required | Description                                                                                   |
|------------|--------------------------------------------|----------|-----------------------------------------------------------------------------------------------|
| `title`    | string                                     | yes      | Shown under the icon.                                                                         |
| `icon`     | string                                     | no       | Emoji/text, image URL/path, or inline SVG. See [Icons](#icons).                              |
| `color`    | CSS color                                  | no       | Overrides the top border accent color (the thin strip at the top of the button).              |
| `category` | string                                     | no       | Groups this button under a collapsible category header. Omit for a flat, ungrouped layout.    |
| `commands` | `CommandStep[]`                            | yes      | Ordered list of steps run when the button is clicked. Each step completes before the next.    |

### Command step fields

Two step types, discriminated by `type`:

**`vscode`** — runs a VSCode command via `executeCommand`.

| Field     | Type            | Required | Description                                                                 |
|-----------|-----------------|----------|-----------------------------------------------------------------------------|
| `type`    | `"vscode"`      | yes      | Discriminator.                                                              |
| `command` | string          | yes      | The command ID, e.g. `workbench.action.files.saveAll`.                     |
| `args`    | array           | no       | Arguments passed to `executeCommand`.                                       |

**`shell`** — runs a shell command.

| Field              | Type       | Required | Description                                                                                                                     |
|--------------------|------------|----------|---------------------------------------------------------------------------------------------------------------------------------|
| `type`             | `"shell"`  | yes      | Discriminator.                                                                                                                  |
| `command`          | string     | yes      | The shell command line, exactly as you'd type it.                                                                               |
| `cwd`              | string     | no       | Working directory. Supports `${workspaceFolder}` and `${workspaceFolder:<name>}`. Defaults to the first workspace folder.       |
| `continueOnError`  | boolean    | no       | When `true`, a non-zero exit code does **not** abort the chain. Use for linters/checkers that exit non-zero to signal findings. |

---

## Commands

Available from the command palette (`Ctrl+Shift+P`):

| Command                                              | Description                                                                                                                               |
|------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `Deck: Edit Configuration`                           | Opens `.vscode/deck.json`, creating an empty one if it doesn't exist.                                                                     |
| `Deck: Generate Configuration from Workspace`        | Scans all workspace folders and immediate subdirectories, then writes a tailored config. Prompts before overwriting existing buttons.     |
| `Deck: Reload Configuration`                         | Force-reloads the config file (normally automatic via file watcher).                                                                      |
| `Deck: Open in Floating Window`                      | Opens the deck in a webview panel that you can drag to a separate OS window.                                                              |

---

## Icons

The `icon` field accepts any of these:

```json
{ "icon": "💾" }
```
Emoji or plain text, rendered as-is.

```json
{ "icon": "https://example.com/build.svg" }
```
URL to an image (http, https, or `data:` URI).

```json
{ "icon": "./icons/build.png" }
```
Relative or absolute file path.

```json
{
  "icon": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 5v14\"/><path d=\"M5 12h14\"/></svg>"
}
```
Inline SVG. Sized automatically to 28×28. For theme-aware icons, use `fill="currentColor"` (filled-style) or `stroke="currentColor"` with `fill="none"` (outline-style, e.g. Lucide, Feather, Tabler). Explicit colors in `<path>` are preserved.

---

## Categories

Any button with a non-empty `category` goes into a collapsible section named after that category. Buttons without a category render first in a flat grid above all sections.

```json
{
  "buttons": [
    { "title": "Save All", "icon": "💾", "commands": [...] },
    { "title": "Build",    "icon": "🔨", "category": "Maven", "commands": [...] },
    { "title": "Install",  "icon": "📦", "category": "Maven", "commands": [...] },
    { "title": "Test",     "icon": "🧪", "category": "NPM",   "commands": [...] }
  ]
}
```

Renders as:

```
[Save All]

▾ MAVEN
  [Build]   [Install]

▾ NPM
  [Test]
```

Click a category header to collapse/expand it. The collapsed state is remembered per-category across config edits and window reloads.

---

## Auto-detection: `Deck: Generate Configuration from Workspace`

Running the generate command scans the workspace and produces buttons for every project type it recognizes. Each scanned directory becomes its own category with the correct `cwd` injected.

### What it scans

1. **Every workspace folder** in the current workspace (supports multi-root workspaces).
2. **Each folder's immediate subdirectories** (skipping `node_modules`, `dist`, `target`, `.git`, `.venv`, etc.).

### Recognized project types

| Category | Detected by                                                               | Buttons                                                                   |
|----------|---------------------------------------------------------------------------|---------------------------------------------------------------------------|
| General  | always                                                                    | Save All, Format, Terminal, Command Palette                               |
| Git      | `.git/` directory                                                         | Pull, Push, Sync, Source Control                                          |
| NPM      | `package.json`                                                            | `npm install` + one button per script in `scripts`                        |
| Yarn     | `yarn.lock` + `package.json`                                              | `yarn install`                                                            |
| pnpm     | `pnpm-lock.yaml` + `package.json`                                         | `pnpm install`                                                            |
| Maven    | `pom.xml` (uses `./mvnw` / `mvnw.cmd` when a wrapper is present)          | Clean, Compile, Test, Package, Install, Clean + Install                   |
| Gradle   | `build.gradle(.kts)` / `settings.gradle(.kts)` (prefers `gradlew`)        | Build, Test, Clean, Run                                                   |
| Rust     | `Cargo.toml`                                                              | Build, Run, Test, Check, Format, Clippy                                   |
| Go       | `go.mod`                                                                  | Build, Test, Run, Tidy, Vet                                               |
| Python   | `pyproject.toml` / `requirements.txt` / `setup.py`                        | pip install, pytest, Black, Ruff                                          |
| .NET     | any `*.sln` / `*.csproj` / `*.fsproj` / `*.vbproj`                        | Build, Run, Test, Clean, Restore                                          |
| Docker   | `Dockerfile` / `docker-compose.yml` / `compose.yml`                       | Compose Up / Down / Build / Logs and/or Docker Build                      |
| Make     | `Makefile`                                                                | `make`, `make clean`, `make test`                                         |

### Example: multi-root workspace

```
root-workspace.code-workspace
├── frontend/      (package.json, Vue.js)
├── coordinator/   (pom.xml, Java)
└── autogluon/     (pyproject.toml, Python)
```

After running the generate command, you get categories:
- **General** (uncategorized Save All / Format / Terminal / Command Palette)
- **Git**
- **frontend** — `npm install` plus one button per script in `frontend/package.json`, each with `cwd: "${workspaceFolder:frontend}"`
- **coordinator** — Maven lifecycle buttons, each with `cwd: "${workspaceFolder:coordinator}"`
- **autogluon** — pytest / Black / Ruff / pip install, each with `cwd: "${workspaceFolder:autogluon}"`

### Safety

- The command **never overwrites** without asking. If `deck.json` already has buttons, you get a modal confirmation before they're replaced.
- `mode` and `columns` from your existing config are preserved.
- Your workspace files are never modified — only `.vscode/deck.json`.

---

## Shell command details

### Where output goes

Each button press spawns a **named terminal** like `Deck: Maven Clean + Install`. Output streams live, exactly as if you'd typed the command. Interactive commands (anything that reads stdin) work.

### Ctrl+C

Focus the terminal and press Ctrl+C — sends SIGINT to the running process and its entire process tree (so `npm run build` doesn't leave an orphan `node` compiler behind). On Windows this uses `taskkill /T /F`; on Unix it signals the process group.

When cancelled, the exit code is non-zero and the chain aborts (unless `continueOnError: true`).

### Chain abort behavior

If a shell step exits non-zero, later steps in the same button don't run. The terminal shows:

```
[exit 1]
! exited with code 1; aborting chain
```

Except:

- When the failing step is the **last** step, the "aborting chain" line is suppressed (there's nothing to abort).
- When the step has **`continueOnError: true`**, a non-zero exit is accepted and the next step runs anyway.

### Working directory

`cwd` supports two VSCode-style placeholders:

- `${workspaceFolder}` — the first workspace folder.
- `${workspaceFolder:<name>}` — a specific folder by name in a multi-root workspace.

You can also combine them with subdirectory paths: `"cwd": "${workspaceFolder:frontend}/packages/app"`.

### Shell quoting

Shell commands run via `child_process.spawn` with `shell: true`, which on Windows invokes `cmd.exe /d /s /c "<command>"` — the `/s` flag preserves inner quotes correctly for command lines with multiple quoted paths, e.g.:

```json
{ "type": "shell", "command": "\"C:\\tools\\mvn\\bin\\mvn\" install -f \"C:\\Projects\\app\\pom.xml\"" }
```

---

## Example recipes

### Save and format in one click

```json
{
  "title": "Save & Format",
  "icon": "✨",
  "commands": [
    { "type": "vscode", "command": "editor.action.formatDocument" },
    { "type": "vscode", "command": "workbench.action.files.saveAll" }
  ]
}
```

### Maven clean-install for a monorepo subfolder

```json
{
  "title": "Coordinator: CI",
  "icon": "📦",
  "category": "Coordinator",
  "commands": [
    { "type": "shell", "command": "mvn clean", "cwd": "${workspaceFolder:coordinator}" },
    { "type": "shell", "command": "mvn install", "cwd": "${workspaceFolder:coordinator}" }
  ]
}
```

### Lint that only warns, never fails

```json
{
  "title": "Lint",
  "icon": "📎",
  "commands": [
    {
      "type": "shell",
      "command": "npm run lint",
      "continueOnError": true
    }
  ]
}
```

### Dev server in the frontend subfolder

```json
{
  "title": "Frontend Dev",
  "icon": "▶️",
  "category": "frontend",
  "commands": [
    {
      "type": "shell",
      "command": "npm run dev",
      "cwd": "${workspaceFolder}/frontend"
    }
  ]
}
```

### Open a specific tool's sidebar

```json
{
  "title": "Source Control",
  "icon": "🌿",
  "commands": [
    { "type": "vscode", "command": "workbench.view.scm" }
  ]
}
```

### Build + test + deploy chain

```json
{
  "title": "Ship It",
  "icon": "🚀",
  "color": "#10b981",
  "commands": [
    { "type": "shell",  "command": "npm run build" },
    { "type": "shell",  "command": "npm test" },
    { "type": "shell",  "command": "npm run deploy" },
    { "type": "vscode", "command": "workbench.action.terminal.focus" }
  ]
}
```

If build or tests fail, deploy doesn't run — the chain aborts with the failing step's exit code.

---

## Settings

| Setting                  | Default              | Description                                                                          |
|--------------------------|----------------------|--------------------------------------------------------------------------------------|
| `vscodeDeck.configPath`  | `.vscode/deck.json`  | Path to the configuration file, relative to the first workspace folder.              |

---

## Finding VSCode command IDs

To find the ID of a VSCode command (for `"type": "vscode"` steps):

1. **Keyboard Shortcuts**: `Ctrl+K Ctrl+S`, search for the action, right-click → **Copy Command ID**.
2. **Commands palette source**: some extensions list their commands in `package.json`; browsing an extension's source on GitHub shows them under `contributes.commands`.
3. **Running extensions**: `Ctrl+Shift+P` → **Developer: Show Running Extensions** to confirm an extension is loaded and inspect its namespace.

Common built-in IDs:

- `workbench.action.files.saveAll`
- `workbench.action.files.save`
- `editor.action.formatDocument`
- `workbench.action.terminal.new`
- `workbench.action.terminal.toggleTerminal`
- `workbench.action.showCommands`
- `workbench.view.explorer` / `workbench.view.scm` / `workbench.view.debug`
- `workbench.action.reloadWindow`
- `git.pull` / `git.push` / `git.sync` / `git.commit`

---

## Limitations

- Buttons are a flat list within each category — no nested sub-categories.
- Auto-detection scans the workspace root and one level of subdirectories. Nested projects (e.g. `frontend/packages/app`) require manual configuration.
- The config lives in the first workspace folder's `.vscode/` even in multi-root workspaces (matching the VSCode convention for `tasks.json` and `launch.json`).
- Shell step quoting follows Node's `child_process.spawn({ shell: true })` rules. On Windows this is `cmd.exe /d /s /c`. If you need a different shell, wrap explicitly, e.g. `"command": "pwsh -c \"Get-Process\""`.

---

## License

MIT.
