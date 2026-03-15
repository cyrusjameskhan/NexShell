import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../hooks'
import { createTab, setState, setActiveTab, getState, renameSession, registerSshConnection } from '../../store'
import { SshHost, SshKey, SshHostOs } from '../../types'

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
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [genForm, setGenForm] = useState<{ type: string; bits: string; filename: string; comment: string; passphrase: string }>({ type: 'ed25519', bits: '4096', filename: '', comment: '', passphrase: '' })
  const [genState, setGenState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [genError, setGenError] = useState('')

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

  function openGenerateKey() {
    setGenForm({ type: 'ed25519', bits: '4096', filename: '', comment: '', passphrase: '' })
    setGenState('idle')
    setGenError('')
    setIsGeneratingKey(true)
    setIsAddingKey(false)
    setEditingKey(null)
  }

  async function browseGenFilename() {
    const result = await window.api.showSaveDialog({ defaultPath: '~/.ssh/id_ed25519', title: 'Save Key As' })
    if (result) setGenForm(f => ({ ...f, filename: result }))
  }

  async function runGenerateKey() {
    if (!genForm.filename.trim()) return
    setGenState('generating')
    setGenError('')
    try {
      const res = await window.api.generateKey({
        type: genForm.type,
        bits: parseInt(genForm.bits) || 4096,
        filename: genForm.filename.trim(),
        comment: genForm.comment.trim(),
        passphrase: genForm.passphrase,
      })
      if (res.success) {
        const keyName = genForm.filename.split(/[\\/]/).pop() || genForm.filename
        persistKeys([...keys, { id: uid(), name: keyName, path: genForm.filename.trim(), comment: genForm.comment.trim() || undefined, addedAt: Date.now() }])
        setGenState('done')
      } else {
        setGenState('error')
        setGenError(res.error || 'Key generation failed')
      }
    } catch (e: any) {
      setGenState('error')
      setGenError(e?.message || 'Key generation failed')
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
    setConnecting({ host, sessionId: session.id, phase: 'launching', message: 'Starting shell...' })

    // Give PTY time to initialise, then send the SSH command
    setTimeout(() => {
      setConnecting(prev => prev ? { ...prev, phase: 'connecting', message: `Connecting to ${host.host}...` } : null)

      const cmd = buildSshCommand(host)
      window.api.writePty(session.id, cmd + '\r')

      let passwordSent = false
      let fingerprintAnswered = false
      let successScheduled = false
      let buffer = ''

      const switchToShell = (detectedOs?: SshHostOs) => {
        if (successScheduled) return
        successScheduled = true
        unlisten()
        unlistenRef.current = null
        persist(hosts.map(h => h.id === host.id ? { ...h, lastConnected: Date.now(), ...(detectedOs ? { detectedOs } : {}) } : h))
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
          setConnecting(prev => prev ? { ...prev, phase: 'authenticating', message: 'Accepting host fingerprint...' } : null)
          window.api.writePty(session.id, 'yes\r')
          return
        }

        // Password prompt
        if (!passwordSent && (buffer.includes('password:') || buffer.includes('password for '))) {
          passwordSent = true
          setConnecting(prev => prev ? { ...prev, phase: 'authenticating', message: 'Authenticating...' } : null)
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
          buffer.includes('arch linux') ||
          buffer.includes('freebsd') ||
          buffer.includes('darwin') ||
          buffer.includes('microsoft') ||
          buffer.includes('red hat') ||
          buffer.includes('raspberry pi') ||
          /[\$#>]\s*$/.test(buffer.slice(-40))

        if (connected && !successScheduled) {
          const detectedOs: SshHostOs | undefined =
            buffer.includes('raspberrypi') || buffer.includes('raspberry pi') ? 'raspberrypi' :
            buffer.includes('ubuntu') ? 'ubuntu' :
            buffer.includes('debian') ? 'debian' :
            buffer.includes('red hat') || buffer.includes('rhel') ? 'redhat' :
            buffer.includes('centos') ? 'centos' :
            buffer.includes('fedora') ? 'fedora' :
            buffer.includes('alpine') ? 'alpine' :
            buffer.includes('arch linux') ? 'arch' :
            buffer.includes('darwin') || buffer.includes('macos') || buffer.includes('mac os') ? 'macos' :
            buffer.includes('freebsd') ? 'freebsd' :
            buffer.includes('microsoft') || buffer.includes('windows') ? 'windows' :
            buffer.includes('linux') ? 'linux' :
            undefined
          switchToShell(detectedOs)
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
        {(['hosts', 'keys'] as const).map(tab => {
          const isWin98 = ui.bg === '#c0c0c0'
          const isC64 = ui.bg === '#3b2b7e'
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTabState(tab)}
              className={isWin98 && isActive ? 'win98-btn-active' : isC64 && isActive ? 'c64-btn-active' : undefined}
              style={isWin98 ? {
                padding: '4px 14px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              } : {
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? ui.accent : 'transparent'}`,
                color: isActive ? ui.accent : ui.textMuted,
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'hosts' ? 'Hosts' : 'Keys'}
            </button>
          )
        })}
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
                placeholder="Search keys..."
                value={keySearch}
                onChange={e => setKeySearch(e.target.value)}
                style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
              />
            </div>
            <button
              onClick={openGenerateKey}
              title="Generate a new SSH key pair"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ui.accent; (e.currentTarget as HTMLButtonElement).style.color = ui.accent }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ui.border; (e.currentTarget as HTMLButtonElement).style.color = ui.textMuted }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2a5 5 0 1 0 5 5"/><path d="M12 7v5l3 3"/><circle cx="17" cy="7" r="4"/><line x1="15" y1="5" x2="19" y2="5"/><line x1="17" y1="3" x2="17" y2="7"/>
              </svg>
              Generate
            </button>
            <button
              onClick={openAddKey}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: ui.bg, cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
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
            {filteredKeys.length === 0 ? (
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

          {/* Generate key form */}
          {isGeneratingKey && (
            <GenerateKeyForm
              form={genForm} setForm={setGenForm}
              ui={ui}
              genState={genState}
              genError={genError}
              onGenerate={runGenerateKey}
              onBrowse={browseGenFilename}
              onCancel={() => { setIsGeneratingKey(false); setGenState('idle') }}
              onDone={() => { setIsGeneratingKey(false); setGenState('idle') }}
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
              placeholder="Search hosts..."
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
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: ui.bg, cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
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
          {filtered.length === 0 ? (
            <EmptyState ui={ui} hasSearch={!!search} />
          ) : view === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
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

        {/* Add/Edit form modal */}
        {isAdding && (
          <HostForm form={form} setForm={setForm} editing={editing} ui={ui}
            keys={keys}
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
              Opening shell...
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
    borderRadius: 6, color: primary ? ui.bg : ui.textMuted,
    cursor: 'pointer', transition: 'opacity 0.15s',
  }
}

// ── More (...) dropdown for host actions ───────────────────────────────────────
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
          transition: 'background 0.1s, color 0.1s, border-color 0.1s',
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

// ── OS Icon — real brand SVG paths from Simple Icons ─────────────────────────
const OS_PATHS: Partial<Record<NonNullable<SshHostOs>, string>> = {
  ubuntu:
    'M17.61.455a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zM12.92.8C8.923.777 5.137 2.941 3.148 6.451a4.5 4.5 0 0 1 .26-.007 4.92 4.92 0 0 1 2.585.737A8.316 8.316 0 0 1 12.688 3.6 4.944 4.944 0 0 1 13.723.834 11.008 11.008 0 0 0 12.92.8zm9.226 4.994a4.915 4.915 0 0 1-1.918 2.246 8.36 8.36 0 0 1-.273 8.303 4.89 4.89 0 0 1 1.632 2.54 11.156 11.156 0 0 0 .559-13.089zM3.41 7.932A3.41 3.41 0 0 0 0 11.342a3.41 3.41 0 0 0 3.41 3.409 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41zm2.027 7.866a4.908 4.908 0 0 1-2.915.358 11.1 11.1 0 0 0 7.991 6.698 11.234 11.234 0 0 0 2.422.249 4.879 4.879 0 0 1-.999-2.85 8.484 8.484 0 0 1-.836-.136 8.304 8.304 0 0 1-5.663-4.32zm11.405.928a3.41 3.41 0 0 0-3.41 3.41 3.41 3.41 0 0 0 3.41 3.41 3.41 3.41 0 0 0 3.41-3.41 3.41 3.41 0 0 0-3.41-3.41z',
  debian:
    'M13.88 12.685c-.4 0 .08.2.601.28.14-.1.27-.22.39-.33a3.001 3.001 0 01-.99.05m2.14-.53c.23-.33.4-.69.47-1.06-.06.27-.2.5-.33.73-.75.47-.07-.27 0-.56-.8 1.01-.11.6-.14.89m.781-2.05c.05-.721-.14-.501-.2-.221.07.04.13.5.2.22M12.38.31c.2.04.45.07.42.12.23-.05.28-.1-.43-.12m.43.12l-.15.03.14-.01V.43m6.633 9.944c.02.64-.2.95-.38 1.5l-.35.181c-.28.54.03.35-.17.78-.44.39-1.34 1.22-1.62 1.301-.201 0 .14-.25.19-.34-.591.4-.481.6-1.371.85l-.03-.06c-2.221 1.04-5.303-1.02-5.253-3.842-.03.17-.07.13-.12.2a3.551 3.552 0 012.001-3.501 3.361 3.362 0 013.732.48 3.341 3.342 0 00-2.721-1.3c-1.18.01-2.281.76-2.651 1.57-.6.38-.67 1.47-.93 1.661-.361 2.601.66 3.722 2.38 5.042.27.19.08.21.12.35a4.702 4.702 0 01-1.53-1.16c.23.33.47.66.8.91-.55-.18-1.27-1.3-1.48-1.35.93 1.66 3.78 2.921 5.261 2.3a6.203 6.203 0 01-2.33-.28c-.33-.16-.77-.51-.7-.57a5.802 5.803 0 005.902-.84c.44-.35.93-.94 1.07-.95-.2.32.04.16-.12.44.44-.72-.2-.3.46-1.24l.24.33c-.09-.6.74-1.321.66-2.262.19-.3.2.3 0 .97.29-.74.08-.85.15-1.46.08.2.18.42.23.63-.18-.7.2-1.2.28-1.6-.09-.05-.28.3-.32-.53 0-.37.1-.2.14-.28-.08-.05-.26-.32-.38-.861.08-.13.22.33.34.34-.08-.42-.2-.75-.2-1.08-.34-.68-.12.1-.4-.3-.34-1.091.3-.25.34-.74.54.77.84 1.96.981 2.46-.1-.6-.28-1.2-.49-1.76.16.07-.26-1.241.21-.37A7.823 7.824 0 0017.702 1.6c.18.17.42.39.33.42-.75-.45-.62-.48-.73-.67-.61-.25-.65.02-1.06 0C15.082.73 14.862.8 13.8.4l.05.23c-.77-.25-.9.1-1.73 0-.05-.04.27-.14.53-.18-.741.1-.701-.14-1.431.03.17-.13.36-.21.55-.32-.6.04-1.44.35-1.18.07C9.6.68 7.847 1.3 6.867 2.22L6.838 2c-.45.54-1.96 1.611-2.08 2.311l-.131.03c-.23.4-.38.85-.57 1.261-.3.52-.45.2-.4.28-.6 1.22-.9 2.251-1.16 3.102.18.27 0 1.65.07 2.76-.3 5.463 3.84 10.776 8.363 12.006.67.23 1.65.23 2.49.25-.99-.28-1.12-.15-2.08-.49-.7-.32-.85-.7-1.34-1.13l.2.35c-.971-.34-.57-.42-1.361-.67l.21-.27c-.31-.03-.83-.53-.97-.81l-.34.01c-.41-.501-.63-.871-.61-1.161l-.111.2c-.13-.21-1.52-1.901-.8-1.511-.13-.12-.31-.2-.5-.55l.14-.17c-.35-.44-.64-1.02-.62-1.2.2.24.32.3.45.33-.88-2.172-.93-.12-1.601-2.202l.15-.02c-.1-.16-.18-.34-.26-.51l.06-.6c-.63-.74-.18-3.102-.09-4.402.07-.54.53-1.1.88-1.981l-.21-.04c.4-.71 2.341-2.872 3.241-2.761.43-.55-.09 0-.18-.14.96-.991 1.26-.7 1.901-.88.7-.401-.6.16-.27-.151 1.2-.3.85-.7 2.421-.85.16.1-.39.14-.52.26 1-.49 3.151-.37 4.562.27 1.63.77 3.461 3.011 3.531 5.132l.08.02c-.04.85.13 1.821-.17 2.711l.2-.42M9.54 13.236l-.05.28c.26.35.47.73.8 1.01-.24-.47-.42-.66-.75-1.3m.62-.02c-.14-.15-.22-.34-.31-.52.08.32.26.6.43.88l-.12-.36m10.945-2.382l-.07.15c-.1.76-.34 1.511-.69 2.212.4-.73.65-1.541.75-2.362M12.45.12c.27-.1.66-.05.95-.12-.37.03-.74.05-1.1.1l.15.02M3.006 5.142c.07.57-.43.8.11.42.3-.66-.11-.18-.1-.42m-.64 2.661c.12-.39.15-.62.2-.84-.35.44-.17.53-.2.83',
  centos:
    'M12.076.066L8.883 3.28H3.348v5.434L0 12.01l3.349 3.298v5.39h5.374l3.285 3.236 3.285-3.236h5.43v-5.374L24 12.026l-3.232-3.252V3.321H15.31zm0 .749l2.49 2.506h-1.69v6.441l-.8.805-.81-.815V3.28H9.627zm-8.2 2.991h4.483L6.485 5.692l4.253 4.279v.654H9.94L5.674 6.423l-1.798 1.77zm5.227 0h1.635v5.415l-3.509-3.53zm4.302.043h1.687l1.83 1.842-3.517 3.539zm2.431 0h4.404v4.394l-1.83-1.842-4.241 4.267h-.764v-.69l4.261-4.287zm2.574 3.3l1.83 1.843v1.676h-5.327zm-12.735.013l3.515 3.462H3.876v-1.69zM3.348 9.454v1.697h6.377l.871.858-.782.77H3.35v1.786L.753 12.01zm17.42.068l2.488 2.503-2.533 2.55v-1.796h-6.41l-.75-.754.825-.83h6.38zm-9.502.978l.81.815.186-.188.614-.618v.686h.768l-.825.83.75.754h-.719v.808l-.842-.83-.741.73v-.707h-.7l.781-.77-.188-.186-.682-.672h.788zm-7.39 2.807h5.402l-3.603 3.55-1.798-1.772zm6.154 0h.708v.7l-4.404 4.338 1.852 1.824h-4.31v-4.342l1.798 1.77zm3.348 0h.715l4.317 4.343.186-.187 1.599-1.61v4.316h-4.366l1.853-1.825-.188-.185-4.116-4.054zm1.46 0h5.357v1.798l-1.785 1.796zm-2.83.191l.842.829v6.37h1.691l-2.532 2.495-2.533-2.495h1.79V14.23zm-1.27 1.251v5.42H8.939l-1.852-1.823zm2.64.097l3.552 3.499-1.853 1.825h-1.7z',
  fedora:
    'M12.001 0C5.376 0 .008 5.369.004 11.992H.002v9.287h.002A2.726 2.726 0 0 0 2.73 24h9.275c6.626-.004 11.993-5.372 11.993-11.997C23.998 5.375 18.628 0 12 0zm2.431 4.94c2.015 0 3.917 1.543 3.917 3.671 0 .197.001.395-.03.619a1.002 1.002 0 0 1-1.137.893 1.002 1.002 0 0 1-.842-1.175 2.61 2.61 0 0 0 .013-.337c0-1.207-.987-1.672-1.92-1.672-.934 0-1.775.784-1.777 1.672.016 1.027 0 2.046 0 3.07l1.732-.012c1.352-.028 1.368 2.009.016 1.998l-1.748.013c-.004.826.006.677.002 1.093 0 0 .015 1.01-.016 1.776-.209 2.25-2.124 4.046-4.424 4.046-2.438 0-4.448-1.993-4.448-4.437.073-2.515 2.078-4.492 4.603-4.469l1.409-.01v1.996l-1.409.013h-.007c-1.388.04-2.577.984-2.6 2.47a2.438 2.438 0 0 0 2.452 2.439c1.356 0 2.441-.987 2.441-2.437l-.001-7.557c0-.14.005-.252.02-.407.23-1.848 1.883-3.256 3.754-3.256z',
  alpine:
    'M5.998 1.607L0 12l5.998 10.393h12.004L24 12 18.002 1.607H5.998zM9.965 7.12L12.66 9.9l1.598 1.595.002-.002 2.41 2.363c-.2.14-.386.252-.563.344a3.756 3.756 0 01-.496.217 2.702 2.702 0 01-.425.111c-.131.023-.25.034-.358.034-.13 0-.242-.014-.338-.034a1.317 1.317 0 01-.24-.072.95.95 0 01-.2-.113l-1.062-1.092-3.039-3.041-1.1 1.053-3.07 3.072a.974.974 0 01-.2.111 1.274 1.274 0 01-.237.073c-.096.02-.209.033-.338.033-.108 0-.227-.009-.358-.031a2.7 2.7 0 01-.425-.114 3.748 3.748 0 01-.496-.217 5.228 5.228 0 01-.563-.343l6.803-6.727zm4.72.785l4.579 4.598 1.382 1.353a5.24 5.24 0 01-.564.344 3.73 3.73 0 01-.494.217 2.697 2.697 0 01-.426.111c-.13.023-.251.034-.36.034-.129 0-.241-.014-.337-.034a1.285 1.285 0 01-.385-.146c-.033-.02-.05-.036-.053-.04l-1.232-1.218-2.111-2.111-.334.334L12.79 9.8l1.896-1.897zm-5.966 4.12v2.529a2.128 2.128 0 01-.356-.035 2.765 2.765 0 01-.422-.116 3.708 3.708 0 01-.488-.214 5.217 5.217 0 01-.555-.34l1.82-1.825Z',
  arch:
    'M11.39.605C10.376 3.092 9.764 4.72 8.635 7.132c.693.734 1.543 1.589 2.923 2.554-1.484-.61-2.496-1.224-3.252-1.86C6.86 10.842 4.596 15.138 0 23.395c3.612-2.085 6.412-3.37 9.021-3.862a6.61 6.61 0 01-.171-1.547l.003-.115c.058-2.315 1.261-4.095 2.687-3.973 1.426.12 2.534 2.096 2.478 4.409a6.52 6.52 0 01-.146 1.243c2.58.505 5.352 1.787 8.914 3.844-.702-1.293-1.33-2.459-1.929-3.57-.943-.73-1.926-1.682-3.933-2.713 1.38.359 2.367.772 3.137 1.234-6.09-11.334-6.582-12.84-8.67-17.74z',
  macos:
    'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
  freebsd:
    'M23.682 2.406c-.001-.149-.097-.187-.24-.189h-.25v.659h.108v-.282h.102l.17.282h.122l-.184-.29c.102-.012.175-.065.172-.18zm-.382.096v-.193h.13c.06-.002.145.011.143.089.005.09-.08.107-.153.103h-.12zM21.851 1.49c1.172 1.171-2.077 6.319-2.626 6.869-.549.548-1.944.044-3.115-1.128-1.172-1.171-1.676-2.566-1.127-3.115.549-.55 5.697-3.798 6.868-2.626zM1.652 6.61C.626 4.818-.544 2.215.276 1.395c.81-.81 3.355.319 5.144 1.334A11.003 11.003 0 0 0 1.652 6.61zm18.95.418a10.584 10.584 0 0 1 1.368 5.218c0 5.874-4.762 10.636-10.637 10.636C5.459 22.882.697 18.12.697 12.246.697 6.371 5.459 1.61 11.333 1.61c1.771 0 3.441.433 4.909 1.199-.361.201-.69.398-.969.574-.428-.077-.778-.017-.998.202-.402.402-.269 1.245.263 2.2.273.539.701 1.124 1.25 1.674.103.104.208.202.315.297 1.519 1.446 3.205 2.111 3.829 1.486.267-.267.297-.728.132-1.287.167-.27.35-.584.538-.927z',
  linux:
    'M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065z',
  redhat:
    'M16.009 13.386c1.577 0 3.86-.326 3.86-2.202a1.765 1.765 0 0 0-.04-.431l-.94-4.08c-.216-.898-.406-1.305-1.982-2.093-1.223-.625-3.888-1.658-4.676-1.658-.733 0-.947.946-1.822.946-.842 0-1.467-.706-2.255-.706-.757 0-1.25.515-1.63 1.576 0 0-1.06 2.99-1.197 3.424a.81.81 0 0 0-.028.245c0 1.162 4.577 4.974 10.71 4.974m4.101-1.435c.218 1.032.218 1.14.218 1.277 0 1.765-1.984 2.745-4.593 2.745-5.895.004-11.06-3.451-11.06-5.734a2.326 2.326 0 0 1 .19-.925C2.746 9.415 0 9.794 0 12.217c0 3.969 9.405 8.861 16.851 8.861 5.71 0 7.149-2.582 7.149-4.62 0-1.605-1.387-3.425-3.887-4.512',
  raspberrypi:
    'm19.8955 10.8961-.1726-.3028c.0068-2.1746-1.0022-3.061-2.1788-3.7348.356-.0938.7237-.1711.8245-.6182.6118-.1566.7397-.4398.8011-.7398.16-.1066.6955-.4061.6394-.9211.2998-.2069.4669-.4725.3819-.8487.3222-.3515.407-.6419.2702-.9096.3868-.4805.2152-.7295.05-.9817.2897-.5254.0341-1.0887-.7758-.9944-.3221-.4733-1.0244-.3659-1.133-.3637-.1215-.1519-.2819-.2821-.7755-.219-.3197-.2851-.6771-.2364-1.0458-.0964-.4378-.3403-.7275-.0675-1.0584.0356-.53-.1706-.6513.0631-.9117.1583-.5781-.1203-.7538.1416-1.0309.4182l-.3224-.0063c-.8719.5061-1.305 1.5366-1.4585 2.0664-.1536-.5299-.5858-1.5604-1.4575-2.0664l-.3223.0063C9.942.5014 9.7663.2394 9.1883.3597 8.9279.2646 8.807.0309 8.2766.2015c-.2172-.0677-.417-.2084-.6522-.2012l.0004.0002C7.5017.0041 7.369.049 7.2185.166c-.3688-.1401-.7262-.1887-1.0459.0964-.4936-.0631-.654.0671-.7756.219C5.2887.4791 4.5862.3717 4.264.845c-.8096-.0943-1.0655.4691-.7756.9944-.1653.2521-.3366.5013.05.9819-.1367.2677-.0519.5581.2703.9096-.085.3763.0822.6418.3819.8487-.0561.515.4795.8144.6394.9211.0614.3001.1894.5832.8011.7398.1008.4472.4685.5244.8245.6183-1.1766.6737-2.1856 1.5602-2.1788 3.7348l-.1726.3028c-1.1012.7448-2.2025 2.6208-.6049 3.3646 1.3589-1.1039 2.9817-1.9064 4.7811-2.5086-2.3127 1.175-3.6568 2.125-4.393 2.934.3773 1.4895 2.3455 1.5575 3.0652 1.5157-.1473-.0676-.2703-.1485-.3139-.2728.1806-.1264.8209-.0134 1.2679-.2607-.0435.1243-.1665.2053-.3139.2728.447.2473 1.0873.1343 1.2679.2607-.0803.1249-.1607.1589-.3324.194.447.2473 1.0873.1343 1.2679.2607-.0435.1243-.1665.2053-.3139.2728.3773.0418 1.3546-.0262 2.3119.0627.7648-.4589 1.9464.1609 2.8559 1.2003.7923.9405 1.1536 2.5927.4923 3.0797-.6257.3719-2.1452.2187-3.2252-1.3095-.7283-1.2823-.6345-2.5872-.123-2.9705-.4378.3403-.7275.0675-1.0584-.0356z',
}

function OsIcon({ os, size = 20, color }: { os: SshHostOs | undefined; size?: number; color: string }) {
  const path = os ? OS_PATHS[os] : undefined
  if (path) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-label={os}>
        <path d={path} />
      </svg>
    )
  }
  // Default: server rack icon (stroke-based, no brand path)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="2.5"/><line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="2.5"/>
    </svg>
  )
}

// ── OS label ──────────────────────────────────────────────────────────────────
function osLabel(os: SshHostOs | undefined): string {
  switch (os) {
    case 'ubuntu': return 'Ubuntu'
    case 'debian': return 'Debian'
    case 'centos': return 'CentOS'
    case 'fedora': return 'Fedora'
    case 'alpine': return 'Alpine'
    case 'arch': return 'Arch'
    case 'linux': return 'Linux'
    case 'macos': return 'macOS'
    case 'freebsd': return 'FreeBSD'
    case 'windows': return 'Windows'
    case 'redhat': return 'Red Hat'
    case 'raspberrypi': return 'Raspberry Pi'
    default: return ''
  }
}

// ── Host Card (grid) ──────────────────────────────────────────────────────────
function HostCard({ host, ui, onConnect, onEdit, onDelete }: { host: SshHost; ui: any; onConnect: () => void; onEdit: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? ui.bgTertiary : ui.bg, border: `1px solid ${hovered ? ui.accent + '55' : ui.border}`, borderRadius: 10, padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'background 0.15s, border-color 0.15s', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: `${ui.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <OsIcon os={host.detectedOs} size={20} color={ui.accent} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ui.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>{host.label || host.host}</div>
          <div style={{ fontSize: 11, color: ui.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{host.user}@{host.host}</div>
        </div>
        <div style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
          <MoreMenu ui={ui} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {host.detectedOs && <Tag label={osLabel(host.detectedOs)} ui={ui} />}
        {host.port !== 22 && <Tag label={`:${host.port}`} ui={ui} />}
        {(host.tags || []).slice(0, 2).map(t => <Tag key={t} label={t} ui={ui} />)}
        {host.password && <Tag label="pw" ui={ui} />}
        {host.identityFile && <Tag label="key" ui={ui} />}
      </div>
      {host.lastConnected && <div style={{ fontSize: 10, color: ui.textDim }}>{formatRelative(host.lastConnected)}</div>}
      <div style={{ display: 'flex', gap: 4, marginTop: 'auto', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
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
      <div style={{ width: 30, height: 30, borderRadius: 6, background: `${ui.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <OsIcon os={host.detectedOs} size={15} color={ui.accent} />
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
function HostForm({ form, setForm, editing, ui, keys, onSave, onCancel }: {
  form: Omit<SshHost, 'id'>; setForm: (f: Omit<SshHost, 'id'>) => void
  editing: SshHost | null; ui: any; keys: SshKey[]; onSave: () => void; onCancel: () => void
}) {
  const f = (key: keyof Omit<SshHost, 'id'>, value: any) => setForm({ ...form, [key]: value })
  const canSave = form.host.trim() && form.user.trim()
  const [showPw, setShowPw] = useState(false)
  const [showKeyDropdown, setShowKeyDropdown] = useState(false)

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 420, maxHeight: '85%', boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>
          {editing ? 'Edit Host' : 'New Host'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
          onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      </div>
      {/* Scrollable fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              placeholder={keys.length > 0 ? '~/.ssh/id_rsa (type path or pick below)' : '~/.ssh/id_rsa (or generate one in the Keys tab)'}
              value={form.identityFile || ''}
              onChange={e => f('identityFile', e.target.value)}
              style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none', fontFamily: 'monospace' }}
              onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
              onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
            />
            {keys.length > 0 && (
              <button
                type="button"
                title="Select from saved keys"
                onClick={() => setShowKeyDropdown(v => !v)}
                style={{ padding: '5px 7px', fontSize: 11, background: showKeyDropdown ? `${ui.accent}22` : ui.bgTertiary, border: `1px solid ${showKeyDropdown ? ui.accent : ui.border}`, borderRadius: 5, color: showKeyDropdown ? ui.accent : ui.textMuted, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="8" cy="8" r="3.5"/><path d="M13 13l7 7M16 16l-2-2M13 19l-2-2"/>
                </svg>
                Keys
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showKeyDropdown ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            )}
            <button
              type="button"
              title="Browse for key file"
              onClick={async () => {
                const result = await window.api.showOpenDialog({ properties: ['openFile'], defaultPath: '~/.ssh', title: 'Select Identity File' })
                if (result && result[0]) f('identityFile', result[0])
              }}
              style={{ padding: '5px 7px', fontSize: 11, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>
          {showKeyDropdown && keys.length > 0 && (
            <div style={{ background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, overflow: 'hidden' }}>
              {keys.map(key => (
                <button
                  key={key.id}
                  type="button"
                  onClick={() => { f('identityFile', key.path); setShowKeyDropdown(false) }}
                  style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 10px', background: form.identityFile === key.path ? `${ui.accent}22` : 'transparent', border: 'none', borderBottom: `1px solid ${ui.border}`, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { if (form.identityFile !== key.path) (e.currentTarget as HTMLButtonElement).style.background = `${ui.accent}10` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = form.identityFile === key.path ? `${ui.accent}22` : 'transparent' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, color: ui.text }}>{key.name}</span>
                  <span style={{ fontSize: 10, color: ui.textDim, fontFamily: 'monospace', marginTop: 1 }}>{key.path}</span>
                </button>
              ))}
              {form.identityFile && (
                <button
                  type="button"
                  onClick={() => { f('identityFile', ''); setShowKeyDropdown(false) }}
                  style={{ width: '100%', padding: '5px 10px', background: 'transparent', border: 'none', borderTop: `1px solid ${ui.border}`, cursor: 'pointer', fontSize: 11, color: ui.textDim, textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.color = ui.danger)}
                  onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      </FormRow>
      <FormRow label="Tags" ui={ui}>
        <FormInput placeholder="prod, web (comma separated)" value={(form.tags || []).join(', ')} onChange={v => f('tags', v.split(',').map(t => t.trim()).filter(Boolean))} ui={ui} />
      </FormRow>
      <FormRow label="Notes" ui={ui}>
        <textarea
          placeholder="Optional notes..."
          value={form.notes || ''}
          onChange={e => f('notes', e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'none', padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none', fontFamily: 'inherit' }}
        />
      </FormRow>

      </div>
      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={onSave} disabled={!canSave}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 6, color: canSave ? ui.bg : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        >
          {editing ? 'Save Changes' : 'Add Host'}
        </button>
      </div>
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
  const color = accent ? ui.bg : danger ? ui.danger : ui.textMuted
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
    <button onClick={onClick} title={title} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? ui.accent : 'transparent', border: `1px solid ${active ? ui.accent : ui.border}`, borderRadius: 4, color: active ? ui.bg : ui.textMuted, cursor: 'pointer', transition: 'background 0.15s, color 0.15s, border-color 0.15s' }}>
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

// ── SSH Key Generate Form ─────────────────────────────────────────────────────
function GenerateKeyForm({ form, setForm, ui, genState, genError, onGenerate, onBrowse, onCancel, onDone }: {
  form: { type: string; bits: string; filename: string; comment: string; passphrase: string }
  setForm: (f: any) => void
  ui: any
  genState: 'idle' | 'generating' | 'done' | 'error'
  genError: string
  onGenerate: () => void
  onBrowse: () => void
  onCancel: () => void
  onDone: () => void
}) {
  const f = (key: string, value: string) => setForm((prev: any) => ({ ...prev, [key]: value }))
  const canGenerate = genState !== 'generating' && form.filename.trim().length > 0
  const keyTypes = [
    { value: 'ed25519', label: 'Ed25519 (recommended)' },
    { value: 'rsa', label: 'RSA' },
    { value: 'ecdsa', label: 'ECDSA' },
  ]
  const rsaBits = ['2048', '3072', '4096']

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', fontSize: 12,
    background: ui.inputBg, border: `1px solid ${ui.inputBorder}`,
    borderRadius: 5, color: ui.text, outline: 'none',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 420, maxHeight: '85%', boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Generate SSH Key</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
            onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {genState === 'done' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: `${ui.success ?? '#22c55e'}18`, border: `1px solid ${ui.success ?? '#22c55e'}44`, borderRadius: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ui.success ?? '#22c55e'} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: ui.success ?? '#22c55e' }}>Key pair generated!</div>
                  <div style={{ fontSize: 11, color: ui.textMuted, marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>{form.filename}</div>
                  <div style={{ fontSize: 11, color: ui.textDim, marginTop: 1 }}>Public key: {form.filename}.pub</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <FormRow label="Key Type" ui={ui}>
                <select value={form.type} onChange={e => f('type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {keyTypes.map(kt => <option key={kt.value} value={kt.value}>{kt.label}</option>)}
                </select>
              </FormRow>

              {(form.type === 'rsa' || form.type === 'ecdsa') && (
                <FormRow label="Key Size" ui={ui}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(form.type === 'ecdsa' ? ['256', '384', '521'] : rsaBits).map(b => (
                      <button key={b} onClick={() => f('bits', b)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer', background: form.bits === b ? ui.accent : ui.bgTertiary, border: `1px solid ${form.bits === b ? ui.accent : ui.border}`, color: form.bits === b ? ui.bg : ui.textMuted, fontWeight: form.bits === b ? 600 : 400 }}>{b}</button>
                    ))}
                  </div>
                </FormRow>
              )}

              <FormRow label="Save As *" ui={ui}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input placeholder="~/.ssh/id_ed25519" value={form.filename} onChange={e => f('filename', e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                    onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                    onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)} />
                  <button onClick={onBrowse} title="Choose location"
                    style={{ padding: '5px 8px', fontSize: 11, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    Browse
                  </button>
                </div>
              </FormRow>

              <FormRow label="Comment" ui={ui}>
                <input placeholder="user@host (optional)" value={form.comment} onChange={e => f('comment', e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                  onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)} />
              </FormRow>

              <FormRow label="Passphrase" ui={ui}>
                <input type="password" placeholder="Leave blank for no passphrase" value={form.passphrase} onChange={e => f('passphrase', e.target.value)}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                  onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)} />
              </FormRow>

              {genState === 'error' && (
                <div style={{ fontSize: 11, color: ui.danger, padding: '6px 8px', background: `${ui.danger}18`, borderRadius: 5, border: `1px solid ${ui.danger}44` }}>
                  {genError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${ui.border}`, flexShrink: 0 }}>
          {genState === 'done' ? (
            <button onClick={onDone} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 6, color: ui.bg, cursor: 'pointer' }}>Done</button>
          ) : (
            <>
              <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
              <button onClick={onGenerate} disabled={!canGenerate}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', fontSize: 12, fontWeight: 500, background: canGenerate ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 6, color: canGenerate ? ui.bg : ui.textDim, cursor: canGenerate ? 'pointer' : 'not-allowed' }}
                onMouseEnter={e => canGenerate && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}>
                {genState === 'generating' ? (
                  <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Generating...</>
                ) : 'Generate Key'}
              </button>
            </>
          )}
        </div>
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
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 380, maxHeight: '85%', boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>{editing ? 'Edit Key' : 'Add Key'}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
            onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FormRow label="Name" ui={ui}>
            <FormInput placeholder="My Key (optional)" value={form.name} onChange={v => f('name', v)} ui={ui} />
          </FormRow>

          <FormRow label="Path *" ui={ui}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="~/.ssh/id_rsa" value={form.path} onChange={e => f('path', e.target.value)}
                style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none', fontFamily: 'monospace' }}
                onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
                onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)} />
              <button onClick={onBrowse} title="Browse"
                style={{ padding: '5px 8px', fontSize: 11, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Browse
              </button>
            </div>
          </FormRow>

          <FormRow label="Comment" ui={ui}>
            <FormInput placeholder="Optional note..." value={form.comment} onChange={v => f('comment', v)} ui={ui} />
          </FormRow>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSave} disabled={!canSave}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 6, color: canSave ? ui.bg : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
            onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}>
            {editing ? 'Save Changes' : 'Add Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
