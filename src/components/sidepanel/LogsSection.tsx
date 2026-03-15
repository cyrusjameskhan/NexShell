import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../hooks'
import { SessionLog } from '../../types'

export default function LogsSection() {
  const { theme } = useStore()
  const ui = theme.ui

  const [logs, setLogs] = useState<SessionLog[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SessionLog | null>(null)
  const [clearing, setClearing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadLogs = async () => {
    const all = await window.api.getLogs()
    setLogs(all.slice().reverse())
  }

  useEffect(() => {
    loadLogs()
    const unsubscribe = window.api.onLogAdded(() => {
      loadLogs()
    })
    return unsubscribe
  }, [])

  const handleClear = async () => {
    setClearing(true)
    setConfirmOpen(false)
    await window.api.clearLogs()
    setLogs([])
    setSelected(null)
    setClearing(false)
  }

  const handleDelete = async (id: string) => {
    await window.api.deleteLog(id)
    setLogs(prev => prev.filter(l => l.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = search.trim()
    ? logs.filter(l =>
        l.sessionName.toLowerCase().includes(search.toLowerCase()) ||
        l.shell.toLowerCase().includes(search.toLowerCase()) ||
        l.outputTail.toLowerCase().includes(search.toLowerCase())
      )
    : logs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: `1px solid ${ui.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Logs
        </span>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={logs.length === 0 || clearing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 11,
            background: `${ui.danger}18`,
            border: `1px solid ${ui.danger}33`,
            borderRadius: 4,
            color: ui.danger,
            cursor: logs.length === 0 || clearing ? 'not-allowed' : 'pointer',
            opacity: logs.length === 0 || clearing ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Clear
        </button>
      </div>

      {/* Detail view */}
      {selected ? (
        <LogDetail log={selected} ui={ui} onBack={() => setSelected(null)} onDelete={() => handleDelete(selected.id)} />
      ) : (
        <>
          {/* Search bar */}
          {logs.length > 0 && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <svg
                  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: ui.textDim, pointerEvents: 'none' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search logs..."
                  style={{
                    width: '100%',
                    background: ui.inputBg,
                    border: `1px solid ${ui.inputBorder}`,
                    borderRadius: 5,
                    padding: '5px 8px 5px 26px',
                    fontSize: 12,
                    color: ui.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                  onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: ui.textDim, lineHeight: 1, fontSize: 13,
                    }}
                  >×</button>
                )}
              </div>
            </div>
          )}

          {/* Log list */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {filtered.length === 0 ? (
              <EmptyState
                ui={ui}
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                }
                title={search ? 'No matches' : 'No Logs'}
                description={search ? 'No sessions match your search.' : 'Completed shell sessions will appear here.'}
              />
            ) : (
              <div style={{ padding: '6px 0' }}>
                {filtered.map(log => (
                  <LogRow key={log.id} log={log} ui={ui} onClick={() => setSelected(log)} onDelete={() => handleDelete(log.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div style={{
              padding: '6px 12px',
              borderTop: `1px solid ${ui.border}`,
              fontSize: 10,
              color: ui.textDim,
              flexShrink: 0,
            }}>
              {search ? `${filtered.length} of ${logs.length}` : logs.length} session{logs.length !== 1 ? 's' : ''}
            </div>
          )}
        </>
      )}
      {confirmOpen && (
        <ConfirmModal
          ui={ui}
          count={logs.length}
          onConfirm={handleClear}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}

// ── Confirm clear modal ───────────────────────────────────────────────────────

function ConfirmModal({ ui, count, onConfirm, onCancel }: {
  ui: any
  count: number
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: ui.bgSecondary,
          border: `1px solid ${ui.border}`,
          borderRadius: 8,
          padding: '18px 20px',
          width: '100%',
          maxWidth: 240,
          display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Clear all logs?</span>
          <span style={{ fontSize: 11, color: ui.textMuted, lineHeight: 1.5 }}>
            This will permanently delete {count} session log{count !== 1 ? 's' : ''} and cannot be undone.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            autoFocus
            style={{
              padding: '5px 13px', fontSize: 11, borderRadius: 5,
              background: ui.bgTertiary,
              border: `1px solid ${ui.border}`,
              color: ui.textMuted, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ui.accent; e.currentTarget.style.color = ui.text }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = ui.textMuted }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '5px 13px', fontSize: 11, borderRadius: 5,
              background: `${ui.danger}22`,
              border: `1px solid ${ui.danger}55`,
              color: ui.danger, cursor: 'pointer', fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${ui.danger}38` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${ui.danger}22` }}
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log, ui, onClick, onDelete }: { log: SessionLog; ui: any; onClick: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  const duration = formatDuration(log.endedAt - log.startedAt)
  const isError = log.exitCode !== null && log.exitCode !== 0

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: hovered ? ui.bgTertiary : 'transparent',
        borderBottom: `1px solid ${ui.border}22`,
        transition: 'background 0.1s',
      }}
    >
      <div
        onClick={onClick}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: '8px 8px 8px 12px',
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: ui.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {log.sessionName}
          </span>
          <ExitBadge exitCode={log.exitCode} ui={ui} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: ui.textDim }}>{formatDate(log.endedAt)}</span>
          <span style={{ fontSize: 10, color: ui.textDim }}>·</span>
          <span style={{ fontSize: 10, color: ui.textDim }}>{duration}</span>
          <span style={{ fontSize: 10, color: ui.textDim }}>·</span>
          <span style={{ fontSize: 10, color: isError ? ui.danger : ui.textDim, fontFamily: 'monospace' }}>
            {shellBasename(log.shell)}
          </span>
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete log"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: ui.danger,
          opacity: hovered ? 0.6 : 0,
          transition: 'opacity 0.15s',
          padding: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = hovered ? '0.6' : '0')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}

// ── Detail view ──────────────────────────────────────────────────────────────

function LogDetail({ log, ui, onBack, onDelete }: { log: SessionLog; ui: any; onBack: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const duration = formatDuration(log.endedAt - log.startedAt)

  const copyOutput = () => {
    navigator.clipboard.writeText(log.outputTail).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Back bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderBottom: `1px solid ${ui.border}`,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            color: ui.accent, fontSize: 11, padding: '2px 4px',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <button
          onClick={onDelete}
          title="Delete this log"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', fontSize: 11,
            background: `${ui.danger}18`,
            border: `1px solid ${ui.danger}33`,
            borderRadius: 4,
            color: ui.danger,
            cursor: 'pointer',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Delete
        </button>
      </div>

      {/* Meta */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${ui.border}`,
        display: 'flex', flexDirection: 'column', gap: 6,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>{log.sessionName}</span>
          <ExitBadge exitCode={log.exitCode} ui={ui} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          <MetaItem label="Started" value={formatDateTime(log.startedAt)} ui={ui} />
          <MetaItem label="Ended" value={formatDateTime(log.endedAt)} ui={ui} />
          <MetaItem label="Duration" value={duration} ui={ui} />
          <MetaItem label="Shell" value={shellBasename(log.shell)} ui={ui} mono />
        </div>
      </div>

      {/* Output tail header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: `1px solid ${ui.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Output
        </span>
        <button
          onClick={copyOutput}
          disabled={!log.outputTail}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 7px', fontSize: 10,
            background: copied ? `${ui.success}22` : `${ui.accent}18`,
            border: `1px solid ${copied ? ui.success + '44' : ui.accent + '33'}`,
            borderRadius: 4,
            color: copied ? ui.success : ui.accent,
            cursor: log.outputTail ? 'pointer' : 'not-allowed',
            opacity: log.outputTail ? 1 : 0.4,
            transition: 'background 0.2s, color 0.2s, opacity 0.2s',
          }}
        >
          {copied ? (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Output content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'auto',
        padding: '10px 12px',
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontSize: 11,
        lineHeight: 1.6,
        color: ui.textMuted,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {log.outputTail
          ? log.outputTail
          : <span style={{ color: ui.textDim, fontStyle: 'italic' }}>No output captured.</span>
        }
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ExitBadge({ exitCode, ui }: { exitCode: number | null; ui: any }) {
  if (exitCode === null) {
    return (
      <span style={{
        fontSize: 10, padding: '1px 6px', borderRadius: 3,
        background: `${ui.textDim}18`, color: ui.textDim,
        fontFamily: 'monospace',
      }}>—</span>
    )
  }
  const ok = exitCode === 0
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 3,
      background: ok ? `${ui.success}20` : `${ui.danger}20`,
      color: ok ? ui.success : ui.danger,
      fontFamily: 'monospace',
    }}>
      exit {exitCode}
    </span>
  )
}

function MetaItem({ label, value, ui, mono }: { label: string; value: string; ui: any; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: ui.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 11, color: ui.textMuted, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isYesterday) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function shellBasename(shell: string): string {
  // e.g. "powershell.exe" → "powershell", "/bin/zsh" → "zsh"
  return shell.replace(/\\/g, '/').split('/').pop()?.replace(/\.exe$/i, '') ?? shell
}

function EmptyState({ ui, icon, title, description }: {
  ui: any
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      gap: 10,
      textAlign: 'center',
    }}>
      <div style={{ color: ui.textDim, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>{title}</div>
      <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 180 }}>{description}</div>
    </div>
  )
}
