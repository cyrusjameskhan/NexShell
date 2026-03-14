# NexShell

A sleek PowerShell terminal wrapper with AI autocomplete, split panes, themes, and enhanced command history. Think Termius, but for local PowerShell.

## Features

- **AI Autocomplete** — Powered by Ollama (local). Suggestions appear as you type; press Tab to accept.
- **Split Panes** — Horizontal and vertical splits, like Termius or VS Code terminal.
- **7 Built-in Themes** — Midnight, Ocean, Nord, Monokai Pro, Dracula, Solarized Dark, Light.
- **Enhanced History** — Ctrl+R to fuzzy search all past commands across sessions. Persisted to disk.
- **Multi-tab Sessions** — Ctrl+Shift+T for new tabs. Each tab runs its own PowerShell process.
- **Custom Titlebar** — Frameless window with minimize/maximize/close controls.
- **Settings Panel** — Font, cursor style, scrollback, theme, and AI model configuration.
- **Status Bar** — Shows session count, shell type, theme, and AI status.

## Getting Started

```bash
# Install dependencies (rebuilds node-pty for Electron)
npm install

# Run in development mode (hot reload)
npm run dev

# Build for production
npm run build
```

## AI Autocomplete Setup

NexShell uses [Ollama](https://ollama.ai) for local AI autocomplete. No API keys, no cloud — everything runs on your machine.

```bash
# Install Ollama, then pull a model:
ollama pull codellama

# The app auto-detects Ollama when it's running.
```

You can change the model in Settings > AI.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Shift+T | New tab |
| Ctrl+R | Search command history |

## Tech Stack

- **Electron** — Desktop app shell
- **React + TypeScript** — UI
- **xterm.js** — Terminal emulation (same as VS Code)
- **node-pty** — PowerShell process management
- **Vite** — Build tooling
- **Ollama** — Local AI inference

## Architecture

```
NexShell
├── electron/          # Main process (PTY, IPC, persistence)
│   ├── main.ts        # Window management, PTY lifecycle, AI proxy
│   └── preload.ts     # Context bridge (renderer ↔ main)
├── src/               # Renderer (React UI)
│   ├── components/    # Terminal, TitleBar, TabBar, Panes, Settings, History
│   ├── themes.ts      # 7 terminal color themes
│   ├── store.ts       # Lightweight state management
│   └── types.ts       # TypeScript interfaces
└── package.json
```
