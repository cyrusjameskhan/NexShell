import { useEffect, useRef, useState } from 'react'
import { useStore } from '../hooks'
import {
  createTab, closeTab, setActiveTab, splitTab,
  mergeTabIntoWorkspace, ejectPaneToTab, setState, getTabLabel,
  renameSession, renameWorkspace, toggleSidePanel, getActiveSessionSshConnection,
} from '../store'
import { Tab } from '../types'

export default function TabBar() {
  const { tabs, activeTabIndex, theme, sidePanelOpen, sidePanelSection, sshConnections, activeSessionId } = useStore()
  const ui = theme.ui
  const hasSshConnection = sshConnections.some(c => c.sessionId === activeSessionId)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabIndex: number } | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [paneEjectOver, setPaneEjectOver] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [contextMenu])

  return (
    <div
      style={{
        height: 38,
        background: ui.bgSecondary,
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: paneEjectOver ? `1px solid ${ui.accent}` : `1px solid ${ui.border}`,
        flexShrink: 0,
        position: 'relative',
        transition: 'border-color 0.15s',
      }}
      // Accept pane-header drags anywhere on the tab bar
      onDragOver={e => {
        if (e.dataTransfer.types.includes('pane/workspaceid')) {
          e.preventDefault()
          setPaneEjectOver(true)
        }
      }}
      onDragLeave={e => {
        // Only clear if leaving the tab bar entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaneEjectOver(false)
        }
      }}
      onDrop={e => {
        const wsId = e.dataTransfer.getData('pane/workspaceId')
        const sessId = e.dataTransfer.getData('pane/sessionId')
        setPaneEjectOver(false)
        if (wsId && sessId) {
          e.preventDefault()
          ejectPaneToTab(wsId, sessId)
        }
      }}
    >
      {paneEjectOver && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `${ui.accent}12`,
          border: `1px dashed ${ui.accent}`,
          borderRadius: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: ui.accent, gap: 6, zIndex: 10,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          Drop to eject as new tab
        </div>
      )}

      {/* Sidebar toggle */}
      <button
        onClick={() => sidePanelOpen ? setState({ sidePanelOpen: false }) : toggleSidePanel(sidePanelSection ?? 'hosts')}
        title={sidePanelOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          width: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderRight: `1px solid ${ui.border}`,
          color: sidePanelOpen ? ui.accent : ui.textDim,
          cursor: 'pointer',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = sidePanelOpen ? ui.accentHover : ui.textMuted }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = sidePanelOpen ? ui.accent : ui.textDim }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {sidePanelOpen
            ? <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="5 8 3 9 5 10"/></>
            : <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="13 8 15 9 13 10"/></>
          }
        </svg>
      </button>

      {/* Tab list */}
      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflow: 'hidden' }}>
        {tabs.map((tab, i) => (
          <TabItem
            key={tab.kind === 'session' ? tab.sessionId : tab.workspaceId}
            tab={tab}
            index={i}
            isActive={!sidePanelOpen && i === activeTabIndex}
            isDragging={draggingIndex === i}
            isDragOver={dragOverIndex === i}
            isEditing={editingIndex === i}
            label={getTabLabel(tab)}
            isWorkspace={tab.kind === 'workspace'}
            ui={ui}
            onClick={() => {
              if (sidePanelOpen) setState({ sidePanelOpen: false })
              setActiveTab(i)
            }}
            onClose={e => { e.stopPropagation(); closeTab(i) }}
            onDoubleClick={() => setEditingIndex(i)}
            onRename={name => {
              if (tab.kind === 'session') renameSession(tab.sessionId, name)
              else renameWorkspace(tab.workspaceId, name)
              setEditingIndex(null)
            }}
            onRenameCancel={() => setEditingIndex(null)}
            onContextMenu={e => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, tabIndex: i })
            }}
            onDragStart={e => { setDraggingIndex(i); e.dataTransfer.setData('tabIndex', String(i)) }}
            onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null) }}
            onDragOver={e => {
              if (e.dataTransfer.types.includes('pane/workspaceid')) return
              e.preventDefault()
              if (draggingIndex !== null && draggingIndex !== i) setDragOverIndex(i)
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={e => {
              if (e.dataTransfer.types.includes('pane/workspaceid')) return
              e.preventDefault()
              if (draggingIndex === null || draggingIndex === i) return
              const dropTab = tabs[i]
              if (dropTab.kind === 'workspace' && tabs[draggingIndex].kind === 'session') {
                mergeTabIntoWorkspace(draggingIndex, dropTab.workspaceId)
              }
              setDraggingIndex(null)
              setDragOverIndex(null)
            }}
          />
        ))}
      </div>

      {/* Right-side toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 8, flexShrink: 0 }}>
        <IconButton onClick={() => createTab()} title="New tab (Ctrl+Shift+T)" ui={ui}>
          <PlusIcon />
        </IconButton>

        <div style={{ width: 1, height: 16, background: ui.border, margin: '0 4px' }} />

        <IconButton onClick={() => setState({ historyOpen: true })} title="Command history (Ctrl+R)" ui={ui}>
          <HistoryIcon />
        </IconButton>

        {hasSshConnection && (
          <>
            <div style={{ width: 1, height: 16, background: ui.border, margin: '0 4px' }} />
            <IconButton onClick={() => setState({ sftpOpen: true })} title="SFTP file transfer" ui={ui}>
              <SftpIcon />
            </IconButton>
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabIndex={contextMenu.tabIndex}
          tab={tabs[contextMenu.tabIndex]}
          ui={ui}
          onClose={() => setContextMenu(null)}
          onRename={() => { setEditingIndex(contextMenu.tabIndex); setContextMenu(null) }}
          onSplitRight={() => {
            splitTab(contextMenu.tabIndex, 'horizontal')
            setActiveTab(contextMenu.tabIndex)
            setContextMenu(null)
          }}
          onSplitDown={() => {
            splitTab(contextMenu.tabIndex, 'vertical')
            setActiveTab(contextMenu.tabIndex)
            setContextMenu(null)
          }}
          onCloseTab={() => { closeTab(contextMenu.tabIndex); setContextMenu(null) }}
        />
      )}
    </div>
  )
}

// ── Tab item ─────────────────────────────────────────────────────────────────
function TabItem({
  tab, index, isActive, isDragging, isDragOver, isEditing, label, isWorkspace,
  ui, onClick, onClose, onDoubleClick, onRename, onRenameCancel, onContextMenu,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: {
  tab: Tab; index: number; isActive: boolean; isDragging: boolean
  isDragOver: boolean; isEditing: boolean; label: string; isWorkspace: boolean; ui: any
  onClick: () => void; onClose: (e: React.MouseEvent) => void
  onDoubleClick: () => void; onRename: (name: string) => void; onRenameCancel: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(label)

  useEffect(() => {
    if (isEditing) {
      setDraft(label)
      setTimeout(() => { inputRef.current?.select() }, 0)
    }
  }, [isEditing])

  const commit = () => onRename(draft)

  return (
    <div
      draggable={!isEditing}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px 0 12px',
        minWidth: 100, maxWidth: 220, height: '100%',
        background: isActive ? ui.tabActive : isDragOver ? ui.accentMuted : 'transparent',
        borderRight: `1px solid ${ui.border}`,
        borderBottom: isActive ? `2px solid ${ui.accent}` : '2px solid transparent',
        cursor: 'pointer',
        fontSize: 12,
        color: isActive ? ui.text : ui.textMuted,
        userSelect: 'none',
        opacity: isDragging ? 0.4 : 1,
        transition: 'background 0.1s, opacity 0.15s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = ui.bgTertiary }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isDragOver ? ui.accentMuted : 'transparent' }}
    >
      {isWorkspace ? <WorkspaceIcon color={isActive ? ui.accent : ui.textMuted} /> : <TerminalIcon color={isActive ? ui.accent : ui.textMuted} />}

      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); onRenameCancel() }
            e.stopPropagation()
          }}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0,
            background: ui.bg,
            border: `1px solid ${ui.accent}`,
            borderRadius: 3,
            color: ui.text,
            fontSize: 12,
            padding: '1px 5px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {label}
        </span>
      )}

      <button
        onClick={onClose}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 16, height: 16, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'transparent', border: 'none',
          color: ui.textDim, cursor: 'pointer', borderRadius: 3, flexShrink: 0, padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = ui.danger + '30'; e.currentTarget.style.color = ui.danger }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textDim }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ── Context menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, tabIndex, tab, ui, onClose, onRename, onSplitRight, onSplitDown, onCloseTab }: {
  x: number; y: number; tabIndex: number; tab: Tab; ui: any
  onClose: () => void; onRename: () => void; onSplitRight: () => void; onSplitDown: () => void; onCloseTab: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const style: React.CSSProperties = {
    position: 'fixed',
    left: x, top: y,
    background: ui.bgSecondary,
    border: `1px solid ${ui.border}`,
    borderRadius: 8,
    boxShadow: `0 8px 24px ${ui.shadow}`,
    padding: '4px',
    zIndex: 9999,
    minWidth: 180,
  }

  return (
    <div ref={ref} style={style} onClick={e => e.stopPropagation()}>
      <MenuSection label="Tab" ui={ui} />
      <MenuItem label="Rename" icon={<RenameIcon />} onClick={onRename} ui={ui} />
      <MenuDivider ui={ui} />
      <MenuSection label="Split" ui={ui} />
      <MenuItem label="Split Right" icon={<SplitHIcon />} onClick={onSplitRight} ui={ui} />
      <MenuItem label="Split Down" icon={<SplitVIcon />} onClick={onSplitDown} ui={ui} />
      <MenuDivider ui={ui} />
      <MenuItem label="Close Tab" icon={<CloseIcon />} onClick={onCloseTab} ui={ui} danger />
    </div>
  )
}

function MenuSection({ label, ui }: { label: string; ui: any }) {
  return (
    <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 600, color: ui.textDim, letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

function MenuDivider({ ui }: { ui: any }) {
  return <div style={{ height: 1, background: ui.border, margin: '4px 0' }} />
}

function MenuItem({ label, icon, onClick, ui, danger }: {
  label: string; icon: React.ReactNode; onClick: () => void; ui: any; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 5,
        background: 'transparent', border: 'none',
        color: danger ? ui.danger : ui.text,
        fontSize: 13, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? ui.danger + '20' : ui.bgTertiary }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ color: danger ? ui.danger : ui.textMuted, display: 'flex' }}>{icon}</span>
      {label}
    </button>
  )
}

function IconButton({ children, onClick, title, ui }: {
  children: React.ReactNode; onClick: () => void; title: string; ui: any
}) {
  return (
    <button
      onClick={onClick} title={title}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', color: ui.textMuted,
        cursor: 'pointer', borderRadius: 6, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = ui.bgTertiary; e.currentTarget.style.color = ui.text }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textMuted }}
    >
      {children}
    </button>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function TerminalIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}
function WorkspaceIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  )
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function HistoryIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
}
function SftpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <polyline points="8 13 12 9 16 13" />
      <line x1="12" y1="9" x2="12" y2="17" />
    </svg>
  )
}
function RenameIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
}
function SplitHIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
}
function SplitVIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="12" x2="21" y2="12" /></svg>
}
function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
}
