import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../hooks'
import { createTab, setState, setActiveTab, getState, renameSession, registerSshConnection } from '../../store'
import { SshHost, SshKey } from '../../types'

function uid() {
  return `host-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const EMPTY_FORM: Omit<SshHost, 'id'> = {
  label: '',
  host: '',
  port: 22,
  user: '',
  password: '',
  identityFile: '',
  tags: [],
  notes: '',
}

type ConnectPhase = 'launching' | 'connecting' | 'authenticating' | 'connected' | 'failed'

interface ConnectState {
  host: SshHost
  sessionId: string
  phase: ConnectPhase
  message: string
}

export default function HostsSection() {
  const { theme, tabs } = useStore()
  const ui = theme.ui

  const [activeTab, setActiveTabState] = useState<'hosts' | 'keys'>('hosts')

  // ── Hosts state ──
  const [hosts, setHostsState] = useState<SshHost[]>([])
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<SshHost | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState<Omit<SshHost, 'id'>>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<ConnectState | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  // ── Keys state ──
  const [keys, setKeysState] = useState<SshKey[]>([])
  const [keySearch, setKeySearch] = useState('')
  const [editingKey, setEditingKey] = useState<SshKey | null>(null)
  const [isAddingKey, setIsAddingKey] = useState(false)
  const [keyForm, setKeyForm] = useState<{ name: string; path: string; comment: string }>({ name: '', path: '', comment: '' })
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null)

  useEffect(() => {
    window.api.getHosts().then(loaded => {
      if (loaded?.length) setHostsState(loaded)
    })
    window.api.getKeys().then(loaded => {
      if (loaded?.length) setKeysState(loaded)
    })
  }, [])

  const persistKeys = useCallback((updated: SshKey[]) => {
    setKeysState(updated)
    window.api.setKeys(updated)
  }, [])

  const filteredKeys = keys.filter(k => {
    const q = keySearch.toLowerCase()
    return !q || k.name.toLowerCase().includes(q) || k.path.toLowerCase().includes(q) || (k.comment ?? '').toLowerCase().includes(q)
  })

  function openAddKey() {
    setKeyForm({ name: '', path: '', comment: '' })
    setEditingKey(null)
    setIsAddingKey(true)
  }
  function openEditKey(key: SshKey) {
    setKeyForm({ name: key.name, path: key.path, comment: key.comment ?? '' })
    setEditingKey(key)
    setIsAddingKey(true)
  }
  function saveKeyForm() {
    if (!keyForm.path.trim()) return
    const name = keyForm.name.trim() || keyForm.path.split(/[\\/]/).pop() || keyForm.path
    if (editingKey) {
      persistKeys(keys.map(k => k.id === editingKey.id ? { ...editingKey, name, path: keyForm.path.trim(), comment: keyForm.comment.trim() || undefined } : k))
    } else {
      persistKeys([...keys, { id: uid(), name, path: keyForm.path.trim(), comment: keyForm.comment.trim() || undefined, addedAt: Date.now() }])
    }
    setIsAddingKey(false)
    setEditingKey(null)
  }
  function deleteKey(id: string) {
    persistKeys(keys.filter(k => k.id !== id))
    setConfirmDeleteKey(null)
  }
  async function browseKeyFile() {
    const result = await window.api.showOpenDialog({ properties: ['openFile'], defaultPath: '~/.ssh' })
    if (result && result[0]) {
      const filePath = result[0]
      setKeyForm(f => ({ ...f, path: filePath, name: f.name || filePath.split(/[\\/]/).pop() || filePath }))
    }
  }

  // Cleanup PTY listener on unmount
  useEffect(() => {
    return () => { unlistenRef.current?.() }
  }, [])

  const persist = useCallback((updated: SshHost[]) => {
    setHostsState(updated)
    window.api.setHosts(updated)
  }, [])

  const filtered = hosts.filter(h => {
    const q = search.toLowerCase()
    return !q || h.label.toLowerCase().includes(q) || h.host.toLowerCase().includes(q) || h.user.toLowerCase().includes(q) || (h.tags || []).some(t => t.toLowerCase().includes(q))
  })

  function openAdd() { setForm(EMPTY_FORM); setEditing(null); setIsAdding(true) }
  function openEdit(host: SshHost) {
    setForm({ label: host.label, host: host.host, port: host.port, user: host.user, password: host.password || '', identityFile: host.identityFile || '', tags: host.tags || [], notes: host.notes || '' })
    setEditing(host); setIsAdding(true)
  }
  function saveForm() {
    if (!form.host.trim() || !form.user.trim()) return
    if (editing) {
      persist(hosts.map(h => h.id === editing.id ? { ...editing, ...form } : h))
    } else {
      persist([...hosts, { id: uid(), ...form, lastConnected: undefined }])
    }
    setIsAdding(false); setEditing(null)
  }
  function deleteHost(id: string) { persist(hosts.filter(h => h.id !== id)); setConfirmDelete(null) }

  function connectHost(host: SshHost) {
    // Clean up any previous listener
    unlistenRef.current?.()
    unlistenRef.current = null

    const session = createTab()
    const baseName = host.label || host.host
    const { sessions } = getState()
    const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`^${escaped}(?: \\((\\d+)\\))?$`)
    const matches = sessions.filter(s => s.id !== session.id && pattern.test(s.name))
    let displayName = baseName
    if (matches.length > 0) {
      const usedNums = matches.map(s => {
        const m = s.name.match(pattern)
        return m && m[1] ? parseInt(m[1], 10) : 0
      })
      let next = 1
      while (usedNums.includes(next)) next++
      displayName = `${baseName} (${next})`
    }
    renameSession(session.id, displayName)
    setConnecting({ host, sessionId: session.id, phase: 'launching', message: 'Starting shell…' })

    // Give PTY time to initialise, then send the SSH command
    setTimeout(() => {
      setConnecting(prev => prev ? { ...prev, phase: 'connecting', message: `Connecting to ${host.host}…` } : null)

      const cmd = buildSshCommand(host)
      window.api.writePty(session.id, cmd + '\r')

      let passwordSent = false
      let fingerprintAnswered = false
      let successScheduled = false
      let buffer = ''

      const switchToShell = () => {
        if (successScheduled) return
        successScheduled = true
        unlisten()
        unlistenRef.current = null
        persist(hosts.map(h => h.id === host.id ? { ...h, lastConnected: Date.now() } : h))
        registerSshConnection(session.id, host)
        setConnecting(prev => prev ? { ...prev, phase: 'connected', message: `Connected to ${host.label || host.host}` } : null)
        // Very brief flash of the success state, then auto-switch
        setTimeout(() => {
          const { tabs } = getState()
          const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === session.id)
          if (idx !== -1) setActiveTab(idx)
          setState({ sidePanelOpen: false })
          setConnecting(null)
        }, 600)
      }

      // Watch PTY output for prompts and results
      const unlisten = window.api.onPtyData(session.id, (data: string) => {
        buffer += data.toLowerCase()

        // Keep buffer manageable
        if (buffer.length > 4000) buffer = buffer.slice(-2000)

        // Failure indicators — check first so they don't get misread as success
        const failed =
          buffer.includes('connection refused') ||
          buffer.includes('no route to host') ||
          buffer.includes('permission denied') ||
          buffer.includes('host key verification failed') ||
          buffer.includes('connection timed out') ||
          buffer.includes('could not resolve') ||
          buffer.includes('network is unreachable') ||
          buffer.includes('operation timed out')

        if (failed && !successScheduled) {
          unlisten()
          unlistenRef.current = null
          const reason = buffer.includes('permission denied') ? 'Authentication failed'
            : buffer.includes('connection refused') ? 'Connection refused'
            : buffer.includes('no route to host') || buffer.includes('network is unreachable') ? 'No route to host'
            : buffer.includes('connection timed out') || buffer.includes('operation timed out') ? 'Connection timed out'
            : buffer.includes('could not resolve') ? 'Could not resolve hostname'
            : buffer.includes('host key verification failed') ? 'Host key mismatch'
            : 'Connection failed'
          setConnecting(prev => prev ? { ...prev, phase: 'failed', message: reason } : null)
          return
        }

        // Host fingerprint / known hosts prompt
        if (!fingerprintAnswered && (buffer.includes('yes/no') || buffer.includes('(yes/no') || buffer.includes('authenticity of host'))) {
          fingerprintAnswered = true
          setConnecting(prev => prev ? { ...prev, phase: 'authenticating', message: 'Accepting host fingerprint…' } : null)
          window.api.writePty(session.id, 'yes\r')
          return
        }

        // Password prompt
        if (!passwordSent && (buffer.includes('password:') || buffer.includes('password for '))) {
          passwordSent = true
          setConnecting(prev => prev ? { ...prev, phase: 'authenticating', message: 'Authenticating…' } : null)
          if (host.password) {
            window.api.writePty(session.id, host.password + '\r')
            // After sending password, give the server 8s to respond — any
            // non-failure output means we're in. We rely on the failure check
            // above catching "permission denied" if the password was wrong.
            // A settled timer covers servers that don't print a clear prompt.
            setTimeout(() => {
              if (!successScheduled && !buffer.includes('permission denied')) {
                switchToShell()
              }
            }, 3000)
          } else {
            // No stored password — open the shell so the user can type it
            unlisten()
            unlistenRef.current = null
            setTimeout(() => {
              const { tabs } = getState()
              const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === session.id)
              if (idx !== -1) setActiveTab(idx)
              setState({ sidePanelOpen: false })
              setConnecting(null)
            }, 800)
          }
          return
        }

        // Connected indicators — covers broad range of SSH server banners/prompts
        const connected =
          buffer.includes('last login') ||
          buffer.includes('welcome to') ||
          buffer.includes('linux') ||
          buffer.includes('ubuntu') ||
          buffer.includes('debian') ||
          buffer.includes('centos') ||
          buffer.includes('fedora') ||
          buffer.includes('alpine') ||
          /[\$#>]\s*$/.test(buffer.slice(-40))

        if (connected && !successScheduled) {
          switchToShell()
        }
      })

      unlistenRef.current = unlisten

      // Timeout after 20s
      setTimeout(() => {
        if (unlistenRef.current === unlisten) {
          unlisten()
          unlistenRef.current = null
          setConnecting(prev => prev && prev.phase !== 'connected' && prev.phase !== 'failed'
            ? { ...prev, phase: 'failed', message: 'Connection timed out' }
            : prev)
        }
      }, 20000)
    }, 700)
  }

  function buildSshCommand(host: SshHost): string {
    const parts = ['ssh', '-o StrictHostKeyChecking=accept-new']
    if (host.port !== 22) parts.push(`-p ${host.port}`)
    if (host.identityFile) parts.push(`-i "${host.identityFile}"`)
    parts.push(`${host.user}@${host.host}`)
    return parts.join(' ')
  }

  function dismissConnect() {
    unlistenRef.current?.()
    unlistenRef.current = null
    setConnecting(null)
  }

  function goToShell() {
    if (connecting) {
      // Find the tab index for this session in the current (live) state
      const { tabs } = getState()
      const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === connecting.sessionId)
      if (idx !== -1) {
        setActiveTab(idx)
      }
    }
    setState({ sidePanelOpen: false })
    setConnecting(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${ui.border}`, flexShrink: 0, background: ui.bgTertiary }}>
        {(['hosts', 'keys'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTabState(tab)}
            style={{
              padding: '7px 14px',
              fontSize: 11,
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? ui.accent : 'transparent'}`,
              color: activeTab === tab ? ui.accent : ui.textMuted,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'hosts' ? 'Hosts' : 'Keys'}
          </button>
        ))}
      </div>

      {/* Keys tab content */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Keys toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search keys…"
                value={keySearch}
                onChange={e => setKeySearch(e.target.value)}
                style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
              />
            </div>
            <button
              onClick={openAddKey}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
            </button>
          </div>

          {/* Keys list */}
          <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
            {filteredKeys.length === 0 && !isAddingKey ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ color: ui.textDim, opacity: 0.6 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="4"/><path d="M14 14l7 7"/><path d="M17 17l-2-2"/><path d="M14 20l-2-2"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>{keySearch ? 'No matching keys' : 'No SSH Keys'}</div>
                <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 180 }}>
                  {keySearch ? 'Try a different search term.' : 'Add your SSH private key paths to quickly reference them when connecting.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredKeys.map(key => (
                  <KeyRow key={key.id} sshKey={key} ui={ui}
                    onEdit={() => openEditKey(key)}
                    onDelete={() => setConfirmDeleteKey(key.id)}
                    onCopyPath={() => navigator.clipboard.writeText(key.path)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit key form */}
          {isAddingKey && (
            <KeyForm
              form={keyForm} setForm={setKeyForm}
              editing={editingKey} ui={ui}
              onSave={saveKeyForm}
              onCancel={() => { setIsAddingKey(false); setEditingKey(null) }}
              onBrowse={browseKeyFile}
            />
          )}

          {/* Delete confirm */}
          {confirmDeleteKey && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
              <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 12px 40px ${ui.shadow}`, maxWidth: 280, width: '100%' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Remove key?</div>
                <div style={{ fontSize: 12, color: ui.textMuted, lineHeight: 1.5 }}>
                  Remove <strong style={{ color: ui.text }}>{keys.find(k => k.id === confirmDeleteKey)?.name || 'this key'}</strong>? The file won't be deleted.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirmDeleteKey(null)} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => deleteKey(confirmDeleteKey)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: ui.danger, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hosts tab content */}
      {activeTab === 'hosts' && <>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search hosts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 1 }}>
            <ViewBtn active={view === 'grid'} onClick={() => setView('grid')} title="Grid view" ui={ui}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </ViewBtn>
            <ViewBtn active={view === 'list'} onClick={() => setView('list')} title="List view" ui={ui}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </ViewBtn>
          </div>
          <button
            onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        </div>

        {/* Host list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
          {filtered.length === 0 && !isAdding ? (
            <EmptyState ui={ui} hasSearch={!!search} />
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {filtered.map(host => (
                <HostCard key={host.id} host={host} ui={ui}
                  onConnect={() => connectHost(host)} onEdit={() => openEdit(host)} onDelete={() => setConfirmDelete(host.id)} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(host => (
                <HostRow key={host.id} host={host} ui={ui}
                  onConnect={() => connectHost(host)} onEdit={() => openEdit(host)} onDelete={() => setConfirmDelete(host.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit form */}
        {isAdding && (
          <HostForm form={form} setForm={setForm} editing={editing} ui={ui}
            onSave={saveForm} onCancel={() => { setIsAdding(false); setEditing(null) }} />
        )}

        {/* Delete confirm */}
        {confirmDelete && (
          <ConfirmDelete ui={ui}
            hostLabel={hosts.find(h => h.id === confirmDelete)?.label || 'this host'}
            onConfirm={() => deleteHost(confirmDelete)}
            onCancel={() => setConfirmDelete(null)} />
        )}

        {/* Connection overlay */}
        {connecting && (
          <ConnectOverlay
            state={connecting}
            ui={ui}
            onDismiss={dismissConnect}
            onGoToShell={goToShell}
          />
        )}
      </>}
    </div>
  )
}

// ── Connection Overlay ────────────────────────────────────────────────────────
function ConnectOverlay({ state, ui, onDismiss, onGoToShell }: {
  state: ConnectState; ui: any; onDismiss: () => void; onGoToShell: () => void
}) {
  const { phase, message, host } = state

  const isLoading = phase === 'launching' || phase === 'connecting' || phase === 'authenticating'
  const isConnected = phase === 'connected'
  const isFailed = phase === 'failed'

  const iconColor = isConnected ? ui.success : isFailed ? ui.danger : ui.accent

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
        border: `1px solid ${isFailed ? ui.danger + '55' : isConnected ? ui.success + '55' : ui.border}`,
        borderRadius: 12,
        padding: '28px 24px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        boxShadow: `0 16px 48px ${ui.shadow}`,
        width: '100%', maxWidth: 300,
        transition: 'border-color 0.3s',
      }}>
        {/* Animated icon */}
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          {/* Ring */}
          {isLoading && (
            <svg style={{ position: 'absolute', inset: 0, animation: 'spin 1s linear infinite' }} width="52" height="52" viewBox="0 0 52 52">
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <circle cx="26" cy="26" r="22" fill="none" stroke={ui.accent} strokeWidth="3" strokeDasharray="100 40" strokeLinecap="round" />
            </svg>
          )}
          {/* Center icon */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isConnected ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : isFailed ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ui.danger} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5"/>
              </svg>
            )}
          </div>
        </div>

        {/* Host label */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ui.text, marginBottom: 4 }}>
            {host.label || host.host}
          </div>
          <div style={{ fontSize: 11, color: ui.textDim }}>
            {host.user}@{host.host}{host.port !== 22 ? `:${host.port}` : ''}
          </div>
        </div>

        {/* Phase steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <PhaseStep label="Launching shell" done={phase !== 'launching'} active={phase === 'launching'} ui={ui} />
          <PhaseStep label="Connecting" done={phase === 'authenticating' || phase === 'connected' || phase === 'failed'} active={phase === 'connecting'} ui={ui} />
          <PhaseStep label="Authenticating" done={phase === 'connected'} active={phase === 'authenticating'} failed={phase === 'failed'} ui={ui} />
        </div>

        {/* Status message */}
        <div style={{
          fontSize: 11,
          color: isFailed ? ui.danger : isConnected ? ui.success : ui.textMuted,
          textAlign: 'center',
          minHeight: 16,
          transition: 'color 0.2s',
        }}>
          {message}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          {isFailed ? (
            <>
              <button onClick={onDismiss} style={btnStyle(ui, false)}>Dismiss</button>
              <button onClick={onGoToShell} style={btnStyle(ui, true)}>View Terminal</button>
            </>
          ) : isConnected ? (
            <div style={{ fontSize: 11, color: ui.textDim, textAlign: 'center', width: '100%' }}>
              Opening shell…
            </div>
          ) : (
            <button onClick={onDismiss} style={btnStyle(ui, false)}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

function PhaseStep({ label, done, active, failed, ui }: { label: string; done: boolean; active: boolean; failed?: boolean; ui: any }) {
  const color = failed ? ui.danger : done ? ui.success : active ? ui.accent : ui.textDim
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {done ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : failed ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.danger} strokeWidth="3" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        ) : active ? (
          <svg style={{ animation: 'spin 1s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="2.5"><circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round"/></svg>
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ui.textDim, margin: '0 auto' }} />
        )}
      </div>
      <span style={{ fontSize: 11, color, transition: 'color 0.2s' }}>{label}</span>
    </div>
  )
}

function btnStyle(ui: any, primary: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '7px 12px', fontSize: 12, fontWeight: primary ? 600 : 400,
    background: primary ? ui.accent : ui.bgTertiary,
    border: primary ? 'none' : `1px solid ${ui.border}`,
    borderRadius: 6, color: primary ? '#fff' : ui.textMuted,
    cursor: 'pointer', transition: 'opacity 0.15s',
  }
}

// ── More (…) dropdown for host actions ───────────────────────────────────────
function MoreMenu({ ui, onEdit, onDelete }: { ui: any; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        title="More options"
        style={{
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: open ? ui.bgTertiary : 'transparent',
          border: `1px solid ${open ? ui.border : 'transparent'}`,
          borderRadius: 4, color: ui.textMuted, cursor: 'pointer', padding: 0,
          transition: 'all 0.1s',
        }}
        onMouseEnter={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.background = ui.bgTertiary; (e.currentTarget as HTMLButtonElement).style.borderColor = ui.border } }}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' } }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 26, zIndex: 100,
          background: ui.bgSecondary, border: `1px solid ${ui.border}`,
          borderRadius: 6, boxShadow: `0 6px 20px rgba(0,0,0,0.25)`,
          overflow: 'hidden', minWidth: 110,
        }}>
          <DropdownItem
            ui={ui}
            onClick={() => { setOpen(false); onEdit() }}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            }
            label="Edit"
          />
          <DropdownItem
            ui={ui}
            danger
            onClick={() => { setOpen(false); onDelete() }}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            }
            label="Delete"
          />
        </div>
      )}
    </div>
  )
}

function DropdownItem({ ui, onClick, icon, label, danger }: { ui: any; onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const color = danger ? ui.danger : ui.text
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', fontSize: 12,
        background: hovered ? (danger ? `${ui.danger}18` : ui.bgTertiary) : 'transparent',
        border: 'none', cursor: 'pointer', color, textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Host Card (grid) ──────────────────────────────────────────────────────────
function HostCard({ host, ui, onConnect, onEdit, onDelete }: { host: SshHost; ui: any; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? ui.bgTertiary : ui.bg, border: `1px solid ${ui.border}`, borderRadius: 8, padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: 6, transition: 'background 0.15s', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${ui.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5"/>
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: ui.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host.label || host.host}</div>
          <div style={{ fontSize: 10, color: ui.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host.user}@{host.host}</div>
        </div>
        <div style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
          <MoreMenu ui={ui} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {host.port !== 22 && <Tag label={`:${host.port}`} ui={ui} />}
        {(host.tags || []).slice(0, 2).map(t => <Tag key={t} label={t} ui={ui} />)}
        {host.password && <Tag label="🔑 pw" ui={ui} />}
        {host.identityFile && <Tag label="🔐 key" ui={ui} />}
      </div>
      {host.lastConnected && <div style={{ fontSize: 9, color: ui.textDim }}>{formatRelative(host.lastConnected)}</div>}
      <div style={{ display: 'flex', gap: 4, marginTop: 2, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        <ActionBtn label="Connect" accent ui={ui} onClick={onConnect} />
      </div>
    </div>
  )
}

// ── Host Row (list) ───────────────────────────────────────────────────────────
function HostRow({ host, ui, onConnect, onEdit, onDelete }: { host: SshHost; ui: any; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 6, background: hovered ? ui.bgTertiary : 'transparent', border: `1px solid ${hovered ? ui.border : 'transparent'}`, transition: 'background 0.1s' }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${ui.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: ui.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host.label || host.host}</div>
        <div style={{ fontSize: 10, color: ui.textDim }}>{host.user}@{host.host}{host.port !== 22 ? `:${host.port}` : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {(host.tags || []).slice(0, 2).map(t => <Tag key={t} label={t} ui={ui} />)}
        {host.password && <Tag label="pw" ui={ui} />}
      </div>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', alignItems: 'center' }}>
        <IconActionBtn title="Connect" ui={ui} accent onClick={onConnect}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="5 12 19 12"/><polyline points="13 6 19 12 13 18"/></svg>
        </IconActionBtn>
        <MoreMenu ui={ui} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

// ── Add/Edit Form ─────────────────────────────────────────────────────────────
function HostForm({ form, setForm, editing, ui, onSave, onCancel }: {
  form: Omit<SshHost, 'id'>; setForm: (f: Omit<SshHost, 'id'>) => void
  editing: SshHost | null; ui: any; onSave: () => void; onCancel: () => void
}) {
  const f = (key: keyof Omit<SshHost, 'id'>, value: any) => setForm({ ...form, [key]: value })
  const canSave = form.host.trim() && form.user.trim()
  const [showPw, setShowPw] = useState(false)

  return (
    <div style={{ borderTop: `1px solid ${ui.border}`, background: ui.bgSecondary, padding: '12px 12px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {editing ? 'Edit Host' : 'New Host'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      </div>

      <FormRow label="Label" ui={ui}>
        <FormInput placeholder="My Server" value={form.label} onChange={v => f('label', v)} ui={ui} />
      </FormRow>
      <FormRow label="Host *" ui={ui}>
        <FormInput placeholder="192.168.1.1 or example.com" value={form.host} onChange={v => f('host', v)} ui={ui} />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8 }}>
        <FormRow label="User *" ui={ui}>
          <FormInput placeholder="root" value={form.user} onChange={v => f('user', v)} ui={ui} />
        </FormRow>
        <FormRow label="Port" ui={ui}>
          <FormInput placeholder="22" value={String(form.port)} onChange={v => f('port', parseInt(v) || 22)} ui={ui} />
        </FormRow>
      </div>

      {/* Password field with show/hide toggle */}
      <FormRow label="Password" ui={ui}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Leave blank to prompt on connect"
            value={form.password || ''}
            onChange={e => f('password', e.target.value)}
            style={{ width: '100%', padding: '5px 30px 5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
          <button
            type="button"
            onClick={() => setShowPw(p => !p)}
            style={{ position: 'absolute', right: 6, background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            {showPw ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </FormRow>

      <FormRow label="Identity File" ui={ui}>
        <FormInput placeholder="~/.ssh/id_rsa" value={form.identityFile || ''} onChange={v => f('identityFile', v)} ui={ui} />
      </FormRow>
      <FormRow label="Tags" ui={ui}>
        <FormInput placeholder="prod, web (comma separated)" value={(form.tags || []).join(', ')} onChange={v => f('tags', v.split(',').map(t => t.trim()).filter(Boolean))} ui={ui} />
      </FormRow>
      <FormRow label="Notes" ui={ui}>
        <textarea
          placeholder="Optional notes…"
          value={form.notes || ''}
          onChange={e => f('notes', e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'none', padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none', fontFamily: 'inherit' }}
        />
      </FormRow>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={onSave} disabled={!canSave}
          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 5, color: canSave ? '#fff' : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          {editing ? 'Save Changes' : 'Add Host'}
        </button>
      </div>
    </div>
  )
}

// ── Confirm Delete ────────────────────────────────────────────────────────────
function ConfirmDelete({ ui, hostLabel, onConfirm, onCancel }: { ui: any; hostLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 12px 40px ${ui.shadow}`, maxWidth: 280, width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Delete host?</div>
        <div style={{ fontSize: 12, color: ui.textMuted, lineHeight: 1.5 }}>Remove <strong style={{ color: ui.text }}>{hostLabel}</strong>? This cannot be undone.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: ui.danger, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ ui, hasSearch }: { ui: any; hasSearch: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ color: ui.textDim, opacity: 0.6 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5"/>
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>{hasSearch ? 'No matching hosts' : 'No SSH Hosts'}</div>
      <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 180 }}>
        {hasSearch ? 'Try a different search term.' : 'Add a host to quickly connect to remote servers.'}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Tag({ label, ui }: { label: string; ui: any }) {
  return <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${ui.accent}18`, color: ui.accent, fontWeight: 500 }}>{label}</span>
}
function ActionBtn({ label, ui, onClick, accent, danger }: { label: string; ui: any; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const bg = accent ? ui.accent : danger ? `${ui.danger}22` : ui.bgTertiary
  const color = accent ? '#fff' : danger ? ui.danger : ui.textMuted
  return (
    <button onClick={onClick} style={{ flex: accent ? 1 : undefined, padding: '3px 7px', fontSize: 10, fontWeight: accent ? 600 : 400, background: bg, border: 'none', borderRadius: 4, color, cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
      {label}
    </button>
  )
}
function IconActionBtn({ children, title, ui, onClick, accent, danger }: { children: React.ReactNode; title: string; ui: any; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const color = accent ? ui.accent : danger ? ui.danger : ui.textMuted
  return (
    <button onClick={onClick} title={title} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color, cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? `${ui.danger}22` : `${ui.accent}18` }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
      {children}
    </button>
  )
}
function ViewBtn({ children, active, onClick, title, ui }: { children: React.ReactNode; active: boolean; onClick: () => void; title: string; ui: any }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? ui.accent : 'transparent', border: `1px solid ${active ? ui.accent : ui.border}`, borderRadius: 4, color: active ? '#fff' : ui.textMuted, cursor: 'pointer', transition: 'all 0.15s' }}>
      {children}
    </button>
  )
}
function FormRow({ label, children, ui }: { label: string; children: React.ReactNode; ui: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  )
}
function FormInput({ placeholder, value, onChange, ui }: { placeholder: string; value: string; onChange: (v: string) => void; ui: any }) {
  return (
    <input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
      onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
      onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
    />
  )
}
function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── SSH Key Row ───────────────────────────────────────────────────────────────
function KeyRow({ sshKey, ui, onEdit, onDelete, onCopyPath }: {
  sshKey: SshKey; ui: any; onEdit: () => void; onDelete: () => void; onCopyPath: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopyPath()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: hovered ? ui.bgTertiary : 'transparent', border: `1px solid ${hovered ? ui.border : 'transparent'}`, transition: 'background 0.1s' }}
    >
      {/* Key icon */}
      <div style={{ width: 30, height: 30, borderRadius: 6, background: `${ui.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="4"/><path d="M14 14l7 7"/><path d="M17 17l-2-2"/><path d="M14 20l-2-2"/>
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: ui.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sshKey.name}</div>
        <div style={{ fontSize: 10, color: ui.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{sshKey.path}</div>
        {sshKey.comment && (
          <div style={{ fontSize: 10, color: ui.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{sshKey.comment}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', alignItems: 'center' }}>
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy path'}
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color: copied ? ui.success : ui.textMuted, cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ui.accent}18` }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          )}
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color: ui.textMuted, cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ui.accent}18` }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          onClick={onDelete}
          title="Remove"
          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color: ui.textMuted, cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ui.danger}18`; (e.currentTarget as HTMLButtonElement).style.color = ui.danger }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = ui.textMuted }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── SSH Key Add/Edit Form ─────────────────────────────────────────────────────
function KeyForm({ form, setForm, editing, ui, onSave, onCancel, onBrowse }: {
  form: { name: string; path: string; comment: string }
  setForm: (f: { name: string; path: string; comment: string }) => void
  editing: SshKey | null; ui: any
  onSave: () => void; onCancel: () => void; onBrowse: () => void
}) {
  const canSave = form.path.trim().length > 0
  const f = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })

  return (
    <div style={{ borderTop: `1px solid ${ui.border}`, background: ui.bgSecondary, padding: '12px 12px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {editing ? 'Edit Key' : 'Add Key'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      </div>

      <FormRow label="Name" ui={ui}>
        <FormInput placeholder="My Key (optional)" value={form.name} onChange={v => f('name', v)} ui={ui} />
      </FormRow>

      <FormRow label="Path *" ui={ui}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="~/.ssh/id_rsa"
            value={form.path}
            onChange={e => f('path', e.target.value)}
            style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none', fontFamily: 'monospace' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
          <button
            onClick={onBrowse}
            title="Browse"
            style={{ padding: '5px 8px', fontSize: 11, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Browse
          </button>
        </div>
      </FormRow>

      <FormRow label="Comment" ui={ui}>
        <FormInput placeholder="Optional note…" value={form.comment} onChange={v => f('comment', v)} ui={ui} />
      </FormRow>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={onSave} disabled={!canSave}
          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 5, color: canSave ? '#fff' : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          {editing ? 'Save Changes' : 'Add Key'}
        </button>
      </div>
    </div>
  )
}
