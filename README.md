# OpenContext

OpenContext is a Figma plugin that extracts selected designs and exports an **AI-ready Context Package** for coding assistants such as Claude Code, Cursor, Codex, GitHub Copilot, Gemini, and Ollama.

This project exports **design context**, not application code.

## Features

- Select one or more top-level frames, sections, components, or instances
- Choose an export target: **General** (default) or **React Native** (with React Navigation notes)
- Parse Figma nodes into a normalized, semantic data model
- Export prototype screen-to-screen links from Figma interactions
- Export a `context/` folder containing:
  - `README.md` — human-readable export summary
  - `data.json` — structured semantic design data with navigation links
  - `navigation-notes.md` — React Navigation setup guide (React Native target)
  - `assets/images/` and `assets/icons/` — exported raster and vector assets

## Tech Stack

- TypeScript
- React
- Vite
- pnpm
- Zustand
- Zod
- ESLint
- Prettier

## Project Structure

```text
src/
├── ui/           React plugin UI
├── parser/       Figma API traversal and extraction
├── translator/   Semantic, framework-agnostic mapping
├── exporters/    Extensible output generators
├── services/     Export and selection orchestration
├── hooks/        React hooks
├── utils/        Shared utilities
├── types/        Type definitions
├── constants/    Plugin constants
└── shared/       Cross-thread schemas and exports
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

This generates:

- `dist/ui.html` — plugin UI
- `dist/code.js` — plugin main thread

### Develop

```bash
pnpm dev
```

Rebuilds UI and plugin code on change.

### Lint & Format

```bash
pnpm lint
pnpm format
```

## Load in Figma

1. Run `pnpm build`
2. In Figma: **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` from this repository
4. Select frames in your file
5. Run **OpenContext**
6. Enter a project name and click **Generate Context**

The plugin downloads a `context.zip` archive containing the exported package.

## Architecture

| Layer | Responsibility |
| --- | --- |
| **Parser** | Understands the Figma API and extracts raw design data |
| **Translator** | Maps parsed data to semantic concepts (`Screen`, `Button`, `Text`, etc.) |
| **Exporters** | Consume semantic data and produce output files |
| **Services** | Coordinate selection validation and export pipeline |

Future exporters (Markdown, assets, platform-specific generators) can be added without rewriting the parser or translator.

## Output Format

```text
context/
├── README.md
├── data.json
├── navigation-notes.md   (React Native target)
└── assets/
    ├── images/
    └── icons/
```

`data.json` includes project metadata, screens, layout hierarchy, components, typography, colors, spacing, assets, prototype navigation links, platform notes, and summary counts using semantic naming — not framework-specific types.

## License

MIT
