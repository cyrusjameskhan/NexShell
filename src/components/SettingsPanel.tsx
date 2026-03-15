import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../hooks'
import { setState, refreshAiStatus } from '../store'
import { themes } from '../themes'
import { AppSettings, TerminalTheme } from '../types'

export default function SettingsPanel() {
  const { settingsOpen, theme, settings, aiStatus } = useStore()
  const ui = theme.ui
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings)
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'ai'>('general')
  const [themeSearch, setThemeSearch] = useState('')

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  if (!settingsOpen) return null

  function save(updated: Partial<AppSettings>) {
    const next = { ...localSettings, ...updated }
    setLocalSettings(next)
    setState({ settings: next })
    window.api.setSettings(next)
  }

  function selectTheme(t: TerminalTheme) {
    setState({ theme: t })
    window.api.setTheme(t)
  }

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'appearance' as const, label: 'Appearance' },
    { id: 'ai' as const, label: 'AI' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={() => setState({ settingsOpen: false })}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520,
          maxHeight: '80vh',
          background: ui.bgSecondary,
          border: `1px solid ${ui.border}`,
          borderRadius: 12,
          boxShadow: `0 16px 48px ${ui.shadow}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${ui.border}`,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: ui.text, margin: 0 }}>Settings</h2>
          <button
            onClick={() => setState({ settingsOpen: false })}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: ui.textMuted,
              cursor: 'pointer',
              borderRadius: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{
          display: 'flex',
          gap: 2,
          padding: '0 20px',
          borderBottom: `1px solid ${ui.border}`,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: activeTab === tab.id ? ui.accent : ui.textMuted,
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${ui.accent}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SettingRow label="Font Size" ui={ui}>
                <input
                  type="number"
                  min={8}
                  max={32}
                  value={localSettings.fontSize}
                  onChange={e => save({ fontSize: Number(e.target.value) })}
                  style={inputStyle(ui)}
                />
              </SettingRow>

              <SettingRow label="Font Family" ui={ui}>
                {['fallout', 'amber-crt', 'commodore64', 'windows98'].includes(theme.id) ? (
                  <div style={{
                    ...inputStyle(ui),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    userSelect: 'none',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: 11, color: ui.textMuted }}>Overridden by theme</span>
                  </div>
                ) : (
                  <select
                    value={localSettings.fontFamily}
                    onChange={e => save({ fontFamily: e.target.value })}
                    style={inputStyle(ui)}
                  >
                    <option value="'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace">Cascadia Code</option>
                    <option value="'Fira Code', 'Cascadia Code', monospace">Fira Code</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    <option value="'Consolas', monospace">Consolas</option>
                    <option value="monospace">System Monospace</option>
                  </select>
                )}
              </SettingRow>

              <SettingRow label="Cursor Style" ui={ui}>
                <select
                  value={localSettings.cursorStyle}
                  onChange={e => save({ cursorStyle: e.target.value as any })}
                  style={inputStyle(ui)}
                >
                  <option value="bar">Bar</option>
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                </select>
              </SettingRow>

              <SettingRow label="Cursor Blink" ui={ui}>
                <Toggle
                  value={localSettings.cursorBlink}
                  onChange={v => save({ cursorBlink: v })}
                  ui={ui}
                />
              </SettingRow>

              <SettingRow label="Scrollback Lines" ui={ui}>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={1000}
                  value={localSettings.scrollback}
                  onChange={e => save({ scrollback: Number(e.target.value) })}
                  style={inputStyle(ui)}
                />
              </SettingRow>

              <SettingRow label="Log Retention" ui={ui}>
                <select
                  value={localSettings.logRetention ?? 100}
                  onChange={e => save({ logRetention: Number(e.target.value) })}
                  style={inputStyle(ui)}
                >
                  <option value={5}>Last 5 sessions</option>
                  <option value={10}>Last 10 sessions</option>
                  <option value={100}>Last 100 sessions</option>
                  <option value={-1}>Keep forever</option>
                </select>
              </SettingRow>
            </div>
          )}

          {activeTab === 'appearance' && (
            <AppearanceTab
              themes={themes}
              activeTheme={theme}
              selectTheme={selectTheme}
              themeSearch={themeSearch}
              setThemeSearch={setThemeSearch}
              opacity={localSettings.opacity ?? 1}
              onOpacityChange={v => {
                save({ opacity: v })
                window.api.setOpacity(v)
              }}
              ui={ui}
            />
          )}

          {activeTab === 'ai' && (
            <AiTab
              localSettings={localSettings}
              aiStatus={aiStatus}
              save={save}
              ui={ui}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const PROVIDER_INFO = {
  ollama: {
    label: 'Ollama',
    downloadUrl: 'https://ollama.com/download',
    installCmds: {
      win32:  'winget install Ollama.Ollama',
      darwin: 'brew install ollama',
      linux:  'curl -fsSL https://ollama.com/install.sh | sh',
    },
    afterInstall: 'Then run: ollama pull codellama',
  },
  lmstudio: {
    label: 'LM Studio',
    downloadUrl: 'https://lmstudio.ai/download',
    installCmds: {
      win32:  'winget install ElementLabs.LMStudio',
      darwin: 'brew install --cask lm-studio',
      linux:  null,
    },
    afterInstall: 'Then load a model and start the local server.',
  },
} as const

function ProviderInstallHint({ provider, ui, onRefresh }: {
  provider: 'ollama' | 'lmstudio'
  ui: any
  onRefresh: () => Promise<void>
}) {
  const info = PROVIDER_INFO[provider]
  const platform = navigator.platform.toLowerCase().includes('win') ? 'win32'
    : navigator.platform.toLowerCase().includes('mac') ? 'darwin' : 'linux'
  const installCmd = info.installCmds[platform as keyof typeof info.installCmds] ?? null
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [serverHint, setServerHint] = useState(false)

  async function handleAlreadyInstalled() {
    setChecking(true)
    setServerHint(false)
    await onRefresh()
    setChecking(false)
    // onRefresh updates the store; if the parent still shows this component
    // it means the connection still failed, so surface the server hint.
    setServerHint(true)
  }

  function copyCmd() {
    if (!installCmd) return
    navigator.clipboard.writeText(installCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const serverStartNote: Record<string, string> = {
    ollama:    'Make sure Ollama is running. Try: ollama serve',
    lmstudio:  'Open LM Studio → load a model → go to Local Server and click Start Server.',
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => window.api.openExternal(info.downloadUrl)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 10px', fontSize: 12, fontWeight: 500, borderRadius: 6,
            border: `1px solid ${ui.accent}50`,
            background: `${ui.accent}15`,
            color: ui.accent, cursor: 'pointer', transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${ui.accent}28` }}
          onMouseLeave={e => { e.currentTarget.style.background = `${ui.accent}15` }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Download {info.label}
        </button>
        <button
          onClick={handleAlreadyInstalled}
          disabled={checking}
          style={{
            padding: '6px 10px', fontSize: 12, fontWeight: 500, borderRadius: 6,
            border: `1px solid ${ui.border}`,
            background: 'transparent',
            color: checking ? ui.textDim : ui.textMuted,
            opacity: checking ? 0.6 : 1,
            cursor: checking ? 'default' : 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => { if (!checking) { e.currentTarget.style.borderColor = ui.accent; e.currentTarget.style.color = ui.accent } }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = checking ? ui.textDim : ui.textMuted }}
        >
          {checking ? 'Checking...' : 'Already installed'}
        </button>
      </div>

      {serverHint && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 7,
          padding: '8px 10px', borderRadius: 6,
          background: `${ui.warning}12`,
          border: `1px solid ${ui.warning}35`,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ui.warning} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: 12, color: ui.textMuted, lineHeight: 1.5 }}>
            {serverStartNote[provider]}
          </span>
        </div>
      )}

      {installCmd && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 6,
          background: ui.bg, border: `1px solid ${ui.border}`,
        }}>
          <code style={{ flex: 1, fontSize: 11, color: ui.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {installCmd}
          </code>
          <button
            onClick={copyCmd}
            title="Copy to clipboard"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 7px', fontSize: 11, borderRadius: 4,
              border: `1px solid ${copied ? ui.success : ui.border}`,
              background: copied ? `${ui.success}15` : 'transparent',
              color: copied ? ui.success : ui.textDim, cursor: 'pointer', transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
            }}
          >
            {copied ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <p style={{ fontSize: 11, color: ui.textDim, margin: 0 }}>{info.afterInstall}</p>
    </div>
  )
}

const AI_PROVIDERS: { id: 'ollama' | 'lmstudio' | 'custom'; label: string; defaultEndpoint: string }[] = [
  { id: 'ollama',   label: 'Ollama',    defaultEndpoint: 'http://localhost:11434' },
  { id: 'lmstudio', label: 'LM Studio', defaultEndpoint: 'http://localhost:1234' },
  { id: 'custom',   label: 'Custom',    defaultEndpoint: '' },
]

function AiTab({ localSettings, aiStatus, save, ui }: {
  localSettings: AppSettings
  aiStatus: { available: boolean; models: string[] }
  save: (updates: Partial<AppSettings>) => void
  ui: any
}) {
  const provider = localSettings.aiProvider ?? 'ollama'
  const endpoint = localSettings.aiEndpoint ?? 'http://localhost:11434'
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    doRefresh(endpoint)
  }, [])

  async function doRefresh(ep?: string) {
    setChecking(true)
    await refreshAiStatus(ep)
    setChecking(false)
  }

  async function handleProviderChange(id: 'ollama' | 'lmstudio' | 'custom') {
    const preset = AI_PROVIDERS.find(p => p.id === id)!
    const newEndpoint = id !== 'custom' ? preset.defaultEndpoint : endpoint
    save({ aiProvider: id, aiEndpoint: newEndpoint })
    if (id !== 'custom') {
      doRefresh(newEndpoint)
    }
  }

  const providerLabel = AI_PROVIDERS.find(p => p.id === provider)?.label ?? 'Ollama'
  const isOllamaCompatible = provider === 'ollama' || provider === 'lmstudio'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status badge */}
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: checking ? `${ui.accent}10` : aiStatus.available ? `${ui.success}15` : `${ui.warning}15`,
        border: `1px solid ${checking ? ui.accent : aiStatus.available ? ui.success : ui.warning}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: checking ? ui.accent : aiStatus.available ? ui.success : ui.warning,
              opacity: checking ? 0.6 : 1,
            }} />
            <span style={{ fontSize: 13, color: ui.text, fontWeight: 500 }}>
              {checking
                ? 'Checking...'
                : aiStatus.available
                  ? `${providerLabel} Connected`
                  : `${providerLabel} Not Running`}
            </span>
          </div>
          <button
            onClick={() => doRefresh(endpoint)}
            disabled={checking}
            title="Refresh connection"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', fontSize: 11, fontWeight: 500,
              borderRadius: 5, cursor: checking ? 'default' : 'pointer',
              background: 'transparent',
              border: `1px solid ${ui.border}`,
              color: checking ? ui.textDim : ui.textMuted,
              opacity: checking ? 0.5 : 1,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
            }}
            onMouseEnter={e => { if (!checking) { e.currentTarget.style.borderColor = ui.accent; e.currentTarget.style.color = ui.accent } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = checking ? ui.textDim : ui.textMuted }}
          >
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: checking ? 'rotate(360deg)' : 'none', transition: checking ? 'transform 0.6s linear' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>
        {!checking && !aiStatus.available && (provider === 'ollama' || provider === 'lmstudio') && (
          <ProviderInstallHint provider={provider} ui={ui} onRefresh={() => doRefresh(endpoint)} key={provider} />
        )}
        {!checking && !aiStatus.available && provider === 'custom' && (
          <p style={{ fontSize: 12, color: ui.textMuted, marginTop: 8, lineHeight: 1.4 }}>
            Make sure your OpenAI-compatible server is running at the configured endpoint.
          </p>
        )}
        {!checking && aiStatus.available && aiStatus.models.length > 0 && (
          <p style={{ fontSize: 12, color: ui.textMuted, marginTop: 8 }}>
            Models: {aiStatus.models.join(', ')}
          </p>
        )}
      </div>

      {/* Provider presets */}
      <div>
        <label style={{ fontSize: 12, color: ui.textMuted, display: 'block', marginBottom: 8 }}>Provider</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {AI_PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 7,
                border: `1.5px solid ${provider === p.id ? ui.accent : ui.border}`,
                background: provider === p.id ? `${ui.accent}18` : ui.bgTertiary,
                color: provider === p.id ? ui.accent : ui.textMuted,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint URL */}
      <div>
        <label style={{ fontSize: 12, color: ui.textMuted, display: 'block', marginBottom: 6 }}>
          API Endpoint
        </label>
        <input
          value={endpoint}
          onChange={e => save({ aiEndpoint: e.target.value })}
          placeholder={provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434'}
          style={{ ...inputStyle(ui), width: '100%', boxSizing: 'border-box', minWidth: 0 }}
          spellCheck={false}
        />
        {isOllamaCompatible && (
          <p style={{ fontSize: 11, color: ui.textDim, marginTop: 5 }}>
            Uses the Ollama-compatible <code style={{ color: ui.accent }}>/api/chat</code> endpoint.
          </p>
        )}
      </div>

      {provider === 'custom' && (
        <div>
          <label style={{ fontSize: 12, color: ui.textMuted, display: 'block', marginBottom: 6 }}>
            API Key
          </label>
          <input
            type="password"
            value={localSettings.aiApiKey ?? ''}
            onChange={e => save({ aiApiKey: e.target.value })}
            placeholder="sk-..."
            style={{ ...inputStyle(ui), width: '100%', boxSizing: 'border-box', minWidth: 0 }}
            spellCheck={false}
            autoComplete="off"
          />
          <p style={{ fontSize: 11, color: ui.textDim, marginTop: 5 }}>
            Sent as <code style={{ color: ui.accent }}>Authorization: Bearer &lt;key&gt;</code>
          </p>
        </div>
      )}

      <div style={{ height: 1, background: ui.border }} />

      <SettingRow label="AI Autocomplete" ui={ui}>
        <Toggle value={localSettings.aiEnabled} onChange={v => save({ aiEnabled: v })} ui={ui} />
      </SettingRow>

      <SettingRow label="AI Model" ui={ui}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={localSettings.aiModel}
            onChange={e => save({ aiModel: e.target.value })}
            style={inputStyle(ui)}
          >
            {aiStatus.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
            {!aiStatus.models.includes(localSettings.aiModel) && (
              <option value={localSettings.aiModel}>{localSettings.aiModel}</option>
            )}
          </select>
          <input
            value={localSettings.aiModel}
            onChange={e => save({ aiModel: e.target.value })}
            placeholder="model name"
            title="Or type a model name directly"
            style={{ ...inputStyle(ui), minWidth: 0, width: 120 }}
          />
        </div>
      </SettingRow>
    </div>
  )
}

function SettingRow({ label, children, ui }: { label: string; children: React.ReactNode; ui: any }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label style={{ fontSize: 13, color: ui.text, fontWeight: 400 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, ui }: { value: boolean; onChange: (v: boolean) => void; ui: any }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: value ? ui.accent : ui.bgTertiary,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

function AppearanceTab({ themes, activeTheme, selectTheme, themeSearch, setThemeSearch, opacity, onOpacityChange, ui }: {
  themes: TerminalTheme[]
  activeTheme: TerminalTheme
  selectTheme: (t: TerminalTheme) => void
  themeSearch: string
  setThemeSearch: (v: string) => void
  opacity: number
  onOpacityChange: (v: number) => void
  ui: any
}) {
  const { standard, extra } = useMemo(() => {
    const q = themeSearch.trim().toLowerCase()
    const all = q ? themes.filter(t => t.name.toLowerCase().includes(q)) : themes
    return {
      standard: all.filter(t => t.category !== 'extra'),
      extra: all.filter(t => t.category === 'extra'),
    }
  }, [themes, themeSearch])

  const totalShown = standard.length + extra.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 13, color: ui.text, fontWeight: 400 }}>Window Opacity</label>
        <select
          value={opacity >= 1 ? 'opaque' : opacity >= 0.9 ? 'high' : opacity >= 0.7 ? 'medium' : 'low'}
          onChange={e => {
            const map: Record<string, number> = { low: 0.5, medium: 0.7, high: 0.9, opaque: 1 }
            onOpacityChange(map[e.target.value])
          }}
          style={{ ...inputStyle(ui), width: 'auto' }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="opaque">Opaque</option>
        </select>
      </div>
      <div style={{ height: 1, background: ui.border, marginBottom: 4 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 13, color: ui.textMuted, fontWeight: 500 }}>Theme</label>
        <span style={{ fontSize: 11, color: ui.textDim }}>{totalShown} / {themes.length}</span>
      </div>
      <input
        placeholder="Search themes..."
        value={themeSearch}
        onChange={e => setThemeSearch(e.target.value)}
        style={{
          ...inputStyle(ui),
          minWidth: 0,
          width: '100%',
        }}
      />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}>
        {standard.map(t => (
          <ThemeCard
            key={t.id}
            theme={t}
            isActive={activeTheme.id === t.id}
            onClick={() => selectTheme(t)}
            ui={ui}
          />
        ))}
      </div>

      {extra.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <div style={{ height: 1, flex: 1, background: ui.border }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Extra Themes
            </span>
            <div style={{ height: 1, flex: 1, background: ui.border }} />
          </div>
          <div style={{ fontSize: 11, color: ui.textDim, textAlign: 'center', marginTop: -4 }}>
            CRT effects, scanlines &amp; film grain
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}>
            {extra.map(t => (
              <ThemeCard
                key={t.id}
                theme={t}
                isActive={activeTheme.id === t.id}
                onClick={() => selectTheme(t)}
                ui={ui}
              />
            ))}
          </div>
        </>
      )}

      {totalShown === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: ui.textDim }}>
          No themes match "{themeSearch}"
        </div>
      )}
    </div>
  )
}

function ThemeCard({ theme: t, isActive, onClick, ui }: {
  theme: TerminalTheme
  isActive: boolean
  onClick: () => void
  ui: any
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: 8,
        border: `2px solid ${isActive ? ui.accent : ui.border}`,
        background: t.colors.background,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {t.effects?.scanlines && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,${(t.effects.scanlineOpacity ?? 0.1) * 0.7}) 1px, rgba(0,0,0,${(t.effects.scanlineOpacity ?? 0.1) * 0.7}) 2px)`,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.colors.foreground }}>
          {t.name}
        </span>
        {t.category === 'extra' && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: t.colors.background,
            background: t.colors.foreground, borderRadius: 3,
            padding: '1px 4px', lineHeight: '12px', textTransform: 'uppercase',
            letterSpacing: 0.5, opacity: 0.8,
          }}>
            FX
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[t.colors.red, t.colors.green, t.colors.yellow, t.colors.blue, t.colors.magenta, t.colors.cyan].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
        ))}
      </div>
    </button>
  )
}

function inputStyle(ui: any): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${ui.inputBorder}`,
    background: ui.inputBg,
    color: ui.text,
    fontSize: 13,
    outline: 'none',
    minWidth: 140,
  }
}
