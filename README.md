# NexShell

A sleek, local-first terminal emulator with AI autocomplete, split panes, SSH/SFTP, and a built-in AI agents catalog. Works with PowerShell, bash, zsh, and any shell your OS provides — free and open source.

## Features

- **AI Autocomplete** — Powered by Ollama, LM Studio, or any OpenAI-compatible API. Suggestions appear as you type; press Tab to accept. Supports natural language → command mode.
- **Split Panes** — Horizontal and vertical splits with drag-and-drop rearrangement.
- **17 Built-in Themes** — Midnight, Ocean, Nord, Monokai Pro, Dracula, Solarized Dark, Matrix, Red Hacker, Cyberpunk Blue, Deep Purple, Synthwave, Catppuccin Mocha, Tokyo Night, Gruvbox Dark, One Dark Pro, Rosé Pine, Ayu Dark, Light.
- **Enhanced History** — Ctrl+R fuzzy search across all past commands, persisted to disk (up to 5,000 entries).
- **Multi-tab Sessions** — Ctrl+Shift+T for new tabs. Each tab runs its own independent shell process (PowerShell on Windows, zsh/bash on macOS/Linux).
- **SSH Host Manager** — Save and connect to SSH profiles with password or identity file authentication.
- **SFTP Client** — Dual-pane SFTP file browser with upload, download, rename, delete, and mkdir support.
- **SSH Key Manager** — Store references to local key files with fingerprint display.
- **Environment Variables Manager** — Define per-session env vars injected into every new shell.
- **AI Agents Catalog** — Browse, install, and launch popular AI coding agents (Claude Code, Codex CLI, Aider, OpenHands, Gemini CLI, Amazon Q, Goose, Continue, and more).
- **Command Snippets** — Save and reuse frequently used commands.
- **Custom Titlebar** — Frameless window with minimize/maximize/close controls.
- **Settings Panel** — Font, cursor style, scrollback, theme, and AI configuration.
- **Status Bar** — Shows session count, shell type, theme, and AI connectivity status.

## Getting Started

```bash
# Install dependencies (rebuilds node-pty for Electron)
npm install

# Run in development mode (hot reload)
npm run electron:dev

# Build for production
npm run build
```

## AI Autocomplete Setup

NexShell uses [Ollama](https://ollama.ai) for local AI autocomplete by default. No API keys, no cloud — everything runs on your machine.

```bash
# Install Ollama, then pull a model:
ollama pull codellama

# The app auto-detects Ollama at http://localhost:11434
```

You can also point NexShell at any OpenAI-compatible endpoint (LM Studio, etc.) in Settings > AI. An optional API key field is provided for hosted endpoints.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Shift+T | New tab |
| Ctrl+R | Fuzzy search command history |
| Ctrl++ / Ctrl+- | Increase / decrease font size |
| Ctrl+0 | Reset font size |
| Tab | Accept AI autocomplete suggestion |

## Tech Stack

- **Electron** — Desktop app shell
- **React 19 + TypeScript** — UI
- **xterm.js** — Terminal emulation (same as VS Code)
- **node-pty** — Cross-platform shell process management
- **ssh2** — SSH and SFTP
- **Vite** — Build tooling
- **Ollama / OpenAI-compatible API** — Local AI inference

## Architecture

```
NexShell
├── electron/
│   ├── main.ts        # Window, PTY lifecycle, AI proxy, SSH/SFTP, persistence
│   └── preload.ts     # Context bridge (renderer ↔ main, nodeIntegration: false)
├── src/
│   ├── components/    # Terminal, TitleBar, TabBar, Panes, Settings, History, SFTP, SidePanel
│   │   └── sidepanel/ # Agents, Hosts, Keys, Variables, Snippets, Libraries, Logs
│   ├── themes.ts      # 17 terminal color themes
│   ├── store.ts       # Lightweight pub/sub state + split-pane tree logic
│   └── types.ts       # TypeScript interfaces + window.api declaration
└── package.json
```

## Security Note

SSH passwords saved in the SSH host manager are stored in plaintext in your local app data folder (`%APPDATA%/NexShell/ssh-hosts.json` on Windows). They never leave your machine.

## License

NexShell is licensed under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the GPL v3. Any derivative work must also be distributed under the GPL v3.

## Trademark

"NexShell" is a trademark of Cyrus James Khan Hauri. You may not use the name "NexShell" to identify forks, derivative products, or commercial offerings without written permission.
