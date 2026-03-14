import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../hooks'
import { createTab, setState, setActiveTab, getState } from '../../store'

// ── Agent catalogue ────────────────────────────────────────────────────────────

interface AgentTool {
  id: string
  name: string
  command: string
  description: string
  category: string
  checkCmd: string
  installCmds: { win?: string; mac?: string; linux?: string }
  launchCmd?: string
  homepage?: string
  docsUrl?: string
}

const AGENTS: AgentTool[] = [
  // Anthropic
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    category: 'Anthropic',
    description: 'Agentic coding assistant from Anthropic — works inside your terminal',
    checkCmd: 'claude --version',
    installCmds: {
      win: 'npm install -g @anthropic-ai/claude-code',
      mac: 'npm install -g @anthropic-ai/claude-code',
      linux: 'npm install -g @anthropic-ai/claude-code',
    },
    homepage: 'https://claude.ai/code',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  },
  // OpenAI
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    category: 'OpenAI',
    description: 'OpenAI Codex CLI — interactive coding agent in your terminal',
    checkCmd: 'codex --version',
    installCmds: {
      win: 'npm install -g @openai/codex',
      mac: 'npm install -g @openai/codex',
      linux: 'npm install -g @openai/codex',
    },
    homepage: 'https://github.com/openai/codex',
    docsUrl: 'https://github.com/openai/codex#readme',
  },
  // Aider
  {
    id: 'aider',
    name: 'Aider',
    command: 'aider',
    category: 'Open Source',
    description: 'AI pair programming in your terminal — works with GPT-4, Claude & local models',
    checkCmd: 'aider --version',
    installCmds: {
      win: 'pip install aider-chat',
      mac: 'pip install aider-chat',
      linux: 'pip install aider-chat',
    },
    homepage: 'https://aider.chat',
    docsUrl: 'https://aider.chat/docs/usage.html',
  },
  // OpenHands
  {
    id: 'openhands',
    name: 'OpenHands',
    command: 'openhands',
    category: 'Open Source',
    description: 'Open-source AI software engineer (formerly OpenDevin)',
    checkCmd: 'openhands --version',
    installCmds: {
      win: 'pip install openhands-ai',
      mac: 'pip install openhands-ai',
      linux: 'pip install openhands-ai',
    },
    homepage: 'https://www.all-hands.dev',
    docsUrl: 'https://docs.all-hands.dev',
  },
  // Gemini
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    category: 'Google',
    description: "Google's Gemini AI coding agent for the command line",
    checkCmd: 'gemini --version',
    installCmds: {
      win: 'npm install -g @google/gemini-cli',
      mac: 'npm install -g @google/gemini-cli',
      linux: 'npm install -g @google/gemini-cli',
    },
    homepage: 'https://github.com/google-gemini/gemini-cli',
    docsUrl: 'https://github.com/google-gemini/gemini-cli#readme',
  },
  // Amazon Q
  {
    id: 'amazonq',
    name: 'Amazon Q',
    command: 'q',
    category: 'AWS',
    description: 'AWS AI coding assistant and CLI agent by Amazon',
    checkCmd: 'q --version',
    installCmds: {
      win: 'winget install --id Amazon.AmazonQ -e',
      mac: 'brew install amazon-q',
      linux: 'pip install amazon-q-cli',
    },
    homepage: 'https://aws.amazon.com/q/developer',
    docsUrl: 'https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line.html',
  },
  // Goose
  {
    id: 'goose',
    name: 'Goose',
    command: 'goose',
    category: 'Open Source',
    description: 'Open-source AI agent by Block (Square) — runs tools autonomously',
    checkCmd: 'goose --version',
    installCmds: {
      win: 'winget install --id Block.Goose -e',
      mac: 'brew install block/goose/goose',
      linux: 'curl -fsSL https://github.com/block/goose/releases/latest/download/install.sh | sh',
    },
    homepage: 'https://block.github.io/goose',
    docsUrl: 'https://block.github.io/goose/docs',
  },
  // Cursor (via CLI)
  {
    id: 'continue',
    name: 'Continue',
    command: 'continue',
    category: 'Open Source',
    description: 'Open-source AI coding agent — connects to any model via config',
    checkCmd: 'continue --version',
    installCmds: {
      win: 'npm install -g @continuedev/continue',
      mac: 'npm install -g @continuedev/continue',
      linux: 'npm install -g @continuedev/continue',
    },
    homepage: 'https://continue.dev',
    docsUrl: 'https://docs.continue.dev',
  },
  // OpenClaw
  {
    id: 'openclaw',
    name: 'OpenClaw',
    command: 'openclaw',
    category: 'Open Source',
    description: 'Open-source AI coding assistant with 40+ CLI commands and multi-agent support',
    checkCmd: 'openclaw --version',
    installCmds: {
      win: 'npm install -g openclaw@latest',
      mac: 'curl -fsSL https://openclaw.ai/install.sh | bash',
      linux: 'curl -fsSL https://openclaw.ai/install.sh | bash',
    },
    launchCmd: 'openclaw agent',
    homepage: 'https://openclawlab.com',
    docsUrl: 'https://docs.openclaw.ai/cli',
  },
  // PicoClaw
  {
    id: 'picoclaw',
    name: 'PicoClaw',
    command: 'picoclaw',
    category: 'Open Source',
    description: 'Ultra-lightweight Go AI agent — <10MB RAM, multi-LLM, runs anywhere',
    checkCmd: 'picoclaw --version',
    installCmds: {
      win: 'powershell -c "Invoke-WebRequest https://github.com/sipeed/picoclaw/releases/latest/download/picoclaw_Windows_x86_64.zip -OutFile picoclaw.zip; Expand-Archive picoclaw.zip -DestinationPath $env:LOCALAPPDATA\\picoclaw; $env:Path += \';\' + $env:LOCALAPPDATA + \'\\picoclaw\'"',
      mac: 'curl -fsSL https://github.com/sipeed/picoclaw/releases/latest/download/picoclaw_Darwin_arm64.tar.gz | tar -xz -C /usr/local/bin',
      linux: 'curl -fsSL https://github.com/sipeed/picoclaw/releases/latest/download/picoclaw_Linux_x86_64.tar.gz | tar -xz -C /usr/local/bin',
    },
    launchCmd: 'picoclaw agent',
    homepage: 'https://github.com/sipeed/picoclaw',
    docsUrl: 'https://docs.picoclaw.io/docs/getting-started',
  },
]

const CATEGORIES = Array.from(new Set(AGENTS.map(a => a.category)))

// ── Agent icons ────────────────────────────────────────────────────────────────

const AGENT_ICONS: Record<string, React.ReactNode> = {
  claude: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#CC9B7A"/>
      <path d="M29.5 14L35 24L29.5 34H18.5L13 24L18.5 14H29.5Z" fill="white" opacity="0.9"/>
      <path d="M24 18L28 24L24 30H20L16 24L20 18H24Z" fill="#CC9B7A"/>
    </svg>
  ),
  codex: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#10a37f"/>
      <path d="M14 32L24 16L34 32" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 27H31" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  aider: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#7c3aed"/>
      <text x="9" y="33" fontSize="22" fontWeight="bold" fontFamily="monospace" fill="white">ai</text>
    </svg>
  ),
  openhands: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#f97316"/>
      <circle cx="24" cy="18" r="6" fill="white"/>
      <path d="M12 38c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  gemini: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#4285F4"/>
      <path d="M24 10 C24 10 30 24 24 38 C24 38 18 24 24 10Z" fill="white"/>
      <path d="M10 24 C10 24 24 18 38 24 C38 24 24 30 10 24Z" fill="white" opacity="0.8"/>
    </svg>
  ),
  amazonq: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#FF9900"/>
      <path d="M24 12C17.373 12 12 17.373 12 24C12 30.627 17.373 36 24 36C27.2 36 30.1 34.76 32.28 32.72L35 35.44C32.08 38.12 28.24 40 24 40C15.163 40 8 32.837 8 24C8 15.163 15.163 8 24 8C32.837 8 40 15.163 40 24H36C36 17.373 30.627 12 24 12Z" fill="white"/>
      <path d="M36 24L40 28L44 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  goose: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#000000"/>
      <ellipse cx="24" cy="26" rx="10" ry="8" fill="white"/>
      <circle cx="24" cy="16" r="5" fill="white"/>
      <path d="M29 14 L34 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="34" cy="10" rx="2" ry="1.2" fill="#FFA500"/>
    </svg>
  ),
  continue: (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#1e293b"/>
      <path d="M14 16H34M14 24H28M14 32H22" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round"/>
      <path d="M34 28L40 24L34 20" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  openclaw: (
    // Lobster mascot "Molty" — OpenClaw's official brand animal
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#1a0a0a"/>
      {/* Body */}
      <ellipse cx="24" cy="28" rx="8" ry="10" fill="#c0392b"/>
      {/* Head */}
      <ellipse cx="24" cy="18" rx="6" ry="5" fill="#c0392b"/>
      {/* Eyes */}
      <circle cx="21" cy="16" r="1.5" fill="white"/>
      <circle cx="27" cy="16" r="1.5" fill="white"/>
      <circle cx="21.5" cy="16" r="0.8" fill="#1a0a0a"/>
      <circle cx="27.5" cy="16" r="0.8" fill="#1a0a0a"/>
      {/* Big left claw */}
      <path d="M16 22 C11 20 9 25 12 27 C10 28 9 32 13 31 L16 28" fill="#e74c3c" stroke="#c0392b" strokeWidth="0.5"/>
      {/* Big right claw */}
      <path d="M32 22 C37 20 39 25 36 27 C38 28 39 32 35 31 L32 28" fill="#e74c3c" stroke="#c0392b" strokeWidth="0.5"/>
      {/* Left arm */}
      <path d="M18 24 L16 22" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Right arm */}
      <path d="M30 24 L32 22" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Tail fan */}
      <path d="M20 37 L19 42" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round"/>
      <path d="M24 38 L24 43" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M28 37 L29 42" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round"/>
      {/* Body segments */}
      <path d="M17 26 Q24 24 31 26" stroke="#a93226" strokeWidth="1" fill="none"/>
      <path d="M17 30 Q24 28 31 30" stroke="#a93226" strokeWidth="1" fill="none"/>
      <path d="M18 34 Q24 32 30 34" stroke="#a93226" strokeWidth="1" fill="none"/>
      {/* Antennae */}
      <path d="M21 13 L15 7" stroke="#e74c3c" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M27 13 L33 7" stroke="#e74c3c" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  picoclaw: (
    // Mantis shrimp — PicoClaw's official mascot (small but devastating punch)
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="#0d1117"/>
      {/* Body — elongated like a mantis shrimp */}
      <ellipse cx="24" cy="26" rx="10" ry="6" fill="#2ecc71" opacity="0.9"/>
      {/* Head */}
      <ellipse cx="24" cy="19" rx="6" ry="4.5" fill="#27ae60"/>
      {/* Iridescent body bands */}
      <path d="M15 24 Q24 22 33 24" stroke="#1abc9c" strokeWidth="1.2" fill="none" opacity="0.7"/>
      <path d="M15 27 Q24 25 33 27" stroke="#16a085" strokeWidth="1.2" fill="none" opacity="0.7"/>
      <path d="M15 30 Q24 28 33 30" stroke="#1abc9c" strokeWidth="1" fill="none" opacity="0.5"/>
      {/* Compound eyes — mantis shrimp have distinctive stalked eyes */}
      <circle cx="20" cy="17" r="3" fill="#8e44ad"/>
      <circle cx="28" cy="17" r="3" fill="#8e44ad"/>
      <circle cx="20" cy="17" r="1.8" fill="#9b59b6"/>
      <circle cx="28" cy="17" r="1.8" fill="#9b59b6"/>
      <circle cx="20.5" cy="16.5" r="0.8" fill="white"/>
      <circle cx="28.5" cy="16.5" r="0.8" fill="white"/>
      {/* Raptorial claws (the striking appendages) */}
      <path d="M18 22 C14 19 10 21 11 25 L15 24" fill="#f39c12" stroke="#e67e22" strokeWidth="0.5"/>
      <path d="M30 22 C34 19 38 21 37 25 L33 24" fill="#f39c12" stroke="#e67e22" strokeWidth="0.5"/>
      {/* Walking legs */}
      <path d="M17 28 L13 32" stroke="#27ae60" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M19 30 L15 35" stroke="#27ae60" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M21 31 L19 36" stroke="#27ae60" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M31 28 L35 32" stroke="#27ae60" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M29 30 L33 35" stroke="#27ae60" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M27 31 L29 36" stroke="#27ae60" strokeWidth="1.2" strokeLinecap="round"/>
      {/* Tail fan */}
      <path d="M19 32 L17 38" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round"/>
      <path d="M24 33 L24 39" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M29 32 L31 38" stroke="#2ecc71" strokeWidth="2" strokeLinecap="round"/>
      {/* Antennae */}
      <path d="M21 15 L17 9" stroke="#1abc9c" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M27 15 L31 9" stroke="#1abc9c" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DetectionStatus = 'idle' | 'checking' | 'installed' | 'missing'

interface AgentState {
  status: DetectionStatus
  version: string | null
}

type InstallPhase = 'running' | 'done' | 'failed'

interface InstallState {
  agent: AgentTool
  sessionId: string
  phase: InstallPhase
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentsSection() {
  const { theme, settings } = useStore()
  const ui = theme.ui

  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [installing, setInstalling] = useState<InstallState | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  const platform: 'win' | 'mac' | 'linux' =
    navigator.platform.toLowerCase().includes('win') ? 'win'
      : navigator.platform.toLowerCase().includes('mac') ? 'mac'
      : 'linux'

  const defaultAgentCommand = settings.agentCommand || 'claude'

  // Check all agents on mount
  useEffect(() => {
    setAgentStates(() => {
      const next: Record<string, AgentState> = {}
      for (const agent of AGENTS) next[agent.id] = { status: 'checking', version: null }
      return next
    })

    Promise.all(
      AGENTS.map(async agent => {
        const result = await window.api.checkTool(agent.checkCmd)
        return { id: agent.id, ...result }
      })
    ).then(results => {
      setAgentStates(() => {
        const next: Record<string, AgentState> = {}
        for (const r of results) {
          next[r.id] = { status: r.installed ? 'installed' : 'missing', version: r.version }
        }
        return next
      })
    })
  }, [])

  useEffect(() => {
    return () => { unlistenRef.current?.() }
  }, [])

  const recheckAgent = useCallback(async (agent: AgentTool) => {
    setAgentStates(prev => ({ ...prev, [agent.id]: { status: 'checking', version: null } }))
    const result = await window.api.checkTool(agent.checkCmd)
    setAgentStates(prev => ({
      ...prev,
      [agent.id]: { status: result.installed ? 'installed' : 'missing', version: result.version },
    }))
  }, [])

  function setDefaultAgent(command: string) {
    const newSettings = { ...settings, agentCommand: command }
    setState({ settings: newSettings })
    window.api.setSettings(newSettings)
  }

  function launchAgent(agent: AgentTool) {
    const cmd = agent.launchCmd || agent.command
    const session = createTab()
    setTimeout(async () => {
      await window.api.installTool(session.id, cmd)
      const { tabs } = getState()
      const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === session.id)
      if (idx !== -1) setActiveTab(idx)
      setState({ sidePanelOpen: false })
    }, 700)
  }

  function installAgent(agent: AgentTool) {
    const cmd = agent.installCmds[platform]
    if (!cmd) return

    unlistenRef.current?.()
    unlistenRef.current = null

    const session = createTab()
    setInstalling({ agent, sessionId: session.id, phase: 'running' })

    setTimeout(async () => {
      await window.api.installTool(session.id, cmd)

      let resolved = false
      let pollTimer: ReturnType<typeof setTimeout> | null = null

      async function pollUntilInstalled(attemptsLeft: number) {
        if (resolved) return
        const result = await window.api.checkTool(agent.checkCmd)
        if (result.installed) {
          resolved = true
          unlisten()
          unlistenRef.current = null
          setAgentStates(prev => ({
            ...prev,
            [agent.id]: { status: 'installed', version: result.version },
          }))
          setInstalling(prev => prev ? { ...prev, phase: 'done' } : null)
        } else if (attemptsLeft > 0) {
          pollTimer = setTimeout(() => pollUntilInstalled(attemptsLeft - 1), 3000)
        } else {
          resolved = true
          unlisten()
          unlistenRef.current = null
          setInstalling(prev => prev && prev.phase === 'running' ? { ...prev, phase: 'failed' } : prev)
        }
      }

      let quietTimer: ReturnType<typeof setTimeout> | null = null

      const unlisten = window.api.onPtyData(session.id, (data: string) => {
        if (resolved) return

        const chunk = data.toLowerCase()
        const hardFail =
          chunk.includes('is not recognized') ||
          chunk.includes('command not found') ||
          chunk.includes('unable to locate package') ||
          chunk.includes('no package') ||
          (chunk.includes('npm err!') && chunk.includes('not found')) ||
          (chunk.includes('error') && chunk.includes('not found'))

        if (hardFail) {
          resolved = true
          if (quietTimer) clearTimeout(quietTimer)
          unlisten()
          unlistenRef.current = null
          setInstalling(prev => prev ? { ...prev, phase: 'failed' } : null)
          return
        }

        if (quietTimer) clearTimeout(quietTimer)
        quietTimer = setTimeout(() => { pollUntilInstalled(20) }, 2000)
      })

      unlistenRef.current = unlisten

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          if (quietTimer) clearTimeout(quietTimer)
          if (pollTimer) clearTimeout(pollTimer)
          unlisten()
          unlistenRef.current = null
          setInstalling(prev =>
            prev && prev.phase === 'running' ? { ...prev, phase: 'failed' } : prev
          )
        }
      }, 300_000)
    }, 700)
  }

  function goToShell() {
    if (installing) {
      const { tabs } = getState()
      const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === installing.sessionId)
      if (idx !== -1) setActiveTab(idx)
    }
    setState({ sidePanelOpen: false })
    setInstalling(null)
  }

  function dismissInstall() {
    unlistenRef.current?.()
    unlistenRef.current = null
    setInstalling(null)
  }

  const filtered = AGENTS.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    const matchCat = !activeCategory || a.category === activeCategory
    return matchSearch && matchCat
  })

  const grouped = CATEGORIES.reduce<Record<string, AgentTool[]>>((acc, cat) => {
    const items = filtered.filter(a => a.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  const installedCount = AGENTS.filter(a => agentStates[a.id]?.status === 'installed').length
  const checkingCount = AGENTS.filter(a => agentStates[a.id]?.status === 'checking').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* Default agent banner */}
      <DefaultAgentBanner defaultCommand={defaultAgentCommand} agents={AGENTS} agentStates={agentStates} ui={ui} />

      {/* Search + summary */}
      <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search agents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>

        {/* Summary row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {checkingCount > 0 ? (
            <span style={{ fontSize: 10, color: ui.textDim }}>
              <svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, animation: 'spin 1s linear infinite' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round" />
              </svg>
              Checking…
            </span>
          ) : (
            <span style={{ fontSize: 10, color: ui.textDim }}>
              <span style={{ color: ui.success, fontWeight: 600 }}>{installedCount}</span>
              <span> / {AGENTS.length} installed</span>
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              const next: Record<string, AgentState> = {}
              for (const a of AGENTS) next[a.id] = { status: 'checking', version: null }
              setAgentStates(next)
              Promise.all(AGENTS.map(async agent => {
                const result = await window.api.checkTool(agent.checkCmd)
                setAgentStates(prev => ({ ...prev, [agent.id]: { status: result.installed ? 'installed' : 'missing', version: result.version } }))
              }))
            }}
            title="Re-check all agents"
            style={{ padding: '2px 6px', fontSize: 10, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 4, color: ui.textMuted, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}
          >
            Refresh
          </button>
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory(null)} ui={ui} />
          {CATEGORIES.map(cat => (
            <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(c => c === cat ? null : cat)} ui={ui} />
          ))}
        </div>
      </div>

      {/* Agent list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {Object.entries(grouped).map(([cat, agents]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              {cat}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {agents.map(agent => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  state={agentStates[agent.id] ?? { status: 'idle', version: null }}
                  platform={platform}
                  ui={ui}
                  isDefault={defaultAgentCommand === agent.command}
                  onInstall={() => installAgent(agent)}
                  onRecheck={() => recheckAgent(agent)}
                  onLaunch={() => launchAgent(agent)}
                  onSetDefault={() => setDefaultAgent(agent.command)}
                />
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 8, color: ui.textDim }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontSize: 12, color: ui.textMuted }}>No agents match "{search}"</span>
          </div>
        )}
      </div>

      {/* Install overlay */}
      {installing && (
        <InstallOverlay
          state={installing}
          ui={ui}
          onDismiss={dismissInstall}
          onGoToShell={goToShell}
        />
      )}
    </div>
  )
}

// ── Default agent banner ───────────────────────────────────────────────────────

function DefaultAgentBanner({ defaultCommand, agents, agentStates, ui }: {
  defaultCommand: string
  agents: AgentTool[]
  agentStates: Record<string, AgentState>
  ui: any
}) {
  const defaultAgent = agents.find(a => a.command === defaultCommand)
  const isInstalled = defaultAgent ? agentStates[defaultAgent.id]?.status === 'installed' : false

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: `1px solid ${ui.border}`,
      flexShrink: 0,
      background: `${ui.accent}0A`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Default Agent
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: ui.bgTertiary, border: `1px solid ${ui.border}`,
        }}>
          {defaultAgent && AGENT_ICONS[defaultAgent.id]
            ? <div style={{ width: 28, height: 28 }}>{AGENT_ICONS[defaultAgent.id]}</div>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><circle cx="12" cy="16" r="1" fill={ui.textDim} />
              </svg>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ui.text }}>
              {defaultAgent ? defaultAgent.name : defaultCommand}
            </span>
            {isInstalled && (
              <span style={{ fontSize: 9, color: ui.success, background: `${ui.success}18`, padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>
                ready
              </span>
            )}
            {defaultAgent && !isInstalled && agentStates[defaultAgent.id]?.status === 'missing' && (
              <span style={{ fontSize: 9, color: ui.warning, background: `${ui.warning}18`, padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>
                not installed
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: ui.textDim, marginTop: 1 }}>
            <code style={{ fontFamily: 'monospace', fontSize: 10, color: ui.accent }}>{defaultCommand}</code>
          </div>
        </div>
        {defaultAgent && defaultAgent.homepage && (
          <button
            onClick={() => window.api.openExternal(defaultAgent.homepage!)}
            title="Open homepage"
            style={{ padding: '3px 6px', fontSize: 10, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 4, color: ui.textMuted, cursor: 'pointer', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Agent Row ──────────────────────────────────────────────────────────────────

function AgentRow({ agent, state, platform, ui, isDefault, onInstall, onRecheck, onLaunch, onSetDefault }: {
  agent: AgentTool
  state: AgentState
  platform: 'win' | 'mac' | 'linux'
  ui: any
  isDefault: boolean
  onInstall: () => void
  onRecheck: () => void
  onLaunch: () => void
  onSetDefault: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const hasInstallCmd = !!agent.installCmds[platform]
  const icon = AGENT_ICONS[agent.id]
  const isInstalled = state.status === 'installed'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 8px',
        borderRadius: 6,
        background: isDefault ? `${ui.accent}10` : hovered ? ui.bgTertiary : 'transparent',
        border: `1px solid ${isDefault ? ui.accent + '44' : hovered ? ui.border : 'transparent'}`,
        transition: 'background 0.1s, border-color 0.1s',
      }}
    >
      {/* Icon box with status badge */}
      <div style={{ position: 'relative', flexShrink: 0, width: 30, height: 30 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: ui.bg,
          border: `1px solid ${ui.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          opacity: state.status === 'missing' ? 0.45 : 1,
          transition: 'opacity 0.2s',
        }}>
          {icon
            ? <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            : <span style={{ fontSize: 11, fontWeight: 700, color: ui.textMuted }}>{agent.name.slice(0, 2).toUpperCase()}</span>
          }
        </div>
        {/* Status badge */}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 12, height: 12, borderRadius: '50%',
          background: ui.bgSecondary,
          border: `1.5px solid ${ui.bgSecondary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {state.status === 'checking' ? (
            <svg style={{ animation: 'spin 1s linear infinite' }} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="3">
              <circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round" />
            </svg>
          ) : state.status === 'installed' ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="3.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: `${ui.danger}88` }} />
          )}
        </div>
        {/* Default star badge */}
        {isDefault && (
          <div style={{
            position: 'absolute', top: -3, left: -3,
            width: 13, height: 13, borderRadius: '50%',
            background: ui.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="7" height="7" viewBox="0 0 24 24" fill="white">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
        )}
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: ui.text }}>{agent.name}</span>
          {isInstalled && state.version && (
            <span style={{ fontSize: 9, color: ui.success, background: `${ui.success}18`, padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>
              v{state.version}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: ui.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.description}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hovered ? 1 : (state.status === 'missing' ? 0.6 : 0), transition: 'opacity 0.15s' }}>
        {isInstalled ? (
          <>
            <SmallBtn label="Launch" accent ui={ui} onClick={onLaunch} />
            {!isDefault && (
              <SmallBtn label="Set Default" ui={ui} onClick={onSetDefault} title="Set as default agent" />
            )}
            <SmallBtn label="↺" ui={ui} onClick={onRecheck} title="Re-check version" />
          </>
        ) : state.status === 'missing' && hasInstallCmd ? (
          <SmallBtn label="Install" accent ui={ui} onClick={onInstall} />
        ) : state.status === 'missing' && !hasInstallCmd ? (
          <span style={{ fontSize: 10, color: ui.textDim, padding: '2px 4px' }}>Manual</span>
        ) : null}
        {agent.docsUrl && hovered && (
          <SmallBtn
            label="Docs"
            ui={ui}
            onClick={() => window.api.openExternal(agent.docsUrl!)}
            title="Open documentation"
          />
        )}
      </div>
    </div>
  )
}

// ── Install Overlay ───────────────────────────────────────────────────────────

function InstallOverlay({ state, ui, onDismiss, onGoToShell }: {
  state: InstallState
  ui: any
  onDismiss: () => void
  onGoToShell: () => void
}) {
  const { agent, phase } = state
  const isRunning = phase === 'running'
  const isDone = phase === 'done'
  const isFailed = phase === 'failed'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: 24,
    }}>
      <div style={{
        background: ui.bgSecondary,
        border: `1px solid ${isFailed ? ui.danger + '55' : isDone ? ui.success + '55' : ui.border}`,
        borderRadius: 12,
        padding: '28px 24px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        boxShadow: `0 16px 48px ${ui.shadow}`,
        width: '100%', maxWidth: 300,
        transition: 'border-color 0.3s',
      }}>
        {/* Animated icon */}
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          {isRunning && (
            <svg style={{ position: 'absolute', inset: 0, animation: 'spin 1s linear infinite' }} width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" stroke={ui.accent} strokeWidth="3" strokeDasharray="100 40" strokeLinecap="round" />
            </svg>
          )}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isDone ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isFailed ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ui.danger} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </div>
        </div>

        {/* Agent icon */}
        {AGENT_ICONS[agent.id] && (
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
            {AGENT_ICONS[agent.id]}
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ui.text, marginBottom: 4 }}>
            {isDone ? `${agent.name} installed!` : isFailed ? 'Install failed' : `Installing ${agent.name}…`}
          </div>
          <div style={{ fontSize: 11, color: ui.textDim }}>
            {isDone ? 'Agent is ready to launch.' : isFailed ? 'Check the terminal for details.' : 'Running in a new terminal pane.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <PhaseStep label="Launching terminal" done active={false} ui={ui} />
          <PhaseStep label="Running installer" done={isDone} active={isRunning} failed={isFailed} ui={ui} />
          <PhaseStep label="Verifying install" done={isDone} active={false} ui={ui} />
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {isFailed ? (
            <>
              <button onClick={onDismiss} style={overlayBtnStyle(ui, false)}>Dismiss</button>
              <button onClick={onGoToShell} style={overlayBtnStyle(ui, true)}>View Terminal</button>
            </>
          ) : isDone ? (
            <button onClick={onDismiss} style={overlayBtnStyle(ui, true)}>Done</button>
          ) : (
            <>
              <button onClick={onDismiss} style={overlayBtnStyle(ui, false)}>Cancel</button>
              <button onClick={onGoToShell} style={overlayBtnStyle(ui, true)}>View Terminal</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function PhaseStep({ label, done, active, failed, ui }: { label: string; done: boolean; active: boolean; failed?: boolean; ui: any }) {
  const color = failed ? ui.danger : done ? ui.success : active ? ui.accent : ui.textDim
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
        ) : failed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.danger} strokeWidth="3" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        ) : active ? (
          <svg style={{ animation: 'spin 1s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round" /></svg>
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ui.textDim, margin: '0 auto' }} />
        )}
      </div>
      <span style={{ fontSize: 11, color, transition: 'color 0.2s' }}>{label}</span>
    </div>
  )
}

function CategoryPill({ label, active, onClick, ui }: { label: string; active: boolean; onClick: () => void; ui: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        background: active ? ui.accent : ui.bgTertiary,
        border: `1px solid ${active ? ui.accent : ui.border}`,
        borderRadius: 10,
        color: active ? '#fff' : ui.textMuted,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.borderColor = ui.accent) }}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.borderColor = ui.border) }}
    >
      {label}
    </button>
  )
}

function SmallBtn({ label, ui, onClick, accent, danger, title }: { label: string; ui: any; onClick: () => void; accent?: boolean; danger?: boolean; title?: string }) {
  const bg = accent ? ui.accent : danger ? `${ui.danger}22` : ui.bgTertiary
  const color = accent ? '#fff' : danger ? ui.danger : ui.textMuted
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ padding: '3px 8px', fontSize: 10, fontWeight: accent ? 600 : 400, background: bg, border: 'none', borderRadius: 4, color, cursor: 'pointer', transition: 'opacity 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  )
}

function overlayBtnStyle(ui: any, primary: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '7px 12px', fontSize: 12, fontWeight: primary ? 600 : 400,
    background: primary ? ui.accent : ui.bgTertiary,
    border: primary ? 'none' : `1px solid ${ui.border}`,
    borderRadius: 6, color: primary ? '#fff' : ui.textMuted,
    cursor: 'pointer', transition: 'opacity 0.15s',
  }
}
