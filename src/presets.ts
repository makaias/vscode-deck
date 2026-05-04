import * as fs from "fs";
import * as path from "path";
import { DeckButton, CommandStep } from "./config";
import { ICONS } from "./icons";

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
        icon: ICONS.save,
        commands: [
          { type: "vscode", command: "workbench.action.files.saveAll" },
        ],
      },
      {
        title: "Format",
        icon: ICONS.textInitial,
        commands: [{ type: "vscode", command: "editor.action.formatDocument" }],
      },
      {
        title: "Terminal",
        icon: ICONS.terminal,
        commands: [
          { type: "vscode", command: "workbench.action.terminal.new" },
        ],
      },
      {
        title: "Chat",
        icon: ICONS.botMessageSquare,
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
        icon: ICONS.arrowDownToLine,
        commands: [{ type: "vscode", command: "git.pull" }],
      },
      {
        title: "Push",
        icon: ICONS.arrowUpFromLine,
        commands: [{ type: "vscode", command: "git.push" }],
      },
      {
        title: "Sync",
        icon: ICONS.refreshCcv,
        commands: [{ type: "vscode", command: "git.sync" }],
      },
      {
        title: "Source Control",
        icon: ICONS.gitBranch,
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
          icon: ICONS.arrowDownToLine,
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
        icon: ICONS.arrowDownToLine,
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
        icon: ICONS.arrowDownToLine,
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
          icon: ICONS.arrowDownToLine,
          commands: [{ type: "shell", command: `${mvn} clean` }],
        },
        {
          title: "Compile",
          icon: ICONS.hammer,
          commands: [{ type: "shell", command: `${mvn} compile` }],
        },
        {
          title: "Test",
          icon: ICONS.testTubeDiagonal,
          commands: [{ type: "shell", command: `${mvn} test` }],
        },
        {
          title: "Package",
          icon: ICONS.package,
          commands: [{ type: "shell", command: `${mvn} package` }],
        },
        {
          title: "Install",
          icon: ICONS.arrowDownToLine,
          commands: [{ type: "shell", command: `${mvn} install` }],
        },
        {
          title: "Clean + Install",
          icon: ICONS.arrowDownToLine,
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
          icon: ICONS.hammer,
          commands: [{ type: "shell", command: `${g} build` }],
        },
        {
          title: "Test",
          icon: ICONS.testTubeDiagonal,
          commands: [{ type: "shell", command: `${g} test` }],
        },
        {
          title: "Clean",
          icon: ICONS.arrowDownToLine,
          commands: [{ type: "shell", command: `${g} clean` }],
        },
        {
          title: "Run",
          icon: ICONS.play,
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
        icon: ICONS.hammer,
        commands: [{ type: "shell", command: "cargo build" }],
      },
      {
        title: "Run",
        icon: ICONS.play,
        commands: [{ type: "shell", command: "cargo run" }],
      },
      {
        title: "Test",
        icon: ICONS.testTubeDiagonal,
        commands: [{ type: "shell", command: "cargo test" }],
      },
      {
        title: "Check",
        icon: ICONS.squareCheck,
        commands: [{ type: "shell", command: "cargo check" }],
      },
      {
        title: "Format",
        icon: ICONS.textInitial,
        commands: [{ type: "shell", command: "cargo fmt" }],
      },
      {
        title: "Clippy",
        icon: ICONS.paperclip,
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
        icon: ICONS.hammer,
        commands: [{ type: "shell", command: "go build ./..." }],
      },
      {
        title: "Test",
        icon: ICONS.testTubeDiagonal,
        commands: [{ type: "shell", command: "go test ./..." }],
      },
      {
        title: "Run",
        icon: ICONS.play,
        commands: [{ type: "shell", command: "go run ." }],
      },
      {
        title: "Tidy",
        icon: ICONS.arrowDownToLine,
        commands: [{ type: "shell", command: "go mod tidy" }],
      },
      {
        title: "Vet",
        icon: ICONS.search,
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
          icon: ICONS.arrowDownToLine,
          commands: [{ type: "shell", command: "pip install -e ." }],
        });
      }
      buttons.push(
        {
          title: "pytest",
          icon: ICONS.testTubeDiagonal,
          commands: [{ type: "shell", command: "pytest" }],
        },
        {
          title: "Black",
          icon: ICONS.textInitial,
          commands: [{ type: "shell", command: "black ." }],
        },
        {
          title: "Ruff",
          icon: ICONS.paperclip,
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
        icon: ICONS.hammer,
        commands: [{ type: "shell", command: "dotnet build" }],
      },
      {
        title: "Run",
        icon: ICONS.play,
        commands: [{ type: "shell", command: "dotnet run" }],
      },
      {
        title: "Test",
        icon: ICONS.testTubeDiagonal,
        commands: [{ type: "shell", command: "dotnet test" }],
      },
      {
        title: "Clean",
        icon: ICONS.arrowDownToLine,
        commands: [{ type: "shell", command: "dotnet clean" }],
      },
      {
        title: "Restore",
        icon: ICONS.arrowDownToLine,
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
            icon: ICONS.hammer,
            commands: [{ type: "shell", command: "docker compose build" }],
          },
          {
            title: "Logs",
            icon: ICONS.scrollText,
            commands: [{ type: "shell", command: "docker compose logs -f" }],
          },
        );
      }
      if (exists(path.join(ctx.dir, "Dockerfile"))) {
        buttons.push({
          title: "Docker Build",
          icon: ICONS.hammer,
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
        icon: ICONS.hammer,
        commands: [{ type: "shell", command: "make" }],
      },
      {
        title: "make clean",
        icon: ICONS.arrowDownToLine,
        commands: [{ type: "shell", command: "make clean" }],
      },
      {
        title: "make test",
        icon: ICONS.testTubeDiagonal,
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
