import { app, BrowserWindow, ipcMain, nativeTheme, dialog, shell } from 'electron'
import path from 'path'
import os from 'os'
import { execFile, execSync } from 'child_process'

// Enable GPU compositing optimizations for smoother rendering
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-frame-rate-limit')

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'icon.ico')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  })

  // Uncap frame rate for smooth rendering
  mainWindow.webContents.setFrameRate(144)

  // Prevent Electron's built-in page zoom so Ctrl+Scroll/+/- only
  // changes the terminal font size via our renderer-side handler
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.control && !input.alt && !input.meta) {
      if (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '0') {
        mainWindow!.webContents.setZoomLevel(0)
      }
    }
  })
  mainWindow.webContents.setZoomLevel(0)
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Window controls ──
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.on('window:setFullScreen', (_event, flag: boolean) => mainWindow?.setFullScreen(flag))
ipcMain.handle('window:setOpacity', (_event, opacity: number) => {
  if (mainWindow) mainWindow.setOpacity(Math.max(0.1, Math.min(1, opacity)))
})
ipcMain.handle('window:setAlwaysOnTop', (_event, flag: boolean) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(flag)
})


// ── PTY Management ──
import * as pty from 'node-pty'

interface PtySession {
  process: pty.IPty
  history: string[]
  sessionName: string
  startedAt: number
  shell: string
  outputTail: string
}

const sessions = new Map<string, PtySession>()

function stripAnsiMain(s: string): string {
  return s
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;?]*[~@]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b[()][0-9A-Z]/g, '')
    .replace(/\x1b[^[\]()][A-Z0-9]?/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

function writeSessionLog(sessionId: string, session: PtySession, exitCode: number | null) {
  try {
    const logs = loadLogs()
    logs.push({
      id: `log-${sessionId}-${Date.now()}`,
      sessionName: session.sessionName,
      startedAt: session.startedAt,
      endedAt: Date.now(),
      exitCode,
      outputTail: session.outputTail,
      shell: session.shell,
    })
    saveLogs(logs)
    mainWindow?.webContents.send('logs:added')
  } catch (e) {
    console.error('[Logs] writeSessionLog failed:', e)
  }
}

function getShell(): string {
  return process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
}

ipcMain.handle('pty:create', (_event, sessionId: string, cols = 120, rows = 30, sessionName = 'Shell Session') => {
  const shell = getShell()

  const userVars = loadVariables()
  const extraEnv: Record<string, string> = {}
  for (const v of userVars) {
    if (v.enabled && v.key) extraEnv[v.key] = v.value ?? ''
  }

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: { ...process.env as Record<string, string>, ...extraEnv },
  })

  sessions.set(sessionId, {
    process: ptyProcess,
    history: [],
    sessionName,
    startedAt: Date.now(),
    shell,
    outputTail: '',
  })

  ptyProcess.onData((data: string) => {
    if (interactiveChats.has(sessionId)) return
    mainWindow?.webContents.send(`pty:data:${sessionId}`, data)
    const session = sessions.get(sessionId)
    if (session) {
      const clean = stripAnsiMain(data)
      if (clean.trim()) {
        session.outputTail += clean
        if (session.outputTail.length > 4000) {
          session.outputTail = session.outputTail.slice(-2000)
        }
      }
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send(`pty:exit:${sessionId}`, exitCode)
    const session = sessions.get(sessionId)
    if (session) {
      writeSessionLog(sessionId, session, exitCode ?? null)
      sessions.delete(sessionId)
    }
  })

  return { pid: ptyProcess.pid }
})

ipcMain.on('pty:write', (_event, sessionId: string, data: string) => {
  if (interactiveChats.has(sessionId)) {
    ipcMain.emit('ai:chatInput', _event, sessionId, data)
    return
  }
  const session = sessions.get(sessionId)
  if (session) {
    session.process.write(data)
  }
})

ipcMain.on('pty:resize', (_event, sessionId: string, cols: number, rows: number) => {
  const session = sessions.get(sessionId)
  if (session) {
    session.process.resize(cols, rows)
  }
})

ipcMain.on('pty:kill', (_event, sessionId: string) => {
  const session = sessions.get(sessionId)
  if (session) {
    // Write log before killing — onExit fires async and may race with deletion
    writeSessionLog(sessionId, session, null)
    sessions.delete(sessionId)
    session.process.kill()
  }
})

// ── Command History ──
import fs from 'fs'

const historyPath = path.join(app.getPath('userData'), 'command-history.json')

function loadHistory(): string[] {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
}

function saveHistory(history: string[]) {
  fs.writeFileSync(historyPath, JSON.stringify(history.slice(-5000), null, 2))
}

ipcMain.handle('history:get', () => loadHistory())

ipcMain.handle('history:add', (_event, command: string) => {
  const trimmed = command.trim()
  if (!trimmed) return
  const history = loadHistory()
  const lastEntry = history[history.length - 1]
  if (lastEntry !== trimmed) {
    history.push(trimmed)
    saveHistory(history)
  }
})

ipcMain.handle('history:search', (_event, query: string) => {
  const history = loadHistory()
  if (!query) return history.slice(-50).reverse()
  const lower = query.toLowerCase()
  return history
    .filter(cmd => cmd.toLowerCase().includes(lower))
    .slice(-50)
    .reverse()
})

ipcMain.handle('history:clear', () => {
  saveHistory([])
})

// ── Ollama AI Autocomplete / NL Command Generator ──

// Map commands to the file extensions they typically operate on.
// Used to bias AI completions toward relevant filenames.
const CMD_EXT_MAP: Record<string, string[]> = {
  python:  ['py'], python3: ['py'], py:      ['py'],
  node:    ['js', 'mjs', 'cjs', 'ts'], ts_node: ['ts'], tsx: ['tsx'],
  deno:    ['ts', 'js', 'tsx', 'jsx'],
  bun:     ['ts', 'js', 'tsx', 'jsx'],
  bash:    ['sh'], sh: ['sh'], zsh: ['sh'], './': ['sh'],
  ruby:    ['rb'], irb: ['rb'],
  perl:    ['pl'],
  lua:     ['lua'],
  java:    ['java'], javac: ['java'],
  rustc:   ['rs'], cargo: ['rs'],
  go:      ['go'],
  gcc:     ['c', 'cpp', 'h'], 'g++': ['cpp', 'c', 'h'], cc: ['c', 'cpp'],
  cat:     [], less: [], more: [], head: [], tail: [], vi: [], vim: [], nano: [], code: [],
}

type ApiFormat = 'ollama' | 'openai'

function loadAiSettings(): { endpoint: string; apiKey: string; provider: string; model: string; format: ApiFormat } {
  try {
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const endpoint = (s?.aiEndpoint ?? 'http://localhost:11434').replace(/\/$/, '')
      const provider = s?.aiProvider ?? 'ollama'
      const model = s?.aiModel ?? 'codellama'
      const explicitFormat = s?.aiApiFormat ?? 'auto'
      const format = resolveApiFormat(endpoint, provider, explicitFormat)
      return { endpoint, apiKey: s?.aiApiKey ?? '', provider, model, format }
    }
  } catch { /* ignore */ }
  return { endpoint: 'http://localhost:11434', apiKey: '', provider: 'ollama', model: 'codellama', format: 'ollama' }
}

function resolveApiFormat(endpoint: string, provider: string, explicit: 'auto' | 'openai' | 'ollama'): ApiFormat {
  if (explicit === 'openai' || explicit === 'ollama') return explicit
  return detectApiFormat(endpoint, provider)
}

function detectApiFormat(endpoint: string, provider: string): ApiFormat {
  if (provider === 'ollama' || provider === 'lmstudio') return 'ollama'
  if (/\/v1(\/|$)/.test(endpoint) || /\/chat\/completions/i.test(endpoint)) return 'openai'
  return 'openai'
}

function buildChatUrl(endpoint: string, format: ApiFormat): string {
  if (format === 'openai') {
    if (/\/chat\/completions\s*$/i.test(endpoint)) return endpoint
    return endpoint.replace(/\/+$/, '') + '/chat/completions'
  }
  return endpoint + '/api/chat'
}

function buildModelsUrl(endpoint: string, format: ApiFormat): string {
  if (format === 'openai') {
    const base = endpoint.replace(/\/chat\/completions\s*$/i, '').replace(/\/+$/, '')
    return base + '/models'
  }
  return endpoint + '/api/tags'
}

function parseModelsResponse(data: any, format: ApiFormat): string[] {
  if (format === 'openai') {
    return data.data?.map((m: any) => m.id) || []
  }
  return data.models?.map((m: any) => m.name) || []
}

function parseChatResponse(data: any, format: ApiFormat): string {
  if (format === 'openai') {
    return data.choices?.[0]?.message?.content ?? ''
  }
  return data.message?.content ?? ''
}

function parseStreamChunk(parsed: any, format: ApiFormat): { content: string; done: boolean } {
  if (format === 'openai') {
    const delta = parsed.choices?.[0]?.delta?.content ?? ''
    const done = parsed.choices?.[0]?.finish_reason === 'stop' || !!parsed.choices?.[0]?.finish_reason
    return { content: delta, done }
  }
  return { content: parsed.message?.content ?? '', done: !!parsed.done }
}

function buildChatBody(model: string, messages: any[], stream: boolean, format: ApiFormat, extraOptions?: any): any {
  if (format === 'openai') {
    return { model, messages, stream, ...(extraOptions?.temperature != null ? { temperature: extraOptions.temperature } : {}), ...(extraOptions?.max_tokens != null ? { max_tokens: extraOptions.max_tokens } : {}) }
  }
  const body: any = { model, messages, stream }
  if (extraOptions) body.options = extraOptions
  return body
}

function loadAiEndpoint(): string {
  return loadAiSettings().endpoint
}

ipcMain.handle('ai:complete', async (_event, prompt: string, context: string, model: string, nlMode = false) => {
  try {
    const resolvedModel = model || 'codellama'
    const os = process.platform === 'win32' ? 'Windows (PowerShell)' : process.platform === 'darwin' ? 'macOS (zsh)' : 'Linux (bash)'

    const ctxBlock = context ? `\n\nTerminal context:\n${context.slice(-600)}` : ''

    // Extract real filenames from context (not IPs, not version numbers).
    // Must start with a letter/underscore and have a known file extension.
    const fileExts = 'py|js|ts|tsx|jsx|sh|md|txt|log|json|yaml|yml|toml|cfg|conf|ini|csv|xml|html|css|zip|tar|gz|bz2|rs|go|c|cpp|h|java|rb|pl|lua|sql|env|lock|bat|ps1'
    const filePattern = new RegExp(`\\b([a-zA-Z_][a-zA-Z0-9_.\\-]*\\.(?:${fileExts}))\\b`, 'g')
    const filesInCtx: string[] = []
    if (context) {
      let m: RegExpExecArray | null
      while ((m = filePattern.exec(context)) !== null) {
        if (!filesInCtx.includes(m[1])) filesInCtx.push(m[1])
      }
    }

    // Determine the command being typed to filter filenames by relevant extension
    const promptCmd = prompt.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
    const preferredExts = CMD_EXT_MAP[promptCmd] ?? []

    // If we know which extensions this command wants, filter and sort so
    // matching files appear first (and only matching files get used for examples)
    let relevantFiles = filesInCtx
    if (preferredExts.length > 0) {
      const matching = filesInCtx.filter(f =>
        preferredExts.some(ext => f.toLowerCase().endsWith('.' + ext))
      )
      if (matching.length > 0) relevantFiles = matching
    }

    // Also check if the last word of the prompt partially matches any relevant filename
    const promptWords = prompt.trim().split(/\s+/)
    const lastWord = promptWords[promptWords.length - 1] ?? ''
    const fileHint = lastWord.length >= 2
      ? relevantFiles.filter(f => f.toLowerCase().startsWith(lastWord.toLowerCase()))
      : []

    // Build a few-shot example using a matching file from context
    const ctxExample = relevantFiles.length > 0
      ? (() => {
          // Prefer a file that matches the partial the user is typing
          const f = fileHint[0] ?? relevantFiles[0]
          const partial = f.slice(0, Math.max(3, Math.ceil(f.length / 2)))
          const exCmd = promptCmd || 'cat'
          return [
            { role: 'user', content: `Partial: ${exCmd} ${partial}` },
            { role: 'assistant', content: `${exCmd} ${f}` },
          ]
        })()
      : []

    // Build a hint about available files to steer the model
    const fileListHint = relevantFiles.length > 0
      ? `\nRelevant files: ${relevantFiles.slice(0, 10).join(', ')}`
      : ''

    const nlExamples: { role: string; content: string }[] =
      process.platform === 'win32'
        ? [
            { role: 'user', content: 'list all files modified today' },
            { role: 'assistant', content: 'Get-ChildItem | Where-Object { $_.LastWriteTime -gt (Get-Date).Date }' },
            { role: 'user', content: 'kill the process on port 3000' },
            { role: 'assistant', content: 'netstat -ano | findstr :3000 | ForEach-Object { Stop-Process -Id ($_ -split "\\s+")[-1] -Force }' },
            { role: 'user', content: 'show disk usage of current folder' },
            { role: 'assistant', content: 'Get-ChildItem -Recurse | Measure-Object -Property Length -Sum | Select-Object Sum' },
          ]
        : process.platform === 'darwin'
        ? [
            { role: 'user', content: 'list all files modified today' },
            { role: 'assistant', content: 'find . -maxdepth 1 -newermt "$(date +%Y-%m-%d)" -type f' },
            { role: 'user', content: 'kill the process on port 3000' },
            { role: 'assistant', content: 'lsof -ti :3000 | xargs kill -9' },
            { role: 'user', content: 'show disk usage of current folder' },
            { role: 'assistant', content: 'du -sh *' },
          ]
        : [
            { role: 'user', content: 'list all files modified today' },
            { role: 'assistant', content: 'find . -maxdepth 1 -newermt "$(date +%Y-%m-%d)" -type f' },
            { role: 'user', content: 'kill the process on port 3000' },
            { role: 'assistant', content: 'fuser -k 3000/tcp' },
            { role: 'user', content: 'show disk usage of current folder' },
            { role: 'assistant', content: 'du -sh *' },
          ]

    const autocompleteExamples: { role: string; content: string }[] =
      process.platform === 'win32'
        ? [
            { role: 'user', content: 'Partial: git st' },
            { role: 'assistant', content: 'git status' },
            { role: 'user', content: 'Partial: git che' },
            { role: 'assistant', content: 'git checkout' },
            { role: 'user', content: 'Partial: npm i' },
            { role: 'assistant', content: 'npm install' },
            { role: 'user', content: 'Partial: mkd' },
            { role: 'assistant', content: 'mkdir' },
            { role: 'user', content: 'Partial: Get-Ch' },
            { role: 'assistant', content: 'Get-ChildItem' },
          ]
        : [
            { role: 'user', content: 'Partial: git st' },
            { role: 'assistant', content: 'git status' },
            { role: 'user', content: 'Partial: git che' },
            { role: 'assistant', content: 'git checkout' },
            { role: 'user', content: 'Partial: npm i' },
            { role: 'assistant', content: 'npm install' },
            { role: 'user', content: 'Partial: mkd' },
            { role: 'assistant', content: 'mkdir' },
            { role: 'user', content: 'Partial: ls -' },
            { role: 'assistant', content: 'ls -la' },
          ]

    const messages = nlMode
      ? [
          {
            role: 'system',
            content:
              `You are a shell command generator for ${os}. ` +
              'The user describes what they want to do in plain English. ' +
              'Output ONLY the shell command, nothing else. No explanation. No markdown. One line.' +
              ctxBlock,
          },
          ...nlExamples,
          { role: 'user', content: prompt },
        ]
      : [
          {
            role: 'system',
            content:
              `Complete the partial ${os} shell command. ` +
              'Output ONLY the completed command. ' +
              'The output MUST start with the exact same characters as the input. ' +
              'Use filenames from the terminal context when they match. ' +
              'Only suggest files with the right extension for the command (e.g. .py for python, .js for node).' +
              fileListHint +
              ctxBlock,
          },
          ...autocompleteExamples,
          ...ctxExample,
          { role: 'user', content: `Partial: ${prompt}` },
        ]

    const { endpoint, apiKey, format } = loadAiSettings()
    const authHeaders: Record<string, string> = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    const chatUrl = buildChatUrl(endpoint, format)
    const extraOpts = format === 'openai'
      ? { temperature: nlMode ? 0.2 : 0.05, max_tokens: nlMode ? 80 : 40 }
      : { temperature: nlMode ? 0.2 : 0.05, num_predict: nlMode ? 80 : 40, stop: ['\n', '\r'] }
    const body = format === 'openai'
      ? buildChatBody(resolvedModel, messages, false, format, extraOpts)
      : { model: resolvedModel, stream: false, think: false, options: extraOpts, messages }
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error('AI response not ok:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const raw = parseChatResponse(data, format).trim()
    const JUNK = /^(null|none|n\/a|undefined|sorry|i (can|don)|no completion)/i

    if (nlMode) {
      const result = raw.length === 0 || raw.includes('\n') || JUNK.test(raw) ? null : raw
      console.log(`[AI:nl] model=${resolvedModel} prompt="${prompt}" → "${result}"`)
      return result
    }

    const p = prompt.trimEnd()
    const result =
      raw.length === 0 ||
      raw.toLowerCase() === p.toLowerCase() ||
      !raw.toLowerCase().startsWith(p.toLowerCase()) ||
      raw.length > 200 ||
      raw.includes('\n') ||
      JUNK.test(raw)
        ? null
        : raw

    console.log(`[AI] model=${resolvedModel} prompt="${prompt}" → "${result}"`)
    return result
  } catch (e) {
    console.error('[AI] fetch error:', e)
    return null
  }
})

ipcMain.handle('ai:check', async (_event, overrideEndpoint?: string) => {
  try {
    const settings = loadAiSettings()
    const endpoint = (overrideEndpoint?.replace(/\/$/, '')) || settings.endpoint
    let explicitFormat: 'auto' | 'openai' | 'ollama' = 'auto'
    try {
      if (fs.existsSync(settingsPath)) {
        const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
        explicitFormat = s?.aiApiFormat ?? 'auto'
      }
    } catch { /* ignore */ }
    const format = resolveApiFormat(endpoint, settings.provider, explicitFormat)
    const authHeaders: Record<string, string> = settings.apiKey ? { 'Authorization': `Bearer ${settings.apiKey}` } : {}

    // Try models listing first
    const modelsUrl = buildModelsUrl(endpoint, format)
    try {
      const response = await fetch(modelsUrl, { headers: authHeaders })
      if (response.ok) {
        const data = await response.json()
        const models = parseModelsResponse(data, format)
        if (models.length > 0) return { available: true, models }
      }
    } catch { /* models endpoint failed, try ping */ }

    // Fallback: send a minimal chat request to verify the endpoint is alive
    const chatUrl = buildChatUrl(endpoint, format)
    const pingBody = buildChatBody(
      settings.model,
      [{ role: 'user', content: 'hi' }],
      false,
      format,
      format === 'openai' ? { max_tokens: 1 } : { num_predict: 1 },
    )
    const pingResp = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(pingBody),
    })
    if (pingResp.ok) {
      return { available: true, models: [settings.model] }
    }
    return { available: false, models: [] }
  } catch {
    return { available: false, models: [] }
  }
})

// Active local-llm chat sessions: sessionId → AbortController
const activeLlmChats = new Map<string, AbortController>()

ipcMain.handle('ai:chatStream', async (_event, sessionId: string, messages: { role: string; content: string }[]) => {
  try {
    const { endpoint, apiKey, model, format } = loadAiSettings()
    const authHeaders: Record<string, string> = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}

    const prev = activeLlmChats.get(sessionId)
    if (prev) prev.abort()
    const controller = new AbortController()
    activeLlmChats.set(sessionId, controller)

    const chatUrl = buildChatUrl(endpoint, format)
    const body = buildChatBody(model, messages, true, format)
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      mainWindow?.webContents.send(`llm:data:${sessionId}`, `\r\n\x1b[31mError: ${response.status} ${errText}\x1b[0m\r\n`)
      mainWindow?.webContents.send(`llm:done:${sessionId}`)
      activeLlmChats.delete(sessionId)
      return
    }

    const reader = (response.body as any)?.getReader?.()
    if (!reader) {
      const data = await response.json()
      const content = parseChatResponse(data, format)
      mainWindow?.webContents.send(`llm:data:${sessionId}`, content)
      mainWindow?.webContents.send(`llm:done:${sessionId}`)
      activeLlmChats.delete(sessionId)
      return
    }

    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
        try {
          const parsed = JSON.parse(jsonStr)
          const { content: chunk, done: isDone } = parseStreamChunk(parsed, format)
          if (chunk) {
            mainWindow?.webContents.send(`llm:data:${sessionId}`, chunk.replace(/\n/g, '\r\n'))
          }
          if (isDone) {
            mainWindow?.webContents.send(`llm:done:${sessionId}`)
            activeLlmChats.delete(sessionId)
            return
          }
        } catch { /* partial JSON */ }
      }
    }
    mainWindow?.webContents.send(`llm:done:${sessionId}`)
    activeLlmChats.delete(sessionId)
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      mainWindow?.webContents.send(`llm:data:${sessionId}`, `\r\n\x1b[31mError: ${e.message}\x1b[0m\r\n`)
    }
    mainWindow?.webContents.send(`llm:done:${sessionId}`)
    activeLlmChats.delete(sessionId)
  }
})

ipcMain.handle('ai:chatAbort', async (_event, sessionId: string) => {
  const controller = activeLlmChats.get(sessionId)
  if (controller) {
    controller.abort()
    activeLlmChats.delete(sessionId)
  }
})

// ── Interactive LLM chat (custom provider) ──────────────────────────────────

interface InteractiveChat {
  messages: { role: string; content: string }[]
  inputBuf: string
  streaming: boolean
  abortController: AbortController | null
}

const interactiveChats = new Map<string, InteractiveChat>()

function chatWrite(sessionId: string, text: string) {
  mainWindow?.webContents.send(`pty:data:${sessionId}`, text)
}

function chatPrompt(sessionId: string) {
  chatWrite(sessionId, '\x1b[36m❯ \x1b[0m')
}

async function chatSendMessage(sessionId: string) {
  const chat = interactiveChats.get(sessionId)
  if (!chat) return

  const userText = chat.inputBuf.trim()
  chat.inputBuf = ''

  if (!userText) {
    chatPrompt(sessionId)
    return
  }

  if (userText === '/exit' || userText === '/quit') {
    chatWrite(sessionId, '\r\n\x1b[2mChat ended.\x1b[0m\r\n')
    interactiveChats.delete(sessionId)
    const session = sessions.get(sessionId)
    if (session) session.process.write('\r')
    return
  }

  if (userText === '/clear') {
    chat.messages = [chat.messages[0]]
    chatWrite(sessionId, '\r\n\x1b[2mConversation cleared.\x1b[0m\r\n')
    chatPrompt(sessionId)
    return
  }

  if (userText === '/help') {
    chatWrite(sessionId, '\r\n\x1b[2mCommands: /clear (reset conversation), /exit (quit chat), /help\x1b[0m\r\n')
    chatPrompt(sessionId)
    return
  }

  chat.messages.push({ role: 'user', content: userText })
  chat.streaming = true
  chatWrite(sessionId, '\r\n')

  try {
    const { endpoint, apiKey, model, format } = loadAiSettings()

    const controller = new AbortController()
    chat.abortController = controller

    const authHeaders: Record<string, string> = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    const chatUrl = buildChatUrl(endpoint, format)
    const body = buildChatBody(model, chat.messages, true, format)
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      chatWrite(sessionId, `\x1b[31mError: ${response.status} ${errText}\x1b[0m\r\n`)
      chat.streaming = false
      chat.abortController = null
      chatPrompt(sessionId)
      return
    }

    let fullReply = ''
    const reader = (response.body as any)?.getReader?.()
    if (reader) {
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
          try {
            const parsed = JSON.parse(jsonStr)
            const { content: chunk, done: isDone } = parseStreamChunk(parsed, format)
            if (chunk) {
              fullReply += chunk
              chatWrite(sessionId, chunk.replace(/\n/g, '\r\n'))
            }
            if (isDone) break
          } catch { /* partial JSON */ }
        }
      }
    } else {
      const data = await response.json()
      fullReply = parseChatResponse(data, format)
      chatWrite(sessionId, fullReply.replace(/\n/g, '\r\n'))
    }

    if (fullReply) {
      chat.messages.push({ role: 'assistant', content: fullReply })
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      chatWrite(sessionId, `\r\n\x1b[31mError: ${e.message}\x1b[0m`)
    }
  }

  chat.streaming = false
  chat.abortController = null
  chatWrite(sessionId, '\r\n\r\n')
  if (interactiveChats.has(sessionId)) {
    chatPrompt(sessionId)
  }
}

ipcMain.handle('ai:startInteractiveChat', async (_event, sessionId: string) => {
  const { provider, model, endpoint, format } = loadAiSettings()

  interactiveChats.set(sessionId, {
    messages: [
      { role: 'system', content: 'You are a friendly and knowledgeable AI assistant running inside NexShell, a modern terminal application. You are here to help the user with anything they need — coding questions, debugging, writing scripts, explaining concepts, brainstorming ideas, or general knowledge. Be concise but thorough. When sharing code, use markdown-style backtick blocks. If the user asks something outside of coding, help them anyway — you are a general-purpose assistant, not limited to code.' },
    ],
    inputBuf: '',
    streaming: false,
    abortController: null,
  })

  const displayEndpoint = endpoint.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  chatWrite(sessionId, `\x1b[1;36mLocal LLM Chat\x1b[0m \x1b[2m(${displayEndpoint} · ${model} · ${format})\x1b[0m\r\n`)
  chatWrite(sessionId, `\x1b[2mType your message and press Enter. Commands: /help /clear /exit\x1b[0m\r\n\r\n`)
  chatPrompt(sessionId)
})

ipcMain.handle('ai:stopInteractiveChat', async (_event, sessionId: string) => {
  const chat = interactiveChats.get(sessionId)
  if (chat?.abortController) chat.abortController.abort()
  interactiveChats.delete(sessionId)
})

ipcMain.handle('ai:chatSendDirect', async (_event, sessionId: string, message: string) => {
  const chat = interactiveChats.get(sessionId)
  if (!chat || chat.streaming) return
  const truncated = message.length > 120
    ? message.substring(0, 120).replace(/\n/g, ' ') + '...'
    : message.replace(/\n/g, ' ')
  chatWrite(sessionId, `\x1b[37m${truncated}\x1b[0m\r\n`)
  chat.inputBuf = message
  chatSendMessage(sessionId)
})

ipcMain.on('ai:chatInput', (_event, sessionId: string, data: string) => {
  const chat = interactiveChats.get(sessionId)
  if (!chat) return

  if (chat.streaming) {
    if (data === '\x03') {
      chat.abortController?.abort()
      chatWrite(sessionId, '\r\n\x1b[2m(interrupted)\x1b[0m\r\n')
    }
    return
  }

  for (const ch of data) {
    if (ch === '\r' || ch === '\n') {
      chatWrite(sessionId, '\r\n')
      chatSendMessage(sessionId)
    } else if (ch === '\x7f' || ch === '\b') {
      if (chat.inputBuf.length > 0) {
        chat.inputBuf = chat.inputBuf.slice(0, -1)
        chatWrite(sessionId, '\b \b')
      }
    } else if (ch === '\x03') {
      chat.inputBuf = ''
      chatWrite(sessionId, '^C\r\n')
      chatPrompt(sessionId)
    } else if (ch >= ' ') {
      chat.inputBuf += ch
      chatWrite(sessionId, ch)
    }
  }
})

// ── Theme persistence ──
const themePath = path.join(app.getPath('userData'), 'theme.json')

ipcMain.handle('theme:get', () => {
  try {
    if (fs.existsSync(themePath)) {
      return JSON.parse(fs.readFileSync(themePath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return null
})

ipcMain.handle('theme:set', (_event, theme: any) => {
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2))
})

// ── Settings persistence ──
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

ipcMain.handle('settings:get', () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return null
})

ipcMain.handle('settings:set', (_event, settings: any) => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
})

// ── SSH Hosts persistence ──
const hostsPath = path.join(app.getPath('userData'), 'ssh-hosts.json')

ipcMain.handle('hosts:get', () => {
  try {
    if (fs.existsSync(hostsPath)) {
      return JSON.parse(fs.readFileSync(hostsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
})

ipcMain.handle('hosts:set', (_event, hosts: any[]) => {
  fs.writeFileSync(hostsPath, JSON.stringify(hosts, null, 2))
})

// ── SSH Keys persistence ──
const keysPath = path.join(app.getPath('userData'), 'ssh-keys.json')

ipcMain.handle('keys:get', () => {
  try {
    if (fs.existsSync(keysPath)) {
      return JSON.parse(fs.readFileSync(keysPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
})

ipcMain.handle('keys:set', (_event, keys: any[]) => {
  fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2))
})

// ── SSH Key Generation ──
ipcMain.handle('keys:generate', (_event, opts: { type: string; bits: number; filename: string; comment: string; passphrase: string }) => {
  return new Promise((resolve) => {
    const args = [
      '-t', opts.type,
      '-b', String(opts.bits),
      '-f', opts.filename,
      '-C', opts.comment || '',
      '-N', opts.passphrase || '',
    ]
    // Ed25519 doesn't use -b
    if (opts.type === 'ed25519') {
      const bIdx = args.indexOf('-b')
      if (bIdx !== -1) args.splice(bIdx, 2)
    }
    execFile('ssh-keygen', args, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message })
      } else {
        resolve({ success: true, path: opts.filename })
      }
    })
  })
})

// ── Environment Variables persistence ──
const variablesPath = path.join(app.getPath('userData'), 'env-variables.json')

function loadVariables(): any[] {
  try {
    if (fs.existsSync(variablesPath)) {
      return JSON.parse(fs.readFileSync(variablesPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
}

ipcMain.handle('variables:get', () => loadVariables())

ipcMain.handle('variables:set', (_event, vars: any[]) => {
  fs.writeFileSync(variablesPath, JSON.stringify(vars, null, 2))
})

ipcMain.handle('variables:openSystem', () => {
  const { exec } = require('child_process')
  if (process.platform === 'win32') {
    exec('rundll32 sysdm.cpl,EditEnvironmentVariables')
  } else if (process.platform === 'darwin') {
    exec('open -a TextEdit ~/.zshrc')
  } else {
    exec('xdg-open ~/.bashrc')
  }
})

// ── Snippets persistence ──
const snippetsPath = path.join(app.getPath('userData'), 'snippets.json')

ipcMain.handle('snippets:get', () => {
  try {
    if (fs.existsSync(snippetsPath)) {
      return JSON.parse(fs.readFileSync(snippetsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
})

ipcMain.handle('snippets:set', (_event, snippets: any[]) => {
  fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2))
})

// ── Sidebar state persistence ──
const sidebarStatePath = path.join(app.getPath('userData'), 'sidebar-state.json')

ipcMain.handle('sidebar:getState', () => {
  try {
    if (fs.existsSync(sidebarStatePath)) {
      return JSON.parse(fs.readFileSync(sidebarStatePath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return null
})

ipcMain.handle('sidebar:setState', (_event, state: any) => {
  fs.writeFileSync(sidebarStatePath, JSON.stringify(state, null, 2))
})

// ── SFTP via ssh2 ──
import { Client as SshClient, SFTPWrapper } from 'ssh2'

interface SftpSession {
  client: SshClient
  sftp: SFTPWrapper
}

const sftpSessions = new Map<string, SftpSession>()
let sftpCounter = 0

function sftpErrMsg(err: any, context?: string): string {
  const msg = err?.message || String(err)
  if (msg === 'Failure' || msg === 'No such file') {
    return context
      ? `${context}: Permission denied or path not found`
      : 'Permission denied or path not found'
  }
  return context ? `${context}: ${msg}` : msg
}

ipcMain.handle('sftp:connect', async (_event, opts: { host: string; port: number; user: string; password?: string; identityFile?: string }) => {
  const id = `sftp-${Date.now()}-${++sftpCounter}`
  return new Promise<{ id: string } | { error: string }>((resolve) => {
    const client = new SshClient()

    const connOpts: any = {
      host: opts.host,
      port: opts.port || 22,
      username: opts.user,
      readyTimeout: 15000,
    }

    if (opts.password) {
      connOpts.password = opts.password
    }

    if (opts.identityFile) {
      try {
        const keyPath = opts.identityFile.replace(/^~/, os.homedir())
        connOpts.privateKey = fs.readFileSync(keyPath)
      } catch (err: any) {
        resolve({ error: `Cannot read key file: ${err.message}` })
        return
      }
    }

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          resolve({ error: err.message })
          return
        }
        sftpSessions.set(id, { client, sftp })
        resolve({ id })
      })
    })

    client.on('error', (err) => {
      resolve({ error: err.message })
    })

    client.connect(connOpts)
  })
})

ipcMain.handle('sftp:disconnect', (_event, id: string) => {
  const session = sftpSessions.get(id)
  if (session) {
    session.client.end()
    sftpSessions.delete(id)
  }
})

ipcMain.handle('sftp:list', async (_event, id: string, remotePath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.readdir(remotePath, (err, list) => {
      if (err) { resolve({ error: sftpErrMsg(err, `Listing ${remotePath}`) }); return }
      const entries = list
        .filter(f => f.filename !== '.' && f.filename !== '..')
        .map(f => ({
          name: f.filename,
          path: remotePath.replace(/\/$/, '') + '/' + f.filename,
          isDirectory: (f.attrs.mode & 0o40000) !== 0,
          size: f.attrs.size,
          modTime: f.attrs.mtime * 1000,
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        })
      resolve(entries)
    })
  })
})

ipcMain.handle('sftp:download', async (_event, id: string, remotePath: string, localDir: string, fileName: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  const resolvedDir = localDir.replace(/^~/, os.homedir())
  const localPath = path.join(resolvedDir, fileName)
  return new Promise((resolve) => {
    session.sftp.fastGet(remotePath, localPath, (err) => {
      if (err) resolve({ error: sftpErrMsg(err, 'Download failed') })
      else resolve({ ok: true })
    })
  })
})

ipcMain.handle('sftp:upload', async (_event, id: string, localPath: string, remotePath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.fastPut(localPath, remotePath, (err) => {
      if (err) resolve({ error: sftpErrMsg(err, 'Upload failed') })
      else resolve({ ok: true })
    })
  })
})

ipcMain.handle('sftp:mkdir', async (_event, id: string, remotePath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.mkdir(remotePath, (err) => {
      if (err) resolve({ error: sftpErrMsg(err, 'Create folder failed') })
      else resolve({ ok: true })
    })
  })
})

ipcMain.handle('sftp:delete', async (_event, id: string, remotePath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.stat(remotePath, (statErr, stats) => {
      if (statErr) { resolve({ error: sftpErrMsg(statErr, 'Delete failed') }); return }
      if ((stats.mode & 0o40000) !== 0) {
        session.sftp.rmdir(remotePath, (err) => {
          if (err) resolve({ error: sftpErrMsg(err, 'Delete folder failed') })
          else resolve({ ok: true })
        })
      } else {
        session.sftp.unlink(remotePath, (err) => {
          if (err) resolve({ error: sftpErrMsg(err, 'Delete file failed') })
          else resolve({ ok: true })
        })
      }
    })
  })
})

// ── Local file listing (for SFTP local panel) ──
ipcMain.handle('local:list', async (_event, dirPath: string) => {
  try {
    const resolved = dirPath.replace(/^~/, os.homedir())
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    const items = entries
      .filter(e => e.name !== '.' && e.name !== '..')
      .map(e => {
        const full = path.join(resolved, e.name)
        let size = 0
        let modTime = Date.now()
        try {
          const stat = fs.statSync(full)
          size = stat.size
          modTime = stat.mtimeMs
        } catch { /* skip */ }
        return {
          name: e.name,
          path: full,
          isDirectory: e.isDirectory(),
          size,
          modTime,
        }
      })
      .sort((a: any, b: any) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
    return { resolvedPath: resolved, entries: items }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ── Session Logs persistence ──

interface SessionLog {
  id: string
  sessionName: string
  startedAt: number
  endedAt: number
  exitCode: number | null
  outputTail: string
  shell: string
}

const logsPath = path.join(app.getPath('userData'), 'session-logs.json')

function getLogRetention(): number {
  try {
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const v = s?.logRetention
      // -1 = unlimited; otherwise a positive number; default 100
      if (typeof v === 'number') return v
    }
  } catch { /* ignore */ }
  return 100
}

function loadLogs(): SessionLog[] {
  try {
    if (fs.existsSync(logsPath)) {
      return JSON.parse(fs.readFileSync(logsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return []
}

function saveLogs(logs: SessionLog[]) {
  const retention = getLogRetention()
  const trimmed = retention === -1 ? logs : logs.slice(-retention)
  fs.writeFileSync(logsPath, JSON.stringify(trimmed, null, 2))
}

ipcMain.handle('logs:get', () => loadLogs())

ipcMain.handle('logs:add', (_event, log: SessionLog) => {
  const logs = loadLogs()
  logs.push(log)
  saveLogs(logs)
  mainWindow?.webContents.send('logs:added')
})

ipcMain.handle('logs:delete', (_event, id: string) => {
  const logs = loadLogs().filter(l => l.id !== id)
  fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2))
})

ipcMain.handle('logs:clear', () => {
  fs.writeFileSync(logsPath, JSON.stringify([], null, 2))
})

// ── Libraries: tool detection & install ──

/** Cached fresh PATH for Windows. Cleared on each Libraries refresh so new
 * installs are visible, but reused across all concurrent tool checks in the
 * same refresh cycle to avoid spawning 26+ PowerShell processes in parallel. */
let _cachedFreshPath: string | null = null

/** On Windows, winget/installers update PATH in the registry but the Electron
 * process inherits PATH from its parent. Fetch fresh Machine+User PATH once
 * per refresh cycle so newly installed tools are visible without restarting. */
function getFreshPathWindows(): string {
  if (_cachedFreshPath !== null) return _cachedFreshPath
  try {
    const out = execSync(
      'powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'Path\', \'Machine\') + \';\' + [Environment]::GetEnvironmentVariable(\'Path\', \'User\')"',
      { encoding: 'utf8', timeout: 5000 }
    )
    _cachedFreshPath = out.trim() || process.env.PATH || ''
  } catch {
    _cachedFreshPath = process.env.PATH || ''
  }
  return _cachedFreshPath
}

function invalidateFreshPath() {
  _cachedFreshPath = null
}

/** Parse a check command into [executable, ...args].
 * Handles bare commands ("git --version") and absolute exe paths
 * (C:\Program Files\Wireshark\tshark.exe --version). */
function parseCheckCmd(checkCmd: string): { exe: string; args: string[] } | null {
  const trimmed = checkCmd.trim()
  // Windows absolute path: match up to .exe (path may contain spaces)
  const winMatch = trimmed.match(/^([A-Za-z]:\\.+?\.exe)\s*(.*)/i)
  if (winMatch) {
    const exe = winMatch[1]
    const args = winMatch[2] ? winMatch[2].trim().split(/\s+/) : []
    return { exe, args }
  }
  // Unix absolute path: no spaces expected
  const unixMatch = trimmed.match(/^(\/\S+)\s*(.*)/i)
  if (unixMatch) {
    const exe = unixMatch[1]
    const args = unixMatch[2] ? unixMatch[2].trim().split(/\s+/) : []
    return { exe, args }
  }
  return null
}

async function runCheckCmd(
  checkCmd: string,
  env: NodeJS.ProcessEnv
): Promise<{ installed: boolean; version: string | null }> {
  return new Promise((resolve) => {
    function onResult(err: Error | null, stdout: string, stderr: string) {
      if (err) {
        resolve({ installed: false, version: null })
      } else {
        const raw = (stdout || stderr || '').trim()
        const m = raw.match(/\d+\.\d+[\.\d]*/)?.[0] ?? null
        resolve({ installed: true, version: m })
      }
    }

    // For absolute exe paths, call directly — avoids cmd.exe quoting issues
    const parsed = parseCheckCmd(checkCmd)
    if (parsed) {
      execFile(parsed.exe, parsed.args, { timeout: 8000, env }, onResult)
      return
    }

    // Otherwise route through the shell (handles PATH resolution, builtins, etc.)
    const isWin = process.platform === 'win32'
    const shell = isWin ? 'cmd' : 'sh'
    const shellFlag = isWin ? '/c' : '-c'
    execFile(shell, [shellFlag, checkCmd], { timeout: 8000, env }, onResult)
  })
}

ipcMain.handle('libraries:checkTool', async (_event, checkCmdOrCmds: string | string[]) => {
  const cmds = Array.isArray(checkCmdOrCmds) ? checkCmdOrCmds : [checkCmdOrCmds]
  const isWin = process.platform === 'win32'
  // getFreshPathWindows is cached, so calling it here is cheap after the first call
  const env = isWin ? { ...process.env, PATH: getFreshPathWindows() } : process.env

  for (const cmd of cmds) {
    const result = await runCheckCmd(cmd, env)
    if (result.installed) return result
  }
  return { installed: false, version: null }
})

/** Call before a full library re-scan to bust the PATH cache so newly installed
 * tools are visible. Not needed for individual per-tool checks. */
ipcMain.handle('libraries:invalidatePathCache', () => {
  invalidateFreshPath()
})

ipcMain.handle('libraries:installTool', async (_event, sessionId: string, cmd: string) => {
  const session = sessions.get(sessionId)
  if (!session) return
  session.process.write(cmd + '\r')
})

// ── Agent config detection ──
ipcMain.handle('agents:checkConfigured', (_event, configPath: string) => {
  const resolved = configPath.replace(/^~/, os.homedir())
  return fs.existsSync(resolved)
})

ipcMain.handle('sftp:realpath', async (_event, id: string, remotePath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.realpath(remotePath, (err, absPath) => {
      if (err) resolve({ error: sftpErrMsg(err) })
      else resolve({ path: absPath })
    })
  })
})

ipcMain.handle('sftp:rename', async (_event, id: string, oldPath: string, newPath: string) => {
  const session = sftpSessions.get(id)
  if (!session) return { error: 'Not connected' }
  return new Promise((resolve) => {
    session.sftp.rename(oldPath, newPath, (err) => {
      if (err) resolve({ error: sftpErrMsg(err, 'Rename failed') })
      else resolve({ ok: true })
    })
  })
})

// ── Local file operations (for SFTP local panel) ──
ipcMain.handle('local:rename', async (_event, oldPath: string, newPath: string) => {
  try {
    fs.renameSync(oldPath, newPath)
    return { ok: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('local:delete', async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      fs.rmdirSync(filePath)
    } else {
      fs.unlinkSync(filePath)
    }
    return { ok: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('local:mkdir', async (_event, dirPath: string) => {
  try {
    fs.mkdirSync(dirPath)
    return { ok: true }
  } catch (err: any) {
    return { error: err.message }
  }
})

// ── File dialogs for SFTP ──
ipcMain.handle('dialog:open', async (_event, options: any) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result.canceled ? null : result.filePaths
})

ipcMain.handle('dialog:save', async (_event, options: any) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result.canceled ? null : result.filePath
})

// ── Open URL in system browser ──
ipcMain.handle('shell:openExternal', (_event, url: string) => {
  shell.openExternal(url)
})
