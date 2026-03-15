import { app, BrowserWindow, ipcMain, nativeTheme, dialog, shell } from 'electron'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'

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

function loadAiSettings(): { endpoint: string; apiKey: string } {
  try {
    if (fs.existsSync(settingsPath)) {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      return {
        endpoint: (s?.aiEndpoint ?? 'http://localhost:11434').replace(/\/$/, ''),
        apiKey: s?.aiApiKey ?? '',
      }
    }
  } catch { /* ignore */ }
  return { endpoint: 'http://localhost:11434', apiKey: '' }
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

    const { endpoint, apiKey } = loadAiSettings()
    const authHeaders: Record<string, string> = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        model: resolvedModel,
        stream: false,
        think: false,
        options: {
          temperature: nlMode ? 0.2 : 0.05,
          num_predict: nlMode ? 80 : 40,
          stop: ['\n', '\r'],
        },
        messages,
      }),
    })

    if (!response.ok) {
      console.error('AI response not ok:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const raw = (data.message?.content ?? '').trim()
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
    const { endpoint: savedEndpoint, apiKey } = loadAiSettings()
    const endpoint = (overrideEndpoint?.replace(/\/$/, '')) || savedEndpoint
    const authHeaders: Record<string, string> = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    const response = await fetch(`${endpoint}/api/tags`, { headers: authHeaders })
    if (!response.ok) return { available: false, models: [] }
    const data = await response.json()
    return {
      available: true,
      models: data.models?.map((m: any) => m.name) || [],
    }
  } catch {
    return { available: false, models: [] }
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
ipcMain.handle('libraries:checkTool', async (_event, checkCmd: string) => {
  return new Promise<{ installed: boolean; version: string | null }>((resolve) => {
    // Run through the user's shell so npm global bin dirs and other PATH
    // additions from shell profiles are visible to the check.
    const isWin = process.platform === 'win32'
    const shell = isWin ? 'cmd' : 'sh'
    const shellFlag = isWin ? '/c' : '-c'

    execFile(shell, [shellFlag, checkCmd], { timeout: 8000, env: process.env }, (err, stdout, stderr) => {
      if (err) {
        resolve({ installed: false, version: null })
      } else {
        const raw = (stdout || stderr || '').trim()
        const m = raw.match(/\d+\.\d+[\.\d]*/)?.[0] ?? null
        resolve({ installed: true, version: m })
      }
    })
  })
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
