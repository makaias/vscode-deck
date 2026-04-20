import * as fs from "fs";
import * as path from "path";
import { DeckButton, CommandStep } from "./config";

export interface PresetContext {
  root: string; // workspace folder absolute path
  dir: string; // directory being scanned (folder root or a subdir of it)
  rel: string; // posix-style path relative to root; '' when dir === root
  /**
   * Workspace folder name when the workspace has more than one folder. `null`
   * in single-folder workspaces — we use bare `${workspaceFolder}` in that case.
   */
  folder: string | null;
}

export interface WorkspaceFolderInfo {
  name: string;
  path: string;
}

export interface Preset {
  name: string;
  /** 'workspace' = only ever detected at the workspace root. Default 'project' = detected at root and in immediate subdirectories. */
  scope?: "workspace" | "project";
  /** When false, buttons are rendered uncategorized at the top. Default true. */
  categorize?: boolean;
  detect(ctx: PresetContext): boolean;
  build(ctx: PresetContext): DeckButton[];
}

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function anyFileEndsWith(dir: string, ...suffixes: string[]): boolean {
  try {
    return fs.readdirSync(dir).some((e) => suffixes.some((s) => e.endsWith(s)));
  } catch {
    return false;
  }
}

const SKIP_SUBDIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  ".vscode",
  ".idea",
  ".gradle",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".nuxt",
  ".turbo",
  ".parcel-cache",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  "bin",
  "obj",
]);

function listSubprojects(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          !SKIP_SUBDIRS.has(e.name),
      )
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export const PRESETS: Preset[] = [
  {
    name: "General",
    scope: "workspace",
    categorize: false,
    detect: () => true,
    build: () => [
      {
        title: "Save All",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>',
        commands: [
          { type: "vscode", command: "workbench.action.files.saveAll" },
        ],
      },
      {
        title: "Format",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-text-initial-icon lucide-text-initial"><path d="M15 5h6"/><path d="M15 12h6"/><path d="M3 19h18"/><path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12"/><path d="M3.92 10h6.16"/></svg>',
        commands: [{ type: "vscode", command: "editor.action.formatDocument" }],
      },
      {
        title: "Terminal",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal-icon lucide-terminal"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></svg>',
        commands: [
          { type: "vscode", command: "workbench.action.terminal.new" },
        ],
      },
      {
        title: "Chat",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bot-message-square-icon lucide-bot-message-square"><path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 11v2"/></svg>',
        commands: [{ type: "vscode", command: "claude-vscode.sidebar.open" }],
      },
    ],
  },
  {
    name: "Git",
    scope: "workspace",
    detect: (ctx) => exists(path.join(ctx.dir, ".git")),
    build: () => [
      {
        title: "Pull",
        icon: "⬇️",
        commands: [{ type: "vscode", command: "git.pull" }],
      },
      {
        title: "Push",
        icon: "⬆️",
        commands: [{ type: "vscode", command: "git.push" }],
      },
      {
        title: "Sync",
        icon: "🔄",
        commands: [{ type: "vscode", command: "git.sync" }],
      },
      {
        title: "Source Control",
        icon: "🌿",
        commands: [{ type: "vscode", command: "workbench.view.scm" }],
      },
    ],
  },
  {
    name: "NPM",
    detect: (ctx) => exists(path.join(ctx.dir, "package.json")),
    build: (ctx) => {
      const buttons: DeckButton[] = [
        {
          title: "npm install",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [{ type: "shell", command: "npm install" }],
        },
      ];
      try {
        const pkg = JSON.parse(
          fs.readFileSync(path.join(ctx.dir, "package.json"), "utf8"),
        ) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        for (const name of Object.keys(scripts)) {
          buttons.push({
            title: `npm: ${name}`,
            icon: "▶️",
            commands: [{ type: "shell", command: `npm run ${name}` }],
          });
        }
      } catch {
        /* malformed package.json — skip scripts */
      }
      return buttons;
    },
  },
  {
    name: "Yarn",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "yarn.lock")) &&
      exists(path.join(ctx.dir, "package.json")),
    build: () => [
      {
        title: "yarn install",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "yarn install" }],
      },
    ],
  },
  {
    name: "pnpm",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "pnpm-lock.yaml")) &&
      exists(path.join(ctx.dir, "package.json")),
    build: () => [
      {
        title: "pnpm install",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "pnpm install" }],
      },
    ],
  },
  {
    name: "Maven",
    detect: (ctx) => exists(path.join(ctx.dir, "pom.xml")),
    build: (ctx) => {
      const wrapper =
        exists(path.join(ctx.dir, "mvnw")) ||
        exists(path.join(ctx.dir, "mvnw.cmd"));
      const mvn =
        wrapper && process.platform === "win32"
          ? "mvnw.cmd"
          : wrapper
            ? "./mvnw"
            : "mvn";
      return [
        {
          title: "Clean",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [{ type: "shell", command: `${mvn} clean` }],
        },
        {
          title: "Compile",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
          commands: [{ type: "shell", command: `${mvn} compile` }],
        },
        {
          title: "Test",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
          commands: [{ type: "shell", command: `${mvn} test` }],
        },
        {
          title: "Package",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package-icon lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>',
          commands: [{ type: "shell", command: `${mvn} package` }],
        },
        {
          title: "Install",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [{ type: "shell", command: `${mvn} install` }],
        },
        {
          title: "Clean + Install",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [
            { type: "shell", command: `${mvn} clean` },
            { type: "shell", command: `${mvn} install` },
          ],
        },
      ];
    },
  },
  {
    name: "Gradle",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "build.gradle")) ||
      exists(path.join(ctx.dir, "build.gradle.kts")) ||
      exists(path.join(ctx.dir, "settings.gradle")) ||
      exists(path.join(ctx.dir, "settings.gradle.kts")),
    build: (ctx) => {
      const wrapper =
        exists(path.join(ctx.dir, "gradlew")) ||
        exists(path.join(ctx.dir, "gradlew.bat"));
      const g =
        wrapper && process.platform === "win32"
          ? "gradlew.bat"
          : wrapper
            ? "./gradlew"
            : "gradle";
      return [
        {
          title: "Build",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
          commands: [{ type: "shell", command: `${g} build` }],
        },
        {
          title: "Test",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
          commands: [{ type: "shell", command: `${g} test` }],
        },
        {
          title: "Clean",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [{ type: "shell", command: `${g} clean` }],
        },
        {
          title: "Run",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
          commands: [{ type: "shell", command: `${g} run` }],
        },
      ];
    },
  },
  {
    name: "Rust",
    detect: (ctx) => exists(path.join(ctx.dir, "Cargo.toml")),
    build: () => [
      {
        title: "Build",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
        commands: [{ type: "shell", command: "cargo build" }],
      },
      {
        title: "Run",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
        commands: [{ type: "shell", command: "cargo run" }],
      },
      {
        title: "Test",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
        commands: [{ type: "shell", command: "cargo test" }],
      },
      {
        title: "Check",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-check-icon lucide-square-check"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>',
        commands: [{ type: "shell", command: "cargo check" }],
      },
      {
        title: "Format",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-text-initial-icon lucide-text-initial"><path d="M15 5h6"/><path d="M15 12h6"/><path d="M3 19h18"/><path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12"/><path d="M3.92 10h6.16"/></svg>',
        commands: [{ type: "shell", command: "cargo fmt" }],
      },
      {
        title: "Clippy",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paperclip-icon lucide-paperclip"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>',
        commands: [{ type: "shell", command: "cargo clippy" }],
      },
    ],
  },
  {
    name: "Go",
    detect: (ctx) => exists(path.join(ctx.dir, "go.mod")),
    build: () => [
      {
        title: "Build",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
        commands: [{ type: "shell", command: "go build ./..." }],
      },
      {
        title: "Test",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
        commands: [{ type: "shell", command: "go test ./..." }],
      },
      {
        title: "Run",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
        commands: [{ type: "shell", command: "go run ." }],
      },
      {
        title: "Tidy",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "go mod tidy" }],
      },
      {
        title: "Vet",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>',
        commands: [{ type: "shell", command: "go vet ./..." }],
      },
    ],
  },
  {
    name: "Python",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "pyproject.toml")) ||
      exists(path.join(ctx.dir, "requirements.txt")) ||
      exists(path.join(ctx.dir, "setup.py")),
    build: (ctx) => {
      const buttons: DeckButton[] = [];
      if (exists(path.join(ctx.dir, "requirements.txt"))) {
        buttons.push({
          title: "pip install -r",
          icon: "📥",
          commands: [
            { type: "shell", command: "pip install -r requirements.txt" },
          ],
        });
      }
      if (
        exists(path.join(ctx.dir, "pyproject.toml")) ||
        exists(path.join(ctx.dir, "setup.py"))
      ) {
        buttons.push({
          title: "pip install -e .",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
          commands: [{ type: "shell", command: "pip install -e ." }],
        });
      }
      buttons.push(
        {
          title: "pytest",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
          commands: [{ type: "shell", command: "pytest" }],
        },
        {
          title: "Black",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-text-initial-icon lucide-text-initial"><path d="M15 5h6"/><path d="M15 12h6"/><path d="M3 19h18"/><path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12"/><path d="M3.92 10h6.16"/></svg>',
          commands: [{ type: "shell", command: "black ." }],
        },
        {
          title: "Ruff",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paperclip-icon lucide-paperclip"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>',
          commands: [{ type: "shell", command: "ruff check ." }],
        },
      );
      return buttons;
    },
  },
  {
    name: ".NET",
    detect: (ctx) =>
      anyFileEndsWith(ctx.dir, ".sln", ".csproj", ".fsproj", ".vbproj"),
    build: () => [
      {
        title: "Build",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
        commands: [{ type: "shell", command: "dotnet build" }],
      },
      {
        title: "Run",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play-icon lucide-play"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
        commands: [{ type: "shell", command: "dotnet run" }],
      },
      {
        title: "Test",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
        commands: [{ type: "shell", command: "dotnet test" }],
      },
      {
        title: "Clean",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "dotnet clean" }],
      },
      {
        title: "Restore",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "dotnet restore" }],
      },
    ],
  },
  {
    name: "Docker",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "Dockerfile")) ||
      exists(path.join(ctx.dir, "docker-compose.yml")) ||
      exists(path.join(ctx.dir, "docker-compose.yaml")) ||
      exists(path.join(ctx.dir, "compose.yml")) ||
      exists(path.join(ctx.dir, "compose.yaml")),
    build: (ctx) => {
      const hasCompose = [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
      ].some((f) => exists(path.join(ctx.dir, f)));
      const buttons: DeckButton[] = [];
      if (hasCompose) {
        buttons.push(
          {
            title: "Compose Up",
            icon: "🐳",
            commands: [{ type: "shell", command: "docker compose up -d" }],
          },
          {
            title: "Compose Down",
            icon: "🛑",
            commands: [{ type: "shell", command: "docker compose down" }],
          },
          {
            title: "Compose Build",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
            commands: [{ type: "shell", command: "docker compose build" }],
          },
          {
            title: "Logs",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-scroll-text-icon lucide-scroll-text"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg>',
            commands: [{ type: "shell", command: "docker compose logs -f" }],
          },
        );
      }
      if (exists(path.join(ctx.dir, "Dockerfile"))) {
        buttons.push({
          title: "Docker Build",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
          commands: [{ type: "shell", command: "docker build -t app ." }],
        });
      }
      return buttons;
    },
  },
  {
    name: "Make",
    detect: (ctx) =>
      exists(path.join(ctx.dir, "Makefile")) ||
      exists(path.join(ctx.dir, "makefile")),
    build: () => [
      {
        title: "make",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hammer-icon lucide-hammer"><path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>',
        commands: [{ type: "shell", command: "make" }],
      },
      {
        title: "make clean",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-down-to-line-icon lucide-arrow-down-to-line"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
        commands: [{ type: "shell", command: "make clean" }],
      },
      {
        title: "make test",
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-test-tube-diagonal-icon lucide-test-tube-diagonal"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></svg>',
        commands: [{ type: "shell", command: "make test" }],
      },
    ],
  },
];

function makeCwd(folder: string | null, rel: string): string | undefined {
  if (!folder && !rel) return undefined;
  const base = folder ? `\${workspaceFolder:${folder}}` : "${workspaceFolder}";
  return rel ? `${base}/${rel}` : base;
}

function withCwd(commands: CommandStep[], ctx: PresetContext): CommandStep[] {
  const cwd = makeCwd(ctx.folder, ctx.rel);
  if (!cwd) return commands;
  return commands.map((c) =>
    c.type === "shell" && !c.cwd ? { ...c, cwd } : c,
  );
}

function runPresets(
  ctx: PresetContext,
  presets: Preset[],
  categoryFor: (preset: Preset) => string | undefined,
  out: DeckButton[],
): void {
  for (const preset of presets) {
    let matched = false;
    try {
      matched = preset.detect(ctx);
    } catch {
      matched = false;
    }
    if (!matched) continue;
    let buttons: DeckButton[] = [];
    try {
      buttons = preset.build(ctx);
    } catch {
      continue;
    }
    const category = categoryFor(preset);
    for (const b of buttons) {
      const commands = withCwd(b.commands, ctx);
      const item: DeckButton = { ...b, commands };
      if (category) item.category = category;
      else delete (item as { category?: string }).category;
      out.push(item);
    }
  }
}

export function buildDefaultConfig(
  folders: WorkspaceFolderInfo[],
): DeckButton[] {
  const all: DeckButton[] = [];
  if (folders.length === 0) return all;
  const multi = folders.length > 1;
  const workspacePresets = PRESETS.filter((p) => p.scope === "workspace");
  const projectPresets = PRESETS.filter((p) => p.scope !== "workspace");

  // 1. General: emit once, using the first folder as context for the detect call.
  const general = workspacePresets.find((p) => p.name === "General");
  if (general) {
    runPresets(
      { root: folders[0].path, dir: folders[0].path, rel: "", folder: null },
      [general],
      (p) => (p.categorize === false ? undefined : p.name),
      all,
    );
  }

  // 2. Git: emit once for the first folder that has a .git directory.
  //    Git buttons use VSCode commands that act on the active editor's repo,
  //    so there's no benefit to duplicating them per folder.
  const git = workspacePresets.find((p) => p.name === "Git");
  if (git) {
    for (const folder of folders) {
      const ctx: PresetContext = {
        root: folder.path,
        dir: folder.path,
        rel: "",
        folder: null,
      };
      let matched = false;
      try {
        matched = git.detect(ctx);
      } catch {
        matched = false;
      }
      if (matched) {
        runPresets(ctx, [git], (p) => p.name, all);
        break;
      }
    }
  }

  // 3. Project presets — scanned in every workspace folder and each immediate subdir.
  for (const folder of folders) {
    const folderName = multi ? folder.name : null;

    // Folder root
    runPresets(
      { root: folder.path, dir: folder.path, rel: "", folder: folderName },
      projectPresets,
      (p) => (multi ? folder.name : p.name),
      all,
    );

    // Immediate subdirectories of the folder
    for (const sub of listSubprojects(folder.path)) {
      const dir = path.join(folder.path, sub);
      runPresets(
        { root: folder.path, dir, rel: sub, folder: folderName },
        projectPresets,
        () => (multi ? `${folder.name}/${sub}` : sub),
        all,
      );
    }
  }

  return all;
}
