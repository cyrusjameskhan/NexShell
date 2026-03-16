import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { CanvasAddon } from '@xterm/addon-canvas'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useStore } from '../hooks'
import { zoomFontSize, resetFontSize, createTab, getState, setState } from '../store'
import { Snippet, TerminalTheme } from '../types'

interface Props {
  sessionId: string
  isActive: boolean
}

function buildXtermTheme(theme: TerminalTheme) {
  return {
    background: theme.colors.background,
    foreground: theme.colors.foreground,
    cursor: theme.colors.cursor,
    cursorAccent: theme.colors.cursorAccent,
    selectionBackground: theme.colors.selectionBackground,
    black: theme.colors.black,
    red: theme.colors.red,
    green: theme.colors.green,
    yellow: theme.colors.yellow,
    blue: theme.colors.blue,
    magenta: theme.colors.magenta,
    cyan: theme.colors.cyan,
    white: theme.colors.white,
    brightBlack: theme.colors.brightBlack,
    brightRed: theme.colors.brightRed,
    brightGreen: theme.colors.brightGreen,
    brightYellow: theme.colors.brightYellow,
    brightBlue: theme.colors.brightBlue,
    brightMagenta: theme.colors.brightMagenta,
    brightCyan: theme.colors.brightCyan,
    brightWhite: theme.colors.brightWhite,
  }
}

export default function TerminalView({ sessionId, isActive }: Props) {
  const { theme, settings, fontZoomTick } = useStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const initialized = useRef(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiPromptText, setAiPromptText] = useState('')
  const [aiPromptLoading, setAiPromptLoading] = useState(false)
  const aiPromptInputRef = useRef<HTMLInputElement>(null)
  const [zoomVisible, setZoomVisible] = useState(false)
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const rendererRef = useRef<CanvasAddon | WebglAddon | null>(null)

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; selectedText: string; clipboardText: string; snippets: Snippet[] } | null>(null)
  // Agent prompt state
  const [agentPromptOpen, setAgentPromptOpen] = useState(false)
  const [agentSelectedText, setAgentSelectedText] = useState('')
  const [agentQuestion, setAgentQuestion] = useState('')
  const agentPromptInputRef = useRef<HTMLInputElement>(null)

  const currentLineRef = useRef('')
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const recentOutputRef = useRef('')
  const cmdHistoryRef = useRef<string[]>([])  // last N commands for context
  const cleanOutputRef = useRef('')           // ANSI-stripped terminal output for AI context

  // Refs to avoid stale closures in the one-time onData handler
  const settingsRef = useRef(settings)
  const aiSuggestionRef = useRef<string | null>(null)
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { aiSuggestionRef.current = aiSuggestion }, [aiSuggestion])

  // Batched write buffer — accumulates PTY data and flushes on rAF
  // so we write to the terminal once per frame instead of per IPC message
  const writeBufferRef = useRef<string[]>([])
  const rafRef = useRef<number>(0)

  const flushBuffer = () => {
    if (writeBufferRef.current.length === 0) return
    const term = xtermRef.current
    if (!term) { writeBufferRef.current = []; return }
    const chunk = writeBufferRef.current.join('')
    writeBufferRef.current = []
    term.write(chunk)
  }

  const scheduleFlush = () => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      flushBuffer()
    })
  }

  // Strip all ANSI/VT escape sequences to get plain readable text
  const stripAnsi = (s: string) =>
    s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')  // CSI sequences (colors, cursor, ?25h etc)
     .replace(/\x1b\[[0-9;?]*[~@]/g, '')      // CSI with ~ or @ terminators
     .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '') // OSC sequences (title etc)
     .replace(/\x1b[()][0-9A-Z]/g, '')        // charset designations
     .replace(/\x1b[^[\]()][A-Z0-9]?/g, '')   // other 2-byte ESC sequences
     .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '') // control chars except \t \n \r
     .replace(/\r\n?/g, '\n')                 // normalize line endings
     .replace(/\n{3,}/g, '\n\n')              // collapse excessive blank lines

  const buildContext = () => {
    const history = cmdHistoryRef.current
    const historyStr = history.length ? `Recent commands:\n${history.join('\n')}` : ''
    // Use the last ~800 chars of clean output so filenames/paths from ls etc are visible
    const output = cleanOutputRef.current.slice(-800)
    return [historyStr, output].filter(Boolean).join('\n\n')
  }

  const shouldRequestSuggestion = (partial: string): boolean => {
    const p = partial.trim()
    if (p.length < 3) return false
    // If it ends with a space, only suggest if there's something after the space
    // e.g. "git " alone is pointless, but "git ch" is good
    const parts = p.split(' ')
    const last = parts[parts.length - 1]
    if (last.length === 0) return false
    // Don't bother if the last word is already a complete common word with no subcommand potential
    // (avoids hammering the model for "ollama", "node", "python" alone)
    if (parts.length === 1 && last.length < 4) return false
    return true
  }

  const requestAiSuggestion = async (partial: string) => {
    const s = settingsRef.current
    if (!s.aiEnabled || !shouldRequestSuggestion(partial)) {
      setAiSuggestion(null)
      return
    }
    const suggestion = await window.api.aiComplete(partial, buildContext(), s.aiModel)
    const trimmed = suggestion?.trim() ?? ''
    const useful =
      trimmed.length > 0 &&
      trimmed.toLowerCase() !== partial.trim().toLowerCase() &&
      trimmed.toLowerCase().startsWith(partial.trim().toLowerCase())
    if (useful) {
      setAiSuggestion(trimmed)
    } else {
      setAiSuggestion(null)
    }
  }

  const openAgentPrompt = useCallback((selectedText: string) => {
    setCtxMenu(null)
    setAgentSelectedText(selectedText)
    setAgentQuestion('')
    setAgentPromptOpen(true)
    setTimeout(() => agentPromptInputRef.current?.focus(), 50)
  }, [])

  const submitAgentPrompt = useCallback(() => {
    const question = agentQuestion.trim()
    if (!question) return
    const agentCmd = settingsRef.current.agentCommand || 'claude'
    const shell = settingsRef.current.shell || 'powershell.exe'
    const context = agentSelectedText.trim()
    setAgentPromptOpen(false)
    setAgentQuestion('')
    setAgentSelectedText('')

    if (agentCmd === 'local-llm') {
      const provider = settingsRef.current.aiProvider || 'ollama'
      const model = settingsRef.current.aiModel || 'codellama'
      const prompt = context ? `${context}\n\n${question}` : question
      const session = createTab()

      const isPowerShell = /powershell|pwsh/i.test(shell)
      const isCmd = /^cmd(\.exe)?$/i.test(shell)

      if (provider === 'ollama' || provider === 'lmstudio') {
        setTimeout(() => {
          let cmd: string
          if (provider === 'ollama') {
            if (isPowerShell) {
              const escaped = prompt.replace(/`/g, '``').replace(/"/g, '`"').replace(/\r\n/g, '`n').replace(/\n/g, '`n').replace(/\r/g, '`n')
              cmd = `echo "${escaped}" | ollama run ${model}`
            } else if (isCmd) {
              cmd = `ollama run ${model}`
            } else {
              const escaped = prompt.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n')
              cmd = `echo $'${escaped}' | ollama run ${model}`
            }
          } else {
            cmd = `lms chat --model ${model}`
          }
          window.api.writePty(session.id, cmd + '\r')
        }, 600)
      } else {
        setTimeout(async () => {
          await window.api.aiStartInteractiveChat(session.id)
          await window.api.aiChatSendDirect(session.id, prompt)
        }, 700)
      }
      return
    }

    const session = createTab()

    const isPowerShell = /powershell|pwsh/i.test(shell)
    const isCmd = /^cmd(\.exe)?$/i.test(shell)

    setTimeout(() => {
      if (isPowerShell) {
        const escapePsStr = (s: string) =>
          s.replace(/`/g, '``').replace(/"/g, '`"').replace(/\r\n/g, '`n').replace(/\n/g, '`n').replace(/\r/g, '`n')
        const prompt = context ? `${context}\n\n${question}` : question
        const escaped = escapePsStr(prompt)
        window.api.writePty(session.id, `${agentCmd} -p "${escaped}"\r`)
      } else if (isCmd) {
        window.api.writePty(session.id, agentCmd + '\r')
      } else {
        const escapeSh = (s: string) =>
          s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n')
        const prompt = context ? `${context}\n\n${question}` : question
        const escaped = escapeSh(prompt)
        window.api.writePty(session.id, `${agentCmd} -p $'${escaped}'\r`)
      }
    }, 600)
  }, [agentQuestion, agentSelectedText])

  const submitAiPrompt = useCallback(async () => {
    const text = aiPromptText.trim()
    if (!text) return
    setAiPromptLoading(true)
    try {
      const result = await window.api.aiComplete(
        text,
        buildContext(),
        settingsRef.current.aiModel,
        true  // nlMode: natural language → command
      )
      const cmd = result?.trim() ?? ''
      if (cmd) {
        setAiPromptOpen(false)
        setAiPromptText('')
        // Write command to the PTY input line (no \r — user must press Enter)
        window.api.writePty(sessionId, cmd)
        currentLineRef.current = cmd
      }
    } finally {
      setAiPromptLoading(false)
    }
  }, [aiPromptText, sessionId])

  // ── Mouse drag-to-scroll ─────────────────────────────────────────────────
  // xterm.js scrolls with the wheel but not with click-drag. We intercept
  // pointer events on the viewport element and manually scroll it.
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null)

  const setupDragScroll = (container: HTMLElement) => {
    const getViewport = (): HTMLElement | null =>
      container.querySelector('.xterm-viewport')

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1 && !(e.button === 0 && e.shiftKey)) return
      const viewport = getViewport()
      if (!viewport) return
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startScroll: viewport.scrollTop }
      container.setPointerCapture(e.pointerId)
      container.style.cursor = 'grabbing'
    }

    let dragRaf = 0
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const clientY = e.clientY
      if (dragRaf) return
      dragRaf = requestAnimationFrame(() => {
        dragRaf = 0
        if (!dragRef.current) return
        const viewport = getViewport()
        if (!viewport) return
        viewport.scrollTop = dragRef.current.startScroll + (dragRef.current.startY - clientY)
      })
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!dragRef.current) return
      dragRef.current = null
      if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0 }
      container.releasePointerCapture(e.pointerId)
      container.style.cursor = ''
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerUp)

    return () => {
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      if (dragRaf) cancelAnimationFrame(dragRaf)
    }
  }

  // ── Main terminal init ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initialized.current) return
    initialized.current = true

    const term = new XTerm({
      theme: buildXtermTheme(theme),
      fontSize: (theme.id === 'fallout' || theme.id === 'amber-crt') ? Math.max(settings.fontSize, 18) : settings.fontSize,
      fontFamily: theme.id === 'commodore64' ? "'Commodore 64', monospace" : (theme.id === 'fallout' || theme.id === 'amber-crt') ? "'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace" : theme.id === 'windows98' ? "'W95FA', 'Fixedsys', 'Consolas', monospace" : settings.fontFamily,
      letterSpacing: theme.id === 'windows98' ? -4 : 0,
      lineHeight: theme.id === 'commodore64' ? 1.4 : 1,
      cursorStyle: settings.cursorStyle,
      cursorBlink: settings.cursorBlink,
      scrollback: settings.scrollback,
      allowProposedApi: true,
      smoothScrollDuration: 0,
      overviewRulerWidth: 0,
      scrollOnUserInput: true,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(searchAddon)

    term.open(containerRef.current)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    const attachRenderer = () => {
      try { rendererRef.current?.dispose() } catch { /* already gone */ }
      rendererRef.current = null
      try {
        const webgl = new WebglAddon(true)
        webgl.onContextLoss(() => {
          try { webgl.dispose() } catch { /* already gone */ }
          rendererRef.current = new CanvasAddon()
          term.loadAddon(rendererRef.current)
        })
        term.loadAddon(webgl)
        rendererRef.current = webgl
      } catch {
        rendererRef.current = new CanvasAddon()
        term.loadAddon(rendererRef.current)
      }
    }

    // One-shot ResizeObserver: wait for real layout before spawning PTY
    // and before loading the GPU renderer (WebGL needs a sized canvas).
    let ptyStarted = false
    const startObserver = new ResizeObserver(() => {
      if (ptyStarted) return
      const { width, height } = containerRef.current!.getBoundingClientRect()
      if (width === 0 || height === 0) return
      ptyStarted = true
      startObserver.disconnect()
      fitAddon.fit()
      attachRenderer()
      const sessionName = getState().sessions.find(s => s.id === sessionId)?.name ?? 'Shell Session'
      window.api.createPty(sessionId, term.cols, term.rows, sessionName)
    })
    startObserver.observe(containerRef.current)

    // Buffered PTY data → rAF flush for smooth rendering
    const removeDataListener = window.api.onPtyData(sessionId, (data) => {
      writeBufferRef.current.push(data)
      recentOutputRef.current += data
      if (recentOutputRef.current.length > 2000) {
        recentOutputRef.current = recentOutputRef.current.slice(-1000)
      }
      // Accumulate ANSI-stripped output separately for AI context
      const clean = stripAnsi(data)
      if (clean.trim()) {
        cleanOutputRef.current += clean
        if (cleanOutputRef.current.length > 4000) {
          cleanOutputRef.current = cleanOutputRef.current.slice(-2000)
        }
      }
      scheduleFlush()
    })

    const removeExitListener = window.api.onPtyExit(sessionId, () => {
      writeBufferRef.current.push('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
      scheduleFlush()
    })

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.key === 'F11') return false
      if (e.key === 'Escape' && getState().focusMode !== 'off') {
        const s = getState()
        if (!s.historyOpen && !s.settingsOpen && !s.sftpOpen && !s.closeConfirmOpen) return false
      }
      // Ctrl+Shift+C → copy selected text to clipboard
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const sel = term.getSelection()
        if (sel) navigator.clipboard.writeText(sel).catch(() => {})
        return false
      }
      // Ctrl+Shift+V → paste from clipboard into PTY
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        navigator.clipboard.readText().then(text => {
          if (text) window.api.writePty(sessionId, text)
        }).catch(() => {})
        return false
      }
      return true
    })

    term.onData((data) => {
      // Shift+Tab = ESC [ Z  — open AI natural-language prompt
      if (data === '\x1b[Z') {
        setAiPromptOpen(true)
        setTimeout(() => aiPromptInputRef.current?.focus(), 50)
        return
      }

      // Tab with an active AI suggestion: accept the suggestion instead of
      // forwarding Tab to the shell (which would trigger native completion
      // and garble the input with both completions overlapping).
      if (data === '\t' && aiSuggestionRef.current) {
        const remaining = aiSuggestionRef.current.slice(currentLineRef.current.length)
        if (remaining) {
          window.api.writePty(sessionId, remaining)
          currentLineRef.current = aiSuggestionRef.current
          setAiSuggestion(null)
        }
        return
      }

      window.api.writePty(sessionId, data)

      if (data === '\r' || data === '\n') {
        const cmd = currentLineRef.current.trim()
        if (cmd) {
          window.api.addHistory(cmd)
          cmdHistoryRef.current = [...cmdHistoryRef.current, cmd].slice(-10)
        }
        currentLineRef.current = ''
        setAiSuggestion(null)
      } else if (data === '\x7f' || data === '\b') {
        currentLineRef.current = currentLineRef.current.slice(0, -1)
        clearTimeout(aiTimeoutRef.current)
        aiTimeoutRef.current = setTimeout(
          () => requestAiSuggestion(currentLineRef.current),
          400
        )
      } else if (data.length === 1 && data >= ' ') {
        currentLineRef.current += data
        clearTimeout(aiTimeoutRef.current)
        aiTimeoutRef.current = setTimeout(
          () => requestAiSuggestion(currentLineRef.current),
          400
        )
      }
    })

    term.onResize(({ cols, rows }) => {
      window.api.resizePty(sessionId, cols, rows)
    })

    // VS Code-style split resize: row changes are cheap (no reflow) and
    // applied immediately for snappy vertical resize.  Column changes
    // trigger expensive text reflow so they are debounced at 100 ms.
    let colDebounce: ReturnType<typeof setTimeout>
    let lastFitCols = term.cols
    let lastFitRows = term.rows
    const resizeObserver = new ResizeObserver(() => {
      if (!ptyStarted) return
      let dims: { cols: number; rows: number } | undefined
      try {
        dims = fitAddon.proposeDimensions()
      } catch { return }
      if (!dims) return
      const { cols, rows } = dims
      if (cols === lastFitCols && rows === lastFitRows) return

      if (rows !== lastFitRows) {
        lastFitRows = rows
        try { term.resize(lastFitCols, rows) } catch { /* teardown */ }
      }

      if (cols !== lastFitCols) {
        clearTimeout(colDebounce)
        colDebounce = setTimeout(() => {
          lastFitCols = cols
          try { fitAddon.fit() } catch { /* teardown */ }
          lastFitCols = term.cols
          lastFitRows = term.rows
        }, 100)
      }
    })
    resizeObserver.observe(containerRef.current)

    const removeDragScroll = setupDragScroll(containerRef.current)

    // Right-click context menu: always show, clipboard read is async
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const selected = term.getSelection()
      Promise.all([
        navigator.clipboard.readText().catch(() => ''),
        window.api.getSnippets().catch(() => [] as Snippet[]),
      ]).then(([clipboardText, snippets]) => {
        setCtxMenu({ x: e.clientX, y: e.clientY, selectedText: selected, clipboardText, snippets })
      })
    }
    containerRef.current.addEventListener('contextmenu', onContextMenu)

    // Ctrl+Scroll to zoom terminal font size
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoomFontSize(e.deltaY < 0 ? 1 : -1)
    }
    containerRef.current.addEventListener('wheel', onWheel, { passive: false })

    // Ctrl+Plus / Ctrl+Minus / Ctrl+0 keyboard zoom
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomFontSize(1)
      } else if (e.key === '-') {
        e.preventDefault()
        zoomFontSize(-1)
      } else if (e.key === '0') {
        e.preventDefault()
        resetFontSize()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(colDebounce)
      clearTimeout(aiTimeoutRef.current)
      startObserver.disconnect()
      resizeObserver.disconnect()
      removeDragScroll()
      removeDataListener()
      removeExitListener()
      containerRef.current?.removeEventListener('contextmenu', onContextMenu)
      containerRef.current?.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      try { rendererRef.current?.dispose() } catch { /* already gone */ }
      rendererRef.current = null
      term.dispose()
      initialized.current = false
    }
  }, [sessionId])

  // ── Reactive option updates ──────────────────────────────────────────────
  useEffect(() => {
    if (!xtermRef.current) return
    const term = xtermRef.current
    term.options.theme = buildXtermTheme(theme)
    term.options.fontSize = (theme.id === 'fallout' || theme.id === 'amber-crt') ? Math.max(settings.fontSize, 18) : settings.fontSize
    term.options.fontFamily = theme.id === 'commodore64' ? "'Commodore 64', monospace" : (theme.id === 'fallout' || theme.id === 'amber-crt') ? "'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace" : theme.id === 'windows98' ? "'W95FA', 'Fixedsys', 'Consolas', monospace" : settings.fontFamily
    term.options.letterSpacing = theme.id === 'windows98' ? -4 : 0
    term.options.lineHeight = theme.id === 'commodore64' ? 1.4 : 1
    const fit = () => fitAddonRef.current?.fit()
    if (theme.id === 'windows98') {
      // Clear cached glyph atlas so WebGL/Canvas redraws with correct font metrics.
      // Fixes wrong spacing on first load; switching themes was a workaround.
      term.clearTextureAtlas()
      document.fonts.load("11px W95FA").then(() => {
        fit()
        setTimeout(fit, 50)
      }).catch(() => {
        fit()
        setTimeout(fit, 50)
      })
    } else {
      setTimeout(fit, 10)
    }
  }, [theme])

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.fontSize = (theme.id === 'fallout' || theme.id === 'amber-crt') ? Math.max(settings.fontSize, 18) : settings.fontSize
      xtermRef.current.options.fontFamily = theme.id === 'commodore64' ? "'Commodore 64', monospace" : (theme.id === 'fallout' || theme.id === 'amber-crt') ? "'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace" : theme.id === 'windows98' ? "'W95FA', 'Fixedsys', 'Consolas', monospace" : settings.fontFamily
      xtermRef.current.options.cursorStyle = settings.cursorStyle
      xtermRef.current.options.cursorBlink = settings.cursorBlink
      setTimeout(() => fitAddonRef.current?.fit(), 10)
    }
  }, [settings.fontSize, settings.fontFamily, settings.cursorStyle, settings.cursorBlink])

  // Flash zoom indicator only when user actively zooms (Ctrl+Scroll / Ctrl+±)
  useEffect(() => {
    if (fontZoomTick === 0) return
    setZoomVisible(true)
    clearTimeout(zoomTimerRef.current)
    zoomTimerRef.current = setTimeout(() => setZoomVisible(false), 1200)
    return () => clearTimeout(zoomTimerRef.current)
  }, [fontZoomTick])

  useEffect(() => {
    if (!isActive || !xtermRef.current) return
    const term = xtermRef.current
    term.focus()
    fitAddonRef.current?.fit()
    // Chromium can silently evict WebGL contexts when tabs are hidden.
    // Re-attach renderer on every activation to guarantee rendering.
    try { rendererRef.current?.dispose() } catch { /* already gone */ }
    rendererRef.current = null
    try {
      const webgl = new WebglAddon(true)
      webgl.onContextLoss(() => {
        try { webgl.dispose() } catch { /* */ }
        rendererRef.current = new CanvasAddon()
        term.loadAddon(rendererRef.current)
      })
      term.loadAddon(webgl)
      rendererRef.current = webgl
    } catch {
      rendererRef.current = new CanvasAddon()
      term.loadAddon(rendererRef.current)
    }
  }, [isActive])

  const fx = theme.effects

  const isCrt = theme.id === 'fallout' || theme.id === 'amber-crt'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: theme.colors.background,
        ...(fx?.flicker ? {
          animation: (fx.flickerIntensity ?? 0) >= 0.06
            ? `crt-flicker-strong ${Math.round(80 / (fx.flickerIntensity || 0.06))}ms steps(1) infinite`
            : `crt-flicker ${Math.round(80 / (fx.flickerIntensity || 0.04))}ms ease-in-out infinite`,
        } : {}),
      }}
    >
      <div
        ref={containerRef}
        className="terminal-container"
        style={{ width: '100%', height: isCrt ? 'calc(100% - 10px)' : '100%', padding: '4px 0 0 8px', overflow: 'hidden' }}
      />

      {/* CRT / VHS effects overlays */}
      {fx?.scanlines && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 1px,
              rgba(0,0,0,${fx.scanlineOpacity ?? 0.1}) 1px,
              rgba(0,0,0,${fx.scanlineOpacity ?? 0.1}) 2px
            )`,
          }}
        />
      )}
      {fx?.filmGrain && (
        <div
          style={{
            position: 'absolute', inset: '-10%', pointerEvents: 'none', zIndex: 11,
            opacity: fx.filmGrainOpacity ?? 0.05,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
            animation: 'grain-shift 1.2s steps(25) infinite',
          }}
        />
      )}
      {fx?.vhsTearing && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12,
            background: `linear-gradient(0deg, transparent 30%, ${theme.colors.foreground}18 50%, transparent 70%)`,
            animation: 'vhs-tear 8s infinite',
            mixBlendMode: 'screen',
          }}
        />
      )}
      {fx?.crtGlow && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9,
            boxShadow: `inset 0 0 ${60 * (fx.crtGlowIntensity ?? 0.3)}px ${20 * (fx.crtGlowIntensity ?? 0.3)}px ${fx.crtGlowColor ?? theme.colors.foreground}15,
                         inset 0 0 ${120 * (fx.crtGlowIntensity ?? 0.3)}px ${40 * (fx.crtGlowIntensity ?? 0.3)}px ${fx.crtGlowColor ?? theme.colors.foreground}08`,
            borderRadius: 'inherit',
          }}
        />
      )}
      {/* Inline autocomplete ghost pill */}
      {aiSuggestion && !aiPromptOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            background: theme.ui.bgTertiary,
            border: `1px solid ${theme.ui.border}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 12,
            color: theme.ui.textMuted,
            fontFamily: settings.fontFamily,
            maxWidth: '60%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: 0.85,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: theme.ui.accent }}>AI</span>{' '}
          <span style={{ color: theme.ui.textDim }}>{currentLineRef.current}</span>
          <span style={{ color: theme.ui.textMuted }}>
            {aiSuggestion.slice(currentLineRef.current.length)}
          </span>
          <span style={{ marginLeft: 8, color: theme.ui.textDim, fontSize: 10 }}>
            Tab ↵
          </span>
        </div>
      )}

      {/* Zoom level indicator — appears briefly on Ctrl+Scroll / Ctrl+±  */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: theme.ui.bgTertiary,
          border: `1px solid ${theme.ui.border}`,
          borderRadius: 8,
          padding: '5px 14px',
          fontSize: 12,
          fontWeight: 600,
          color: theme.ui.text,
          pointerEvents: 'none',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: zoomVisible ? 0.92 : 0,
          transition: zoomVisible ? 'opacity 0.1s' : 'opacity 0.4s',
          boxShadow: `0 2px 12px ${theme.ui.shadow ?? 'rgba(0,0,0,0.3)'}`,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <span>{Math.round((settings.fontSize / 14) * 100)}%</span>
        <span style={{ color: theme.ui.textDim, fontWeight: 400, fontSize: 11 }}>
          ({settings.fontSize}px)
        </span>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          selectedText={ctxMenu.selectedText}
          clipboardText={ctxMenu.clipboardText}
          snippets={ctxMenu.snippets}
          focusMode={getState().focusMode}
          onClose={() => setCtxMenu(null)}
          onCopy={() => {
            navigator.clipboard.writeText(ctxMenu.selectedText).catch(() => {})
            setCtxMenu(null)
          }}
          onPaste={() => {
            window.api.writePty(sessionId, ctxMenu.clipboardText)
            setCtxMenu(null)
          }}
          onPasteSnippet={cmd => {
            window.api.writePty(sessionId, cmd)
            setCtxMenu(null)
          }}
          onSendToAgent={() => openAgentPrompt(ctxMenu.selectedText)}
          onExitFocus={() => {
            const wasFullscreen = getState().focusMode === 'fullscreen'
            setState({ focusMode: 'off' })
            if (wasFullscreen) window.api.setFullScreen(false)
            setCtxMenu(null)
          }}
          ui={theme.ui}
        />
      )}

      {/* Send to Agent prompt overlay */}
      {agentPromptOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 24,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 25,
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setAgentPromptOpen(false)
              setAgentQuestion('')
              xtermRef.current?.focus()
            }
          }}
        >
          <div style={{
            width: '90%',
            maxWidth: 580,
            background: theme.ui.bgSecondary,
            border: `1px solid ${theme.ui.accent}55`,
            borderRadius: 10,
            boxShadow: `0 8px 32px ${theme.ui.shadow ?? 'rgba(0,0,0,0.4)'}`,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              borderBottom: `1px solid ${theme.ui.border}`,
              fontSize: 11, color: theme.ui.textDim,
            }}>
              <span style={{ color: theme.ui.accent, fontWeight: 600 }}>Agent</span>
              <span>{agentSelectedText ? 'What do you want to ask about the selected text? Press Enter to open a new shell.' : 'Ask the agent anything. Press Enter to open a new shell.'}</span>
            </div>

            {/* Selected text preview */}
            {agentSelectedText && (
              <div style={{
                padding: '6px 12px',
                background: theme.ui.bgTertiary,
                borderBottom: `1px solid ${theme.ui.border}`,
                fontSize: 11,
                color: theme.ui.textMuted,
                fontFamily: settings.fontFamily,
                maxHeight: 72,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}>
                {agentSelectedText}
              </div>
            )}

            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
              <input
                ref={agentPromptInputRef}
                value={agentQuestion}
                onChange={e => setAgentQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); submitAgentPrompt() }
                  if (e.key === 'Escape') {
                    setAgentPromptOpen(false)
                    setAgentQuestion('')
                    xtermRef.current?.focus()
                  }
                }}
                placeholder={agentSelectedText ? `Ask ${settings.agentCommand === 'local-llm' ? 'Local LLM' : settings.agentCommand || 'claude'} about this...` : `Ask ${settings.agentCommand === 'local-llm' ? 'Local LLM' : settings.agentCommand || 'claude'} anything...`}
                style={{
                  flex: 1,
                  background: theme.ui.bgTertiary,
                  border: `1px solid ${theme.ui.border}`,
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: 13,
                  color: theme.ui.text,
                  outline: 'none',
                  fontFamily: settings.fontFamily,
                }}
              />
              <button
                onClick={submitAgentPrompt}
                disabled={!agentQuestion.trim()}
                style={{
                  padding: '7px 14px',
                  background: theme.ui.accent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: agentQuestion.trim() ? 'pointer' : 'not-allowed',
                  opacity: agentQuestion.trim() ? 1 : 0.5,
                  transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                Open Agent ↵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI natural-language prompt overlay (Shift+Tab) */}
      {aiPromptOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 24,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) { setAiPromptOpen(false); setAiPromptText(''); xtermRef.current?.focus() } }}
        >
          <div style={{
            width: '90%',
            maxWidth: 560,
            background: theme.ui.bgSecondary,
            border: `1px solid ${theme.ui.accent}55`,
            borderRadius: 10,
            boxShadow: `0 8px 32px ${theme.ui.shadow ?? 'rgba(0,0,0,0.4)'}`,
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              borderBottom: `1px solid ${theme.ui.border}`,
              fontSize: 11, color: theme.ui.textDim,
            }}>
              <span style={{ color: theme.ui.accent, fontWeight: 600 }}>AI</span>
              <span>Ask for a command — press Enter to confirm, Esc to cancel</span>
            </div>

            {/* Input row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
              <input
                ref={aiPromptInputRef}
                value={aiPromptText}
                onChange={e => setAiPromptText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !aiPromptLoading) { e.preventDefault(); submitAiPrompt() }
                  if (e.key === 'Escape') { setAiPromptOpen(false); setAiPromptText(''); xtermRef.current?.focus() }
                }}
                placeholder="e.g. list all files modified today, kill process on port 3000..."
                disabled={aiPromptLoading}
                style={{
                  flex: 1,
                  background: theme.ui.bgTertiary,
                  border: `1px solid ${theme.ui.border}`,
                  borderRadius: 6,
                  padding: '7px 10px',
                  fontSize: 13,
                  color: theme.ui.text,
                  outline: 'none',
                  fontFamily: settings.fontFamily,
                  opacity: aiPromptLoading ? 0.6 : 1,
                }}
              />
              <button
                onClick={submitAiPrompt}
                disabled={aiPromptLoading || !aiPromptText.trim()}
                style={{
                  padding: '7px 14px',
                  background: theme.ui.accent,
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: aiPromptLoading || !aiPromptText.trim() ? 'not-allowed' : 'pointer',
                  opacity: aiPromptLoading || !aiPromptText.trim() ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {aiPromptLoading ? '...' : 'Generate ↵'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ x, y, selectedText, clipboardText, snippets, focusMode, onClose, onCopy, onPaste, onPasteSnippet, onSendToAgent, onExitFocus, ui }: {
  x: number
  y: number
  selectedText: string
  clipboardText: string
  snippets: Snippet[]
  focusMode: 'off' | 'zen' | 'fullscreen'
  onClose: () => void
  onCopy: () => void
  onPaste: () => void
  onPasteSnippet: (cmd: string) => void
  onSendToAgent: () => void
  onExitFocus: () => void
  ui: any
}) {
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const inFocus = focusMode !== 'off'

  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  const hasCopy = !!selectedText
  const hasPaste = !!clipboardText
  const hasSnippets = snippets.length > 0
  const hasAgent = true

  const menuWidth = 200
  const itemCount = (hasCopy ? 1 : 0) + (hasPaste ? 1 : 0) + (hasSnippets ? 1 : 0) + 1 + (inFocus ? 1 : 0)
  const dividers = (hasCopy || hasPaste || hasSnippets) ? 1 : 0
  const menuHeight = itemCount * 32 + 8 + dividers * 9
  const cx = Math.min(x, window.innerWidth - menuWidth - 8)
  const cy = Math.min(y, window.innerHeight - menuHeight - 8)

  const exitLabel = focusMode === 'fullscreen' ? 'Exit Fullscreen' : 'Exit Zen Mode'
  const exitIcon: 'zen-exit' = 'zen-exit'

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: cx,
        top: cy,
        width: menuWidth,
        background: ui.bgSecondary,
        border: `1px solid ${ui.border}`,
        borderRadius: 8,
        boxShadow: `0 4px 20px ${ui.shadow ?? 'rgba(0,0,0,0.4)'}`,
        zIndex: 9999,
        overflow: 'visible',
        padding: '4px 0',
      }}
    >
      {hasCopy && <CtxItem label="Copy" icon="copy" onClick={onCopy} ui={ui} />}
      {hasPaste && <CtxItem label="Paste" icon="paste" onClick={onPaste} ui={ui} />}
      {hasSnippets && (
        <CtxItemSnippets
          ui={ui}
          snippets={snippets}
          open={snippetsOpen}
          menuX={cx}
          menuWidth={menuWidth}
          onToggle={() => setSnippetsOpen(o => !o)}
          onSelect={cmd => { onPasteSnippet(cmd) }}
        />
      )}
      {(hasCopy || hasPaste || hasSnippets) && hasAgent && (
        <div style={{ height: 1, background: ui.border, margin: '4px 0' }} />
      )}
      {hasAgent && <CtxItem label="Ask Agent" icon="agent" onClick={onSendToAgent} ui={ui} accent />}
      {inFocus && (
        <>
          <div style={{ height: 1, background: ui.border, margin: '4px 0' }} />
          <CtxItem label={exitLabel} icon={exitIcon} onClick={onExitFocus} ui={ui} shortcut="Esc" />
        </>
      )}
    </div>
  )
}

// ── Snippets submenu item ──────────────────────────────────────────────────────
function CtxItemSnippets({ ui, snippets, open, menuX, menuWidth, onToggle, onSelect }: {
  ui: any
  snippets: Snippet[]
  open: boolean
  menuX: number
  menuWidth: number
  onToggle: () => void
  onSelect: (cmd: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 20)
    else setSearch('')
  }, [open])

  const filtered = search.trim()
    ? snippets.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.command.toLowerCase().includes(search.toLowerCase()) ||
        (s.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : snippets

  // Position submenu: prefer right side, flip left if not enough space
  const submenuWidth = 240
  const spaceRight = window.innerWidth - (menuX + menuWidth)
  const submenuLeft = spaceRight >= submenuWidth + 4 ? menuWidth - 1 : -(submenuWidth - 1)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 12px',
          background: open || hovered ? ui.bgTertiary : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: open || hovered ? ui.text : ui.textMuted,
          fontSize: 12,
          textAlign: 'left',
          transition: 'background 0.1s, color 0.1s',
        }}
      >
        {/* Code brackets icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
        <span style={{ flex: 1 }}>Snippets</span>
      </button>

      {open && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: -4,
            left: submenuLeft,
            width: submenuWidth,
            background: ui.bgSecondary,
            border: `1px solid ${ui.border}`,
            borderRadius: 8,
            boxShadow: `0 6px 24px ${ui.shadow ?? 'rgba(0,0,0,0.5)'}`,
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '7px 8px 5px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { e.stopPropagation(); setSearch('') }
                  // Enter on first result
                  if (e.key === 'Enter' && filtered.length > 0) onSelect(filtered[0].command)
                }}
                placeholder="Search snippets..."
                style={{
                  width: '100%',
                  padding: '4px 8px 4px 24px',
                  fontSize: 11,
                  background: ui.inputBg,
                  border: `1px solid ${ui.inputBorder}`,
                  borderRadius: 5,
                  color: ui.text,
                  outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
              />
            </div>
          </div>

          {/* Snippet list */}
          <div style={{ overflowY: 'auto', maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 11, color: ui.textDim, textAlign: 'center' }}>
                No snippets match
              </div>
            ) : (
              filtered.map(s => (
                <SnippetSubItem key={s.id} snippet={s} ui={ui} onSelect={() => onSelect(s.command)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SnippetSubItem({ snippet, ui, onSelect }: { snippet: Snippet; ui: any; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        width: '100%',
        padding: '7px 12px',
        background: hovered ? ui.bgTertiary : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: hovered ? ui.text : ui.textMuted, lineHeight: 1.2 }}>
        {snippet.name}
      </span>
      <span style={{
        fontSize: 11, fontFamily: 'monospace', color: ui.textDim,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}>
        {snippet.command}
      </span>
    </button>
  )
}

function CtxItem({ label, icon, onClick, ui, accent, shortcut }: {
  label: string
  icon: 'copy' | 'paste' | 'agent' | 'zen-exit'
  onClick: () => void
  ui: any
  accent?: boolean
  shortcut?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '7px 12px',
        background: hovered ? (accent ? `${ui.accent}22` : ui.bgTertiary) : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: accent ? (hovered ? ui.accent : ui.textMuted) : (hovered ? ui.text : ui.textMuted),
        fontSize: 12,
        textAlign: 'left',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {icon === 'copy' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ) : icon === 'paste' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
      ) : icon === 'zen-exit' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2 C12 2 13.5 8.5 22 12 C13.5 15.5 12 22 12 22 C12 22 10.5 15.5 2 12 C10.5 8.5 12 2 12 2Z" />
        </svg>
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && <span style={{ fontSize: 10, color: ui.textDim }}>{shortcut}</span>}
    </button>
  )
}
