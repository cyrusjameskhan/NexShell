export interface ThemeEffects {
  scanlines?: boolean
  scanlineOpacity?: number
  filmGrain?: boolean
  filmGrainOpacity?: number
  vhsTearing?: boolean
  crtGlow?: boolean
  crtGlowColor?: string
  crtGlowIntensity?: number
  flicker?: boolean
  flickerIntensity?: number
  /** CSS filter applied to the entire app root to tint all UI elements */
  postProcessFilter?: string
  /** Extra CSS injected globally when this theme is active */
  globalCss?: string
}

export interface TerminalTheme {
  id: string
  name: string
  category?: 'extra'
  isLight?: boolean
  effects?: ThemeEffects
  colors: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
  ui: {
    bg: string
    bgSecondary: string
    bgTertiary: string
    border: string
    text: string
    textMuted: string
    textDim: string
    accent: string
    accentHover: string
    accentMuted: string
    danger: string
    success: string
    warning: string
    tabActive: string
    tabInactive: string
    sidebar: string
    titlebar: string
    inputBg: string
    inputBorder: string
    inputFocus: string
    scrollbar: string
    scrollbarHover: string
    shadow: string
  }
}

// A single PTY session
export interface TerminalSession {
  id: string
  name: string
  pid?: number
  isActive: boolean
  createdAt: number
}

// Recursive split tree — each node is either a leaf (terminal) or a branch (split)
export type SplitNode =
  | { type: 'leaf'; sessionId: string | null }  // null = empty drop slot
  | { type: 'split'; direction: 'horizontal' | 'vertical'; children: SplitNode[] }

export interface Workspace {
  id: string
  name: string
  root: SplitNode
  activePaneSessionId: string
}

// A tab is either a plain session or a workspace
export type Tab =
  | { kind: 'session'; sessionId: string }
  | { kind: 'workspace'; workspaceId: string }

export interface AppSettings {
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  aiModel: string
  aiEnabled: boolean
  aiProvider: 'ollama' | 'lmstudio' | 'custom'
  aiEndpoint: string
  aiApiKey: string
  /** API format for custom provider: auto-detect, force OpenAI, or force Ollama */
  aiApiFormat: 'auto' | 'openai' | 'ollama'
  shell: string
  agentCommand: string
  /** Max number of session logs to keep. -1 = unlimited */
  logRetention: number
  /** Window opacity 0.1–1.0 */
  opacity: number
  /** Keep the window above all others */
  alwaysOnTop: boolean
  /** UI scale factor 0.75–1.5 (default 1.0) */
  uiScale: number
}

export type SidePanelSection = 'hosts' | 'agents' | 'variables' | 'snippets' | 'logs' | 'libraries'

export interface SessionLog {
  id: string
  sessionName: string
  startedAt: number
  endedAt: number
  exitCode: number | null
  /** ANSI-stripped output tail (last ~2KB) */
  outputTail: string
  shell: string
}

export interface LibraryTool {
  id: string
  name: string
  category: string
  description: string
  /** command to check if installed, e.g. "git --version" */
  checkCmd: string
  /** fallback commands to try if checkCmd fails (e.g. known install paths not in PATH) */
  checkCmdFallbacks?: string[]
  /** platform-aware install commands */
  installCmds: { win?: string; mac?: string; linux?: string }
  homepage?: string
}

export type SshHostOs = 'linux' | 'ubuntu' | 'debian' | 'centos' | 'fedora' | 'alpine' | 'arch' | 'macos' | 'freebsd' | 'windows' | 'redhat' | 'raspberrypi'

export interface SshHost {
  id: string
  label: string
  host: string
  port: number
  user: string
  password?: string
  identityFile?: string
  tags?: string[]
  lastConnected?: number
  notes?: string
  detectedOs?: SshHostOs
}

export interface SshKey {
  id: string
  name: string
  /** Absolute path to the private key file */
  path: string
  /** Optional comment / description */
  comment?: string
  /** Public key fingerprint — populated when we can read it */
  fingerprint?: string
  addedAt: number
}

export interface EnvVariable {
  id: string
  key: string
  value: string
  enabled: boolean
  secret: boolean
}

export interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface SftpEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modTime: number
}

export interface SftpConnectOpts {
  host: string
  port: number
  user: string
  password?: string
  identityFile?: string
}

declare global {
  interface Window {
    api: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      setFullScreen: (flag: boolean) => void
      createPty: (sessionId: string, cols: number, rows: number, sessionName?: string) => Promise<{ pid: number } | void>
      writePty: (sessionId: string, data: string) => void
      resizePty: (sessionId: string, cols: number, rows: number) => void
      killPty: (sessionId: string) => void
      onPtyData: (sessionId: string, callback: (data: string) => void) => () => void
      onPtyExit: (sessionId: string, callback: (exitCode: number) => void) => () => void
      getHistory: () => Promise<string[]>
      addHistory: (cmd: string) => Promise<void>
      searchHistory: (query: string) => Promise<string[]>
      clearHistory: () => Promise<void>
      aiComplete: (prompt: string, context: string, model: string, nlMode?: boolean) => Promise<string | null>
      aiCheck: (endpoint?: string) => Promise<{ available: boolean; models: string[] }>
      aiChatStream: (sessionId: string, messages: { role: string; content: string }[]) => Promise<void>
      aiChatAbort: (sessionId: string) => Promise<void>
      aiStartInteractiveChat: (sessionId: string) => Promise<void>
      aiStopInteractiveChat: (sessionId: string) => Promise<void>
      aiChatSendDirect: (sessionId: string, message: string) => Promise<void>
      onLlmData: (sessionId: string, callback: (data: string) => void) => () => void
      onLlmDone: (sessionId: string, callback: () => void) => () => void
      getTheme: () => Promise<TerminalTheme | null>
      setTheme: (theme: TerminalTheme) => Promise<void>
      getSettings: () => Promise<AppSettings | null>
      setSettings: (settings: AppSettings) => Promise<void>
      setOpacity: (opacity: number) => Promise<void>
      setAlwaysOnTop: (flag: boolean) => Promise<void>
      getSidebarState: () => Promise<{ section: SidePanelSection | null; width: number } | null>
      setSidebarState: (state: { section: SidePanelSection | null; width: number }) => Promise<void>
      getHosts: () => Promise<SshHost[]>
      setHosts: (hosts: SshHost[]) => Promise<void>
      getKeys: () => Promise<SshKey[]>
      setKeys: (keys: SshKey[]) => Promise<void>
      generateKey: (opts: { type: string; bits: number; filename: string; comment: string; passphrase: string }) => Promise<{ success: true; path: string } | { success: false; error: string }>
      getVariables: () => Promise<EnvVariable[]>
      setVariables: (vars: EnvVariable[]) => Promise<void>
      openSystemVariables: () => Promise<void>
      getSnippets: () => Promise<Snippet[]>
      setSnippets: (snippets: Snippet[]) => Promise<void>
      sftpConnect: (opts: SftpConnectOpts) => Promise<{ id: string } | { error: string }>
      sftpDisconnect: (id: string) => Promise<void>
      sftpList: (id: string, remotePath: string) => Promise<SftpEntry[] | { error: string }>
      sftpDownload: (id: string, remotePath: string, localDir: string, fileName: string) => Promise<{ ok: true } | { error: string }>
      sftpUpload: (id: string, localPath: string, remotePath: string) => Promise<{ ok: true } | { error: string }>
      sftpMkdir: (id: string, remotePath: string) => Promise<{ ok: true } | { error: string }>
      sftpDelete: (id: string, remotePath: string) => Promise<{ ok: true } | { error: string }>
      sftpRealpath: (id: string, remotePath: string) => Promise<{ path: string } | { error: string }>
      sftpRename: (id: string, oldPath: string, newPath: string) => Promise<{ ok: true } | { error: string }>
      localList: (dirPath: string) => Promise<{ resolvedPath: string; entries: SftpEntry[] } | { error: string }>
      localRename: (oldPath: string, newPath: string) => Promise<{ ok: true } | { error: string }>
      localDelete: (filePath: string) => Promise<{ ok: true } | { error: string }>
      localMkdir: (dirPath: string) => Promise<{ ok: true } | { error: string }>
      showOpenDialog: (options: { properties: string[]; defaultPath?: string; title?: string }) => Promise<string[] | null>
      showSaveDialog: (options: { defaultPath?: string; title?: string }) => Promise<string | null>
      checkTool: (cmd: string | string[]) => Promise<{ installed: boolean; version: string | null }>
      invalidateLibraryPathCache: () => Promise<void>
      installTool: (sessionId: string, cmd: string) => Promise<void>
      checkAgentConfigured: (configPath: string) => Promise<boolean>
      openExternal: (url: string) => Promise<void>
      getLogs: () => Promise<SessionLog[]>
      addLog: (log: SessionLog) => Promise<void>
      deleteLog: (id: string) => Promise<void>
      clearLogs: () => Promise<void>
      onLogAdded: (callback: () => void) => () => void
    }
  }
}
