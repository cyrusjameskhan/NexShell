import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../hooks'
import { setState, getActiveSessionSshConnection } from '../store'
import { SftpEntry, SftpConnectOpts } from '../types'

type PanelSide = 'local' | 'remote'

interface ContextMenuState {
  x: number
  y: number
  entry: SftpEntry | null
  side: PanelSide
}

export default function SftpPanel() {
  const { sftpOpen, theme } = useStore()
  if (!sftpOpen) return null
  return <SftpPanelInner ui={theme.ui} />
}

function SftpPanelInner({ ui }: { ui: any }) {
  const sshConn = getActiveSessionSshConnection()

  const [sftpId, setSftpId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [localPath, setLocalPath] = useState('~')
  const [remotePath, setRemotePath] = useState('/')
  const [localEntries, setLocalEntries] = useState<SftpEntry[]>([])
  const [remoteEntries, setRemoteEntries] = useState<SftpEntry[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [selectedLocal, setSelectedLocal] = useState<Set<string>>(new Set())
  const [selectedRemote, setSelectedRemote] = useState<Set<string>>(new Set())
  const [transferStatus, setTransferStatus] = useState<string | null>(null)
  const [localPathInput, setLocalPathInput] = useState(localPath)
  const [remotePathInput, setRemotePathInput] = useState(remotePath)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')
  const [dropTarget, setDropTarget] = useState<PanelSide | null>(null)
  const [dragSource, setDragSource] = useState<PanelSide | null>(null)

  useEffect(() => {
    if (!sshConn) return
    setConnecting(true)
    setError(null)
    const opts: SftpConnectOpts = {
      host: sshConn.host.host,
      port: sshConn.host.port,
      user: sshConn.host.user,
      password: sshConn.host.password,
      identityFile: sshConn.host.identityFile,
    }
    window.api.sftpConnect(opts).then(async result => {
      if ('error' in result) {
        setConnecting(false)
        setError(result.error)
        return
      }
      const id = result.id
      setSftpId(id)
      // Resolve remote home directory
      const rp = await window.api.sftpRealpath(id, '.')
      setConnecting(false)
      if ('path' in rp) {
        setRemotePath(rp.path)
        setRemotePathInput(rp.path)
      }
    })
  }, [sshConn?.sessionId])

  // Close context menu on any click
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  const loadLocal = useCallback(async (dir: string) => {
    setLocalLoading(true)
    setLocalError(null)
    setSelectedLocal(new Set())
    const result = await window.api.localList(dir)
    setLocalLoading(false)
    if ('error' in result) {
      setLocalError((result as any).error)
    } else {
      const r = result as { resolvedPath: string; entries: SftpEntry[] }
      setLocalEntries(r.entries)
      setLocalPath(r.resolvedPath)
      setLocalPathInput(r.resolvedPath)
    }
  }, [])

  const loadRemote = useCallback(async (dir: string) => {
    if (!sftpId) return
    setRemoteLoading(true)
    setRemoteError(null)
    setSelectedRemote(new Set())
    const result = await window.api.sftpList(sftpId, dir)
    setRemoteLoading(false)
    if ('error' in result) {
      setRemoteError((result as any).error)
    } else {
      setRemoteEntries(result as SftpEntry[])
      setRemotePath(dir)
      setRemotePathInput(dir)
    }
  }, [sftpId])

  useEffect(() => { loadLocal(localPath) }, [])
  useEffect(() => { if (sftpId) loadRemote(remotePath) }, [sftpId])

  const close = useCallback(() => {
    if (sftpId) window.api.sftpDisconnect(sftpId)
    setState({ sftpOpen: false })
  }, [sftpId])

  const navigateLocalUp = () => {
    const isWindows = localPath.includes('\\')
    const sep = isWindows ? '\\' : '/'
    const parts = localPath.split(sep).filter(Boolean)
    if (parts.length <= 1 && isWindows) { loadLocal(parts[0] + '\\'); return }
    parts.pop()
    loadLocal(isWindows ? parts.join('\\') || parts[0] + '\\' : '/' + parts.join('/'))
  }

  const navigateRemoteUp = () => {
    const parts = remotePath.split('/').filter(Boolean)
    parts.pop()
    loadRemote('/' + parts.join('/'))
  }

  // ── Transfer logic ──

  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showStatus = (msg: string, duration = 3000) => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setTransferStatus(msg)
    statusTimer.current = setTimeout(() => setTransferStatus(null), duration)
  }

  const transferToRemote = async (files: SftpEntry[]) => {
    if (!sftpId) return
    const toTransfer = files.filter(e => !e.isDirectory)
    if (toTransfer.length === 0) return
    for (let i = 0; i < toTransfer.length; i++) {
      const f = toTransfer[i]
      showStatus(`Uploading ${f.name} (${i + 1}/${toTransfer.length})…`, 60000)
      const dest = remotePath.replace(/\/$/, '') + '/' + f.name
      const result = await window.api.sftpUpload(sftpId, f.path, dest)
      if ('error' in result) { showStatus(`Error: ${result.error}`, 5000); return }
    }
    showStatus(`Uploaded ${toTransfer.length} file${toTransfer.length !== 1 ? 's' : ''}`)
    loadRemote(remotePath)
  }

  const transferToLocal = async (files: SftpEntry[]) => {
    if (!sftpId) return
    const toTransfer = files.filter(e => !e.isDirectory)
    if (toTransfer.length === 0) return
    for (let i = 0; i < toTransfer.length; i++) {
      const f = toTransfer[i]
      showStatus(`Downloading ${f.name} (${i + 1}/${toTransfer.length})…`, 60000)
      const result = await window.api.sftpDownload(sftpId, f.path, localPath, f.name)
      if ('error' in result) { showStatus(`Error: ${result.error}`, 5000); return }
    }
    showStatus(`Downloaded ${toTransfer.length} file${toTransfer.length !== 1 ? 's' : ''}`)
    loadLocal(localPath)
  }

  // ── Drag and drop ──

  const handleDragStart = (e: React.DragEvent, entries: SftpEntry[], side: PanelSide) => {
    const data = JSON.stringify({ side, entries })
    e.dataTransfer.setData('application/sftp-entries', data)
    e.dataTransfer.effectAllowed = 'copy'
    setDragSource(side)
  }

  const handleDragEnd = () => {
    setDragSource(null)
    setDropTarget(null)
  }

  const handleDragOver = (e: React.DragEvent, side: PanelSide) => {
    if (!e.dataTransfer.types.includes('application/sftp-entries')) return
    // Only accept drops on the opposite panel
    if (dragSource === side) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropTarget(side)
  }

  const handleDragLeave = (e: React.DragEvent, side: PanelSide) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dropTarget === side) setDropTarget(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetSide: PanelSide) => {
    e.preventDefault()
    setDropTarget(null)
    setDragSource(null)
    const raw = e.dataTransfer.getData('application/sftp-entries')
    if (!raw) return
    try {
      const { side: sourceSide, entries } = JSON.parse(raw) as { side: PanelSide; entries: SftpEntry[] }
      if (sourceSide === targetSide) return
      if (sourceSide === 'local' && targetSide === 'remote') await transferToRemote(entries)
      else if (sourceSide === 'remote' && targetSide === 'local') await transferToLocal(entries)
    } catch { /* bad data */ }
  }

  // ── Context menu actions ──

  const getTargetLabel = (side: PanelSide) =>
    side === 'local' ? (sshConn?.host.label || sshConn?.host.host || 'Remote') : 'Local'

  const handleCopyTo = async (entry: SftpEntry, side: PanelSide) => {
    setCtxMenu(null)
    if (side === 'local') await transferToRemote([entry])
    else await transferToLocal([entry])
  }

  const handleCopySelectedTo = async (side: PanelSide) => {
    setCtxMenu(null)
    const selected = side === 'local' ? selectedLocal : selectedRemote
    const entries = (side === 'local' ? localEntries : remoteEntries).filter(e => selected.has(e.path))
    if (side === 'local') await transferToRemote(entries)
    else await transferToLocal(entries)
  }

  const handleNewFolder = async (side: PanelSide) => {
    setCtxMenu(null)
    const name = prompt('New folder name:')
    if (!name?.trim()) return
    if (side === 'local') {
      const isWindows = localPath.includes('\\')
      const sep = isWindows ? '\\' : '/'
      const full = localPath.replace(/[/\\]$/, '') + sep + name.trim()
      const result = await window.api.localMkdir(full)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadLocal(localPath)
    } else {
      if (!sftpId) return
      const full = remotePath.replace(/\/$/, '') + '/' + name.trim()
      const result = await window.api.sftpMkdir(sftpId, full)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadRemote(remotePath)
    }
  }

  const handleDelete = async (entry: SftpEntry, side: PanelSide) => {
    setCtxMenu(null)
    const label = entry.isDirectory ? `folder "${entry.name}"` : `"${entry.name}"`
    if (!confirm(`Delete ${label}?`)) return
    if (side === 'local') {
      const result = await window.api.localDelete(entry.path)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadLocal(localPath)
    } else {
      if (!sftpId) return
      const result = await window.api.sftpDelete(sftpId, entry.path)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadRemote(remotePath)
    }
  }

  const handleRenameStart = (entry: SftpEntry) => {
    setCtxMenu(null)
    setRenamingPath(entry.path)
    setRenamingValue(entry.name)
  }

  const handleRenameCommit = async (entry: SftpEntry, side: PanelSide) => {
    const newName = renamingValue.trim()
    setRenamingPath(null)
    if (!newName || newName === entry.name) return

    if (side === 'local') {
      const isWindows = localPath.includes('\\')
      const sep = isWindows ? '\\' : '/'
      const dir = entry.path.substring(0, entry.path.lastIndexOf(sep))
      const newPath = dir + sep + newName
      const result = await window.api.localRename(entry.path, newPath)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadLocal(localPath)
    } else {
      if (!sftpId) return
      const dir = entry.path.substring(0, entry.path.lastIndexOf('/'))
      const newPath = dir + '/' + newName
      const result = await window.api.sftpRename(sftpId, entry.path, newPath)
      if ('error' in result) showStatus(`Error: ${result.error}`, 5000)
      else loadRemote(remotePath)
    }
  }

  const handleRefresh = (side: PanelSide) => {
    setCtxMenu(null)
    if (side === 'local') loadLocal(localPath)
    else loadRemote(remotePath)
  }

  // ── Path bar key handlers ──

  const handleLocalPathKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadLocal(localPathInput)
    if (e.key === 'Escape') setLocalPathInput(localPath)
  }
  const handleRemotePathKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadRemote(remotePathInput)
    if (e.key === 'Escape') setRemotePathInput(remotePath)
  }

  // ── Renders ──

  if (!sshConn) {
    return (
      <Overlay ui={ui} onClose={() => setState({ sftpOpen: false })}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.text, marginBottom: 8 }}>No SSH Connection</div>
          <div style={{ fontSize: 12, color: ui.textMuted }}>Connect to a remote host first via the Hosts panel.</div>
        </div>
      </Overlay>
    )
  }

  if (connecting) {
    return (
      <Overlay ui={ui} onClose={() => setState({ sftpOpen: false })}>
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spinner ui={ui} />
          <div style={{ fontSize: 13, color: ui.textMuted }}>Connecting SFTP to {sshConn.host.label || sshConn.host.host}…</div>
        </div>
      </Overlay>
    )
  }

  if (error) {
    return (
      <Overlay ui={ui} onClose={() => setState({ sftpOpen: false })}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.danger, marginBottom: 8 }}>SFTP Connection Failed</div>
          <div style={{ fontSize: 12, color: ui.textMuted, marginBottom: 16 }}>{error}</div>
          <button onClick={() => setState({ sftpOpen: false })} style={{ padding: '6px 16px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.text, cursor: 'pointer' }}>Close</button>
        </div>
      </Overlay>
    )
  }

  const selectedLocalEntries = localEntries.filter(e => selectedLocal.has(e.path))
  const selectedRemoteEntries = remoteEntries.filter(e => selectedRemote.has(e.path))

  return (
    <Overlay ui={ui} onClose={close}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ui.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <polyline points="8 13 12 9 16 13" />
              <line x1="12" y1="9" x2="12" y2="17" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>SFTP</span>
            <span style={{ fontSize: 11, color: ui.textDim }}>
              {sshConn.host.user}@{sshConn.host.host}
            </span>
            <span style={{ fontSize: 10, color: ui.textDim, marginLeft: 8, opacity: 0.7 }}>
              Drag files between panels to transfer
            </span>
          </div>
          <button onClick={close} style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', color: ui.textDim, cursor: 'pointer', borderRadius: 4,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = `${ui.danger}30`; e.currentTarget.style.color = ui.danger }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textDim }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Transfer status bar */}
        {transferStatus && (
          <div style={{
            padding: '6px 16px', fontSize: 11,
            color: transferStatus.startsWith('Error') ? ui.danger : ui.accent,
            background: transferStatus.startsWith('Error') ? `${ui.danger}10` : `${ui.accent}10`,
            borderBottom: `1px solid ${ui.border}`,
          }}>
            {transferStatus}
          </div>
        )}

        {/* Dual pane */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Local panel */}
          <div
            style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative',
              borderRight: `1px solid ${ui.border}`,
              outline: dropTarget === 'local' ? `2px solid ${ui.accent}` : 'none',
              outlineOffset: -2,
              transition: 'outline-color 0.15s',
            }}
            onDragOver={e => handleDragOver(e, 'local')}
            onDragLeave={e => handleDragLeave(e, 'local')}
            onDrop={e => handleDrop(e, 'local')}
          >
            {dropTarget === 'local' && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                background: `${ui.accent}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ui.accent, background: ui.bg, padding: '4px 12px', borderRadius: 6, border: `1px solid ${ui.accent}` }}>
                  Drop to download here
                </span>
              </div>
            )}
            <PanelHeader
              label="Local"
              path={localPathInput}
              onPathChange={setLocalPathInput}
              onPathKey={handleLocalPathKey}
              onUp={navigateLocalUp}
              onRefresh={() => loadLocal(localPath)}
              ui={ui}
            />
            <FileList
              side="local"
              entries={localEntries}
              loading={localLoading}
              error={localError}
              selected={selectedLocal}
              onSelect={setSelectedLocal}
              onNavigate={entry => entry.isDirectory && loadLocal(entry.path)}
              onContextMenu={(x, y, entry) => setCtxMenu({ x, y, entry, side: 'local' })}
              onDragStart={(e, entries) => handleDragStart(e, entries, 'local')}
              onDragEnd={handleDragEnd}
              renamingPath={renamingPath}
              renamingValue={renamingValue}
              onRenamingChange={setRenamingValue}
              onRenameCommit={entry => handleRenameCommit(entry, 'local')}
              onRenameCancel={() => setRenamingPath(null)}
              ui={ui}
            />
          </div>

          {/* Remote panel */}
          <div
            style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative',
              outline: dropTarget === 'remote' ? `2px solid ${ui.accent}` : 'none',
              outlineOffset: -2,
              transition: 'outline-color 0.15s',
            }}
            onDragOver={e => handleDragOver(e, 'remote')}
            onDragLeave={e => handleDragLeave(e, 'remote')}
            onDrop={e => handleDrop(e, 'remote')}
          >
            {dropTarget === 'remote' && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                background: `${ui.accent}08`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ui.accent, background: ui.bg, padding: '4px 12px', borderRadius: 6, border: `1px solid ${ui.accent}` }}>
                  Drop to upload here
                </span>
              </div>
            )}
            <PanelHeader
              label="Remote"
              path={remotePathInput}
              onPathChange={setRemotePathInput}
              onPathKey={handleRemotePathKey}
              onUp={navigateRemoteUp}
              onRefresh={() => loadRemote(remotePath)}
              ui={ui}
            />
            <FileList
              side="remote"
              entries={remoteEntries}
              loading={remoteLoading}
              error={remoteError}
              selected={selectedRemote}
              onSelect={setSelectedRemote}
              onNavigate={entry => entry.isDirectory && loadRemote(entry.path)}
              onContextMenu={(x, y, entry) => setCtxMenu({ x, y, entry, side: 'remote' })}
              onDragStart={(e, entries) => handleDragStart(e, entries, 'remote')}
              onDragEnd={handleDragEnd}
              renamingPath={renamingPath}
              renamingValue={renamingValue}
              onRenamingChange={setRenamingValue}
              onRenameCommit={entry => handleRenameCommit(entry, 'remote')}
              onRenameCancel={() => setRenamingPath(null)}
              ui={ui}
            />
          </div>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <CtxMenu
          x={ctxMenu.x} y={ctxMenu.y} entry={ctxMenu.entry} side={ctxMenu.side}
          targetLabel={getTargetLabel(ctxMenu.side)}
          selectedCount={ctxMenu.side === 'local' ? selectedLocal.size : selectedRemote.size}
          ui={ui}
          onCopyTo={entry => handleCopyTo(entry, ctxMenu.side)}
          onCopySelectedTo={() => handleCopySelectedTo(ctxMenu.side)}
          onRename={entry => handleRenameStart(entry)}
          onDelete={entry => handleDelete(entry, ctxMenu.side)}
          onRefresh={() => handleRefresh(ctxMenu.side)}
          onNewFolder={() => handleNewFolder(ctxMenu.side)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </Overlay>
  )
}

// ── Overlay ──

function Overlay({ children, ui, onClose }: { children: React.ReactNode; ui: any; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '90%', maxWidth: 1100, height: '80vh', maxHeight: 700,
        background: ui.bg, border: `1px solid ${ui.border}`, borderRadius: 12,
        boxShadow: `0 24px 64px ${ui.shadow}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Panel Header ──

function PanelHeader({ label, path, onPathChange, onPathKey, onUp, onRefresh, ui }: {
  label: string; path: string; onPathChange: (v: string) => void; onPathKey: (e: React.KeyboardEvent) => void
  onUp: () => void; onRefresh: () => void; ui: any
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px',
      borderBottom: `1px solid ${ui.border}`, flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: ui.accent, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginRight: 4 }}>
        {label}
      </span>
      <SmallBtn title="Go up" onClick={onUp} ui={ui}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      </SmallBtn>
      <input
        value={path}
        onChange={e => onPathChange(e.target.value)}
        onKeyDown={onPathKey}
        style={{
          flex: 1, fontSize: 11, padding: '3px 6px',
          background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 4,
          color: ui.text, outline: 'none', fontFamily: 'inherit', minWidth: 0,
        }}
        onFocus={e => e.currentTarget.style.borderColor = ui.inputFocus}
        onBlur={e => e.currentTarget.style.borderColor = ui.inputBorder}
      />
      <SmallBtn title="Refresh" onClick={onRefresh} ui={ui}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </SmallBtn>
    </div>
  )
}

// ── File List ──

type SortKey = 'name' | 'size' | 'date'
type SortDir = 'asc' | 'desc'

function FileList({ side, entries, loading, error, selected, onSelect, onNavigate, onContextMenu, onDragStart, onDragEnd, renamingPath, renamingValue, onRenamingChange, onRenameCommit, onRenameCancel, ui }: {
  side: PanelSide
  entries: SftpEntry[]; loading: boolean; error: string | null
  selected: Set<string>; onSelect: (s: Set<string>) => void
  onNavigate: (entry: SftpEntry) => void
  onContextMenu: (x: number, y: number, entry: SftpEntry | null) => void
  onDragStart: (e: React.DragEvent, entries: SftpEntry[]) => void
  onDragEnd: () => void
  renamingPath: string | null; renamingValue: string
  onRenamingChange: (v: string) => void
  onRenameCommit: (entry: SftpEntry) => void
  onRenameCancel: () => void
  ui: any
}) {
  const renameRef = useRef<HTMLInputElement>(null)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSortClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sortedEntries = [...entries].sort((a, b) => {
    // Directories always first
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    else if (sortKey === 'size') cmp = a.size - b.size
    else if (sortKey === 'date') cmp = a.modTime - b.modTime
    return sortDir === 'asc' ? cmp : -cmp
  })

  useEffect(() => {
    if (renamingPath) {
      setTimeout(() => {
        if (renameRef.current) {
          renameRef.current.focus()
          const dotIdx = renamingValue.lastIndexOf('.')
          renameRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : renamingValue.length)
        }
      }, 0)
    }
  }, [renamingPath])

  const toggleSelect = (entry: SftpEntry, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selected)
      if (next.has(entry.path)) next.delete(entry.path)
      else next.add(entry.path)
      onSelect(next)
    } else if (e.shiftKey && sortedEntries.length > 0) {
      const paths = sortedEntries.map(e => e.path)
      const lastSelected = [...selected].pop()
      const lastIdx = lastSelected ? paths.indexOf(lastSelected) : 0
      const curIdx = paths.indexOf(entry.path)
      const [from, to] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx]
      const next = new Set(selected)
      for (let i = from; i <= to; i++) next.add(paths[i])
      onSelect(next)
    } else {
      onSelect(new Set([entry.path]))
    }
  }

  const handleRowContext = (e: React.MouseEvent, entry: SftpEntry) => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected.has(entry.path)) onSelect(new Set([entry.path]))
    onContextMenu(e.clientX, e.clientY, entry)
  }

  const handleBgContext = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-file-row]')) return
    e.preventDefault()
    onContextMenu(e.clientX, e.clientY, null)
  }

  const handleRowDragStart = (e: React.DragEvent, entry: SftpEntry) => {
    if (!selected.has(entry.path)) onSelect(new Set([entry.path]))
    const dragEntries = entries.filter(en => selected.has(en.path) || en.path === entry.path)
    const unique = [...new Map(dragEntries.map(en => [en.path, en])).values()]
    onDragStart(e, unique)
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner ui={ui} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <span style={{ fontSize: 11, color: ui.danger }}>{error}</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', contain: 'content', willChange: 'scroll-position' }} onContextMenu={handleBgContext}>
      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '3px 8px', gap: 4,
        borderBottom: `1px solid ${ui.border}`, position: 'sticky', top: 0,
        background: ui.bg, fontSize: 10, fontWeight: 600, color: ui.textDim,
        textTransform: 'uppercase', letterSpacing: '0.04em', zIndex: 2,
      }}>
        <SortHeader label="Name" sortKey="name" active={sortKey} dir={sortDir} onClick={handleSortClick} style={{ flex: 1 }} ui={ui} />
        <SortHeader label="Size" sortKey="size" active={sortKey} dir={sortDir} onClick={handleSortClick} style={{ width: 70, justifyContent: 'flex-end' }} ui={ui} />
        <SortHeader label="Modified" sortKey="date" active={sortKey} dir={sortDir} onClick={handleSortClick} style={{ width: 90, justifyContent: 'flex-end' }} ui={ui} />
      </div>

      {entries.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: ui.textDim }}>Empty folder</div>
      )}

      {sortedEntries.map(entry => {
        const isSel = selected.has(entry.path)
        const isRenaming = renamingPath === entry.path
        return (
          <div
            key={entry.path}
            data-file-row
            draggable={!isRenaming}
            onClick={e => { if (!isRenaming) toggleSelect(entry, e) }}
            onDoubleClick={() => { if (!isRenaming) onNavigate(entry) }}
            onContextMenu={e => handleRowContext(e, entry)}
            onDragStart={e => handleRowDragStart(e, entry)}
            onDragEnd={onDragEnd}
            style={{
              display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 4,
              fontSize: 11, color: ui.text, cursor: isRenaming ? 'default' : 'pointer', userSelect: 'none',
              background: isSel ? `${ui.accent}18` : 'transparent',
              borderBottom: `1px solid ${ui.border}08`,
              transition: 'background 0.08s',
            }}
            onMouseEnter={e => { if (!isSel && !isRenaming) e.currentTarget.style.background = ui.bgTertiary }}
            onMouseLeave={e => { if (!isSel && !isRenaming) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', marginRight: 4, flexShrink: 0 }}>
              {entry.isDirectory ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill={`${ui.accent}30`} stroke={ui.accent} strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
            </span>

            {isRenaming ? (
              <input
                ref={renameRef}
                value={renamingValue}
                onChange={e => onRenamingChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); onRenameCommit(entry) }
                  if (e.key === 'Escape') { e.preventDefault(); onRenameCancel() }
                  e.stopPropagation()
                }}
                onBlur={() => onRenameCommit(entry)}
                onClick={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                style={{
                  flex: 1, minWidth: 0, fontSize: 11, padding: '1px 4px',
                  background: ui.inputBg, border: `1px solid ${ui.accent}`,
                  borderRadius: 3, color: ui.text, outline: 'none', fontFamily: 'inherit',
                }}
              />
            ) : (
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: entry.isDirectory ? ui.accent : ui.text, fontWeight: entry.isDirectory ? 500 : 400,
              }}>
                {entry.name}
              </span>
            )}

            <span style={{ width: 70, textAlign: 'right', color: ui.textDim, fontSize: 10, flexShrink: 0 }}>
              {entry.isDirectory ? '—' : formatSize(entry.size)}
            </span>
            <span style={{ width: 90, textAlign: 'right', color: ui.textDim, fontSize: 10, flexShrink: 0 }}>
              {formatDate(entry.modTime)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Sort Header ──

function SortHeader({ label, sortKey, active, dir, onClick, style, ui }: {
  label: string; sortKey: SortKey; active: SortKey; dir: SortDir
  onClick: (k: SortKey) => void; style?: React.CSSProperties; ui: any
}) {
  const isActive = active === sortKey
  return (
    <button
      onClick={() => onClick(sortKey)}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
        color: isActive ? ui.accent : ui.textDim,
        transition: 'color 0.12s',
        ...style,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = ui.text }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = ui.textDim }}
    >
      {label}
      {isActive && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {dir === 'asc'
            ? <polyline points="18 15 12 9 6 15" />
            : <polyline points="6 9 12 15 18 9" />}
        </svg>
      )}
    </button>
  )
}

// ── Context Menu ──

function CtxMenu({ x, y, entry, side, targetLabel, selectedCount, ui, onCopyTo, onCopySelectedTo, onRename, onDelete, onRefresh, onNewFolder, onClose }: {
  x: number; y: number; entry: SftpEntry | null; side: PanelSide; targetLabel: string
  selectedCount: number; ui: any
  onCopyTo: (entry: SftpEntry) => void
  onCopySelectedTo: () => void
  onRename: (entry: SftpEntry) => void
  onDelete: (entry: SftpEntry) => void
  onRefresh: () => void
  onNewFolder: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${x - rect.width}px`
    if (rect.bottom > vh) ref.current.style.top = `${y - rect.height}px`
  }, [x, y])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 99999,
        background: ui.bgSecondary, border: `1px solid ${ui.border}`,
        borderRadius: 8, boxShadow: `0 8px 24px ${ui.shadow}`,
        padding: 4, minWidth: 200,
      }}
      onClick={e => e.stopPropagation()}
    >
      {entry && !entry.isDirectory && (
        <CtxItem
          icon={<CopyToIcon />}
          label={`Copy to ${targetLabel}`}
          onClick={() => onCopyTo(entry)}
          ui={ui}
        />
      )}
      {selectedCount > 1 && (
        <CtxItem
          icon={<CopyToIcon />}
          label={`Copy ${selectedCount} items to ${targetLabel}`}
          onClick={onCopySelectedTo}
          ui={ui}
        />
      )}
      {(entry || selectedCount > 1) && <CtxDivider ui={ui} />}
      {entry && (
        <CtxItem
          icon={<RenameIcon />}
          label="Rename"
          onClick={() => onRename(entry)}
          ui={ui}
        />
      )}
      {entry && (
        <CtxItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onDelete(entry)}
          ui={ui}
          danger
        />
      )}
      {entry && <CtxDivider ui={ui} />}
      <CtxItem
        icon={<RefreshIcon />}
        label="Refresh"
        onClick={onRefresh}
        ui={ui}
      />
      <CtxItem
        icon={<NewFolderIcon />}
        label="New Folder"
        onClick={onNewFolder}
        ui={ui}
      />
    </div>
  )
}

function CtxItem({ icon, label, onClick, ui, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; ui: any; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 5,
        background: 'transparent', border: 'none',
        color: danger ? ui.danger : ui.text,
        fontSize: 12, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? `${ui.danger}20` : ui.bgTertiary }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: danger ? ui.danger : ui.textMuted, display: 'flex', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  )
}

function CtxDivider({ ui }: { ui: any }) {
  return <div style={{ height: 1, background: ui.border, margin: '3px 0' }} />
}

// ── Shared small components ──

function SmallBtn({ children, title, onClick, ui }: {
  children: React.ReactNode; title: string; onClick: () => void; ui: any
}) {
  return (
    <button
      title={title} onClick={onClick}
      style={{
        width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', color: ui.textMuted,
        cursor: 'pointer', borderRadius: 4, flexShrink: 0, transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = ui.bgTertiary; e.currentTarget.style.color = ui.text }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textMuted }}
    >
      {children}
    </button>
  )
}

function Spinner({ ui }: { ui: any }) {
  return (
    <svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke={ui.accent} strokeWidth="2.5" strokeDasharray="32 20" strokeLinecap="round" />
    </svg>
  )
}

// ── Icons ──

function CopyToIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}
function RenameIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  )
}
function NewFolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  )
}

// ── Formatters ──

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
