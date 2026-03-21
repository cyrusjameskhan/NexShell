import { useEffect, useRef, useState } from 'react'
import { useStore } from '../hooks'
import {
  setActivePaneInWorkspace, closePane,
  fillEmptyPane, closeEmptyPane, dropTabIntoEmptySlot,
  ejectPaneToTab, dragSplitOntoPane, movePaneWithinWorkspace, movePaneAcrossWorkspaces,
  renameSession, createTab, defaultShellName, setWorkspaceSplitRatios, splitPane,
} from '../store'
import { SplitNode, Workspace } from '../types'
import TerminalView, { setResizeSuppressed } from './Terminal'

type DropZonePos = 'left' | 'right' | 'top' | 'bottom' | null

export default function PaneContainer() {
  const { tabs, activeTabIndex, workspaces, activeSessionId, theme, initialized } = useStore()
  const ui = theme.ui

  if (!initialized) return null
  if (tabs.length === 0) return <EmptyState ui={ui} termBg={theme.colors.background} showNewSession />

  // All tabs render simultaneously at full size. Inactive tabs use
  // visibility:hidden so the canvas/xterm keeps real dimensions and rAF
  // keeps firing — no buffer loss, no repaint issues on tab switch.
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {tabs.map((tab, index) => {
        const isActive = index === activeTabIndex
        return (
          <div
            key={tab.kind === 'session' ? tab.sessionId : tab.workspaceId}
            style={{
              position: 'absolute',
              inset: 0,
              visibility: isActive ? 'visible' : 'hidden',
              zIndex: isActive ? 1 : 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {tab.kind === 'session' ? (
              <SinglePane
                sessionId={tab.sessionId}
                ui={ui}
                termBg={theme.colors.background}
                isActive={isActive}
              />
            ) : (() => {
              const ws = workspaces.find(w => w.id === tab.workspaceId)
              if (!ws) return <EmptyState ui={ui} termBg={theme.colors.background} />
              return <WorkspaceView ws={ws} activeSessionId={activeSessionId} ui={ui} termBg={theme.colors.background} />
            })()}
          </div>
        )
      })}
    </div>
  )
}

// ── Single session pane (also supports drag-to-split) ────────────────────────
function SinglePane({ sessionId, ui, termBg, isActive }: {
  sessionId: string
  ui: any
  termBg: string
  isActive: boolean
}) {
  const [dropZone, setDropZone] = useState<DropZonePos>(null)

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDragOver={e => {
        const isTabDrag = e.dataTransfer.types.includes('tabindex')
        const isPaneDrag = e.dataTransfer.types.includes('pane/workspaceid')
        if (!isTabDrag && !isPaneDrag) return
        e.preventDefault()
        setDropZone(getDropPosition(e))
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropZone(null)
      }}
      onDrop={e => {
        const pos = dropZone
        setDropZone(null)
        if (!pos) return

        // Pane-header drag onto a standalone session → move it here
        const fromWsId = e.dataTransfer.getData('pane/workspaceId')
        const fromSessId = e.dataTransfer.getData('pane/sessionId')
        if (fromWsId && fromSessId && fromSessId !== sessionId) {
          e.preventDefault()
          movePaneAcrossWorkspaces(fromWsId, fromSessId, '', sessionId, pos)
          return
        }

        // Tab drag → split
        const fromIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10)
        if (!isNaN(fromIndex)) {
          e.preventDefault()
          dragSplitOntoPane(fromIndex, sessionId, pos)
        }
      }}
    >
      <TerminalView sessionId={sessionId} isActive={isActive} />
      {dropZone && <SplitOverlay position={dropZone} ui={ui} isSameWorkspace={false} />}
    </div>
  )
}

// ── Workspace split view (recursive) ─────────────────────────────────────────
function WorkspaceView({ ws, activeSessionId, ui, termBg }: {
  ws: Workspace
  activeSessionId: string | null
  ui: any
  termBg: string
}) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <SplitNodeView
        node={ws.root}
        workspace={ws}
        path={[]}
        activeSessionId={activeSessionId}
        ui={ui}
        termBg={termBg}
      />
    </div>
  )
}

// ── Recursive split node renderer ────────────────────────────────────────────
const MIN_SPLIT_PANE_PX = 48

function normalizePaneRatios(ratios: number[] | undefined, len: number): number[] {
  if (!ratios || ratios.length !== len) return Array(len).fill(1)
  return ratios.map(r => Math.max(0.05, r))
}

function ratiosFromBoundary(
  ratios: number[],
  i: number,
  boundaryPx: number,
  containerPx: number,
): number[] {
  if (containerPx <= 0) return ratios
  const S = ratios.reduce((a, b) => a + b, 0)
  const prefix = ratios.slice(0, i).reduce((a, b) => a + b, 0)
  const pairSum = ratios[i] + ratios[i + 1]
  let newRi = (boundaryPx / containerPx) * S - prefix
  const minR = (MIN_SPLIT_PANE_PX / containerPx) * S
  newRi = Math.max(minR, Math.min(pairSum - minR, newRi))
  const next = [...ratios]
  next[i] = newRi
  next[i + 1] = pairSum - newRi
  return next
}

/** Clamp a pixel position to the min-pane constraints. */
function clampSashPx(
  posPx: number,
  siblingIndex: number,
  ratios: number[],
  containerPx: number,
): number {
  const S = ratios.reduce((a, b) => a + b, 0)
  const prefix = ratios.slice(0, siblingIndex).reduce((a, b) => a + b, 0)
  const pairSum = ratios[siblingIndex] + ratios[siblingIndex + 1]
  const pairEnd = (prefix + pairSum) / S * containerPx
  const pairStart = prefix / S * containerPx
  return Math.max(pairStart + MIN_SPLIT_PANE_PX, Math.min(pairEnd - MIN_SPLIT_PANE_PX, posPx))
}

// ── Ghost-sash split resize ──────────────────────────────────────────────────
// During drag nothing about the pane layout changes — zero flex recalculation,
// zero xterm resize work.  Only a floating highlight line (the "ghost sash")
// slides via CSS `translate`.  The actual layout change happens once on release.

function SplitNodeView({ node, workspace, path, activeSessionId, ui, termBg }: {
  node: SplitNode
  workspace: Workspace
  path: number[]
  activeSessionId: string | null
  ui: any
  termBg: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    siblingIndex: number
    startPx: number
    startSashPx: number
    ratios: number[]
  } | null>(null)

  if (node.type === 'leaf') {
    if (node.sessionId === null) {
      return <DropZone workspaceId={workspace.id} ui={ui} termBg={termBg} />
    }
    return (
      <LivePane
        sessionId={node.sessionId}
        workspaceId={workspace.id}
        isFocused={node.sessionId === activeSessionId}
        ui={ui}
      />
    )
  }

  const isHorizontal = node.direction === 'horizontal'
  const n = node.children.length
  const ratios = normalizePaneRatios(node.ratios, n)

  const showGhost = (posPx: number) => {
    const g = ghostRef.current
    if (!g) return
    g.style.display = 'block'
    if (isHorizontal) {
      g.style.left = `${posPx}px`
      g.style.top = '0'
      g.style.width = '2px'
      g.style.height = '100%'
    } else {
      g.style.top = `${posPx}px`
      g.style.left = '0'
      g.style.height = '2px'
      g.style.width = '100%'
    }
  }
  const hideGhost = () => {
    const g = ghostRef.current
    if (g) g.style.display = 'none'
  }

  const onSashPointerDown = (e: React.PointerEvent, siblingIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pointerPx = isHorizontal ? e.clientX : e.clientY
    const originPx = isHorizontal ? rect.left : rect.top
    const containerPx = isHorizontal ? rect.width : rect.height

    // Compute where the sash currently sits (boundary between child i and i+1)
    const S = ratios.reduce((a, b) => a + b, 0)
    const prefix = ratios.slice(0, siblingIndex + 1).reduce((a, b) => a + b, 0)
    const sashPx = (prefix / S) * containerPx

    dragRef.current = {
      siblingIndex,
      startPx: pointerPx,
      startSashPx: sashPx,
      ratios: [...ratios],
    }
    setResizeSuppressed(true)
    showGhost(clampSashPx(sashPx, siblingIndex, ratios, containerPx))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const curPx = isHorizontal ? ev.clientX : ev.clientY
      const newSashPx = d.startSashPx + (curPx - d.startPx)
      showGhost(clampSashPx(newSashPx, d.siblingIndex, d.ratios, containerPx))
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      const d = dragRef.current
      dragRef.current = null
      hideGhost()
      setResizeSuppressed(false)
      if (!d) return
      const curPx = isHorizontal ? ev.clientX : ev.clientY
      const finalSashPx = clampSashPx(d.startSashPx + (curPx - d.startPx), d.siblingIndex, d.ratios, containerPx)
      const next = ratiosFromBoundary(d.ratios, d.siblingIndex, finalSashPx, containerPx)
      setWorkspaceSplitRatios(workspace.id, path, next)
    }

    const onCancel = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      dragRef.current = null
      hideGhost()
      setResizeSuppressed(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {node.children.map((child, i) => (
        <div
          key={i}
          style={{
            flexGrow: ratios[i],
            flexShrink: 1,
            flexBasis: '0%',
            minWidth: isHorizontal ? 0 : undefined,
            minHeight: isHorizontal ? undefined : 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {i > 0 && (
            <div
              onPointerDown={e => onSashPointerDown(e, i - 1)}
              style={{
                position: 'absolute',
                zIndex: 30,
                touchAction: 'none',
                ...(isHorizontal
                  ? { top: 0, bottom: 0, left: -3, width: 6, cursor: 'col-resize' }
                  : { left: 0, right: 0, top: -3, height: 6, cursor: 'row-resize' }),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  ...(isHorizontal
                    ? { top: 0, bottom: 0, left: '50%', width: 1, marginLeft: -0.5, background: ui.border }
                    : { left: 0, right: 0, top: '50%', height: 1, marginTop: -0.5, background: ui.border }),
                }}
              />
            </div>
          )}
          <SplitNodeView
            node={child}
            workspace={workspace}
            path={[...path, i]}
            activeSessionId={activeSessionId}
            ui={ui}
            termBg={termBg}
          />
        </div>
      ))}
      {/* Ghost sash — a floating highlight that slides during drag */}
      <div
        ref={ghostRef}
        style={{
          display: 'none',
          position: 'absolute',
          zIndex: 50,
          background: ui.accent,
          opacity: 0.5,
          borderRadius: 1,
          pointerEvents: 'none',
          willChange: 'left, top',
        }}
      />
    </div>
  )
}

// ── Live pane with drag-to-split overlay ─────────────────────────────────────
function LivePane({ sessionId, workspaceId, isFocused, ui }: {
  sessionId: string
  workspaceId: string
  isFocused: boolean
  ui: any
}) {
  const [dropZone, setDropZone] = useState<DropZonePos>(null)
  const [dragFromSameWs, setDragFromSameWs] = useState(false)

  return (
    <div
      onClick={() => setActivePaneInWorkspace(workspaceId, sessionId)}
      onDragOver={e => {
        const isTabDrag = e.dataTransfer.types.includes('tabindex')
        const isPaneDrag = e.dataTransfer.types.includes('pane/workspaceid')
        if (!isTabDrag && !isPaneDrag) return
        e.preventDefault()
        setDropZone(getDropPosition(e))
        setDragFromSameWs(isPaneDrag)
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropZone(null)
          setDragFromSameWs(false)
        }
      }}
      onDrop={e => {
        const pos = dropZone
        setDropZone(null)
        setDragFromSameWs(false)
        if (!pos) return

        // Pane-header drag → move within workspace, or move across workspaces
        const fromWsId = e.dataTransfer.getData('pane/workspaceId')
        const fromSessId = e.dataTransfer.getData('pane/sessionId')
        if (fromWsId && fromSessId && fromSessId !== sessionId) {
          e.preventDefault()
          if (fromWsId === workspaceId) {
            movePaneWithinWorkspace(workspaceId, fromSessId, sessionId, pos)
          } else {
            movePaneAcrossWorkspaces(fromWsId, fromSessId, workspaceId, sessionId, pos)
          }
          return
        }

        // Tab-bar drag → split onto this pane
        const tabIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10)
        if (!isNaN(tabIndex)) {
          e.preventDefault()
          dragSplitOntoPane(tabIndex, sessionId, pos)
          return
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        outline: isFocused ? `1px solid ${ui.accent}50` : 'none',
        outlineOffset: '-1px',
        position: 'relative',
      }}
    >
      <PaneHeader sessionId={sessionId} workspaceId={workspaceId} isFocused={isFocused} ui={ui} />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <TerminalView sessionId={sessionId} isActive={isFocused} />
      </div>
      {dropZone && <SplitOverlay position={dropZone} ui={ui} isSameWorkspace={dragFromSameWs} />}
    </div>
  )
}

// ── Split overlay — shows the highlight quad for the hovered zone ─────────────
function SplitOverlay({ position, ui, isSameWorkspace }: { position: DropZonePos; ui: any; isSameWorkspace: boolean }) {
  if (!position) return null

  const arrowChar: Record<string, string> = {
    left: '\u2190', right: '\u2192', top: '\u2191', bottom: '\u2193',
  }

  // Move mode: just a thin edge indicator on the drop side, no pane dimming
  if (isSameWorkspace) {
    const edgeStyle: Record<string, React.CSSProperties> = {
      left:   { left: 0,   top: 0,    width: 4,    height: '100%' },
      right:  { right: 0,  top: 0,    width: 4,    height: '100%' },
      top:    { left: 0,   top: 0,    width: '100%', height: 4   },
      bottom: { left: 0,   bottom: 0, width: '100%', height: 4   },
    }
    const labelPos: Record<string, React.CSSProperties> = {
      left:   { left: 12,  top: '50%', transform: 'translateY(-50%)' },
      right:  { right: 12, top: '50%', transform: 'translateY(-50%)' },
      top:    { top: 12,   left: '50%', transform: 'translateX(-50%)' },
      bottom: { bottom: 12, left: '50%', transform: 'translateX(-50%)' },
    }
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
        <div style={{
          position: 'absolute',
          ...edgeStyle[position],
          background: ui.accent,
          borderRadius: 2,
        }} />
        <div style={{
          position: 'absolute',
          ...labelPos[position],
          display: 'flex', alignItems: 'center', gap: 5,
          background: ui.accent,
          color: ui.bg,
          fontSize: 11, fontWeight: 700,
          padding: '3px 8px', borderRadius: 4,
          whiteSpace: 'nowrap',
        }}>
          <span>{arrowChar[position]}</span>
          <span>Move {position}</span>
        </div>
      </div>
    )
  }

  // Split mode: dim + highlight destination half
  const quadStyle: Record<string, React.CSSProperties> = {
    left:   { left: 0,   top: 0, width: '50%', height: '100%' },
    right:  { right: 0,  top: 0, width: '50%', height: '100%' },
    top:    { left: 0,   top: 0, width: '100%', height: '50%' },
    bottom: { left: 0, bottom: 0, width: '100%', height: '50%' },
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      <div style={{ position: 'absolute', inset: 0, background: `${ui.bg}60` }} />
      <div style={{
        position: 'absolute',
        ...quadStyle[position],
        background: `${ui.accent}28`,
        border: `2px solid ${ui.accent}`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s, border-color 0.1s',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: ui.accent }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{arrowChar[position]}</span>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Split {position}</span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDropPosition(e: React.DragEvent): DropZonePos {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const w = rect.width
  const h = rect.height

  const leftZone   = x < w * 0.25
  const rightZone  = x > w * 0.75
  const topZone    = y < h * 0.25
  const bottomZone = y > h * 0.75

  if (leftZone)   return 'left'
  if (rightZone)  return 'right'
  if (topZone)    return 'top'
  if (bottomZone) return 'bottom'

  const distLeft   = x
  const distRight  = w - x
  const distTop    = y
  const distBottom = h - y
  const min = Math.min(distLeft, distRight, distTop, distBottom)
  if (min === distLeft)   return 'left'
  if (min === distRight)  return 'right'
  if (min === distTop)    return 'top'
  return 'bottom'
}

// ── Empty drop zone (for pre-split empty slots) ───────────────────────────────
function DropZone({ workspaceId, ui, termBg }: {
  workspaceId: string
  ui: any
  termBg: string
}) {
  const { tabs } = useStore()
  const [isDragOver, setIsDragOver] = useState(false)

  const sessionTabs = tabs
    .map((t, i) => ({ tab: t, index: i }))
    .filter(({ tab }) => tab.kind === 'session')

  return (
    <div
      onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        const fromIndex = parseInt(e.dataTransfer.getData('tabIndex'), 10)
        if (!isNaN(fromIndex)) dropTabIntoEmptySlot(fromIndex, workspaceId)
      }}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20,
        background: isDragOver ? ui.accentMuted : termBg,
        transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 4,
          border: `2px dashed ${ui.accent}`,
          borderRadius: 8, pointerEvents: 'none',
        }} />
      )}

      <button
        onClick={() => fillEmptyPane(workspaceId)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '20px 32px', background: 'transparent',
          border: `1.5px dashed ${ui.border}`, borderRadius: 12,
          cursor: 'pointer', color: ui.textMuted, transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = ui.accent; e.currentTarget.style.color = ui.accent; e.currentTarget.style.background = ui.accentMuted }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = ui.textMuted; e.currentTarget.style.background = 'transparent' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 500 }}>New Shell</span>
      </button>

      {sessionTabs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ height: 1, width: 40, background: ui.border }} />
            <span style={{ fontSize: 11, color: ui.textDim }}>or drag a tab here</span>
            <div style={{ height: 1, width: 40, background: ui.border }} />
          </div>
          <TabChips sessionTabs={sessionTabs} ui={ui} />
        </div>
      )}

      <button
        onClick={() => closeEmptyPane(workspaceId)}
        style={{
          position: 'absolute', top: 8, right: 8, width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: ui.bgTertiary, border: `1px solid ${ui.border}`,
          borderRadius: 5, color: ui.textMuted, cursor: 'pointer', padding: 0,
        }}
        title="Close split"
        onMouseEnter={e => { e.currentTarget.style.background = ui.danger + '30'; e.currentTarget.style.color = ui.danger; e.currentTarget.style.borderColor = ui.danger + '60' }}
        onMouseLeave={e => { e.currentTarget.style.background = ui.bgTertiary; e.currentTarget.style.color = ui.textMuted; e.currentTarget.style.borderColor = ui.border }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function TabChips({ sessionTabs, ui }: {
  sessionTabs: Array<{ tab: ReturnType<typeof useStore>['tabs'][number]; index: number }>
  ui: any
}) {
  const { sessions } = useStore()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 300 }}>
      {sessionTabs.map(({ tab, index }) => {
        if (tab.kind !== 'session') return null
        const name = sessions.find(s => s.id === tab.sessionId)?.name ?? defaultShellName
        return (
          <div
            key={tab.sessionId}
            draggable
            onDragStart={e => { e.dataTransfer.setData('tabIndex', String(index)) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              background: ui.bgTertiary, border: `1px solid ${ui.border}`,
              fontSize: 11, color: ui.textMuted, cursor: 'grab', userSelect: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ui.accent; e.currentTarget.style.color = ui.text }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ui.border; e.currentTarget.style.color = ui.textMuted }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            {name}
          </div>
        )
      })}
    </div>
  )
}

// ── Pane header — always visible, full-width drag surface ────────────────────
function PaneHeader({ sessionId, workspaceId, isFocused, ui }: {
  sessionId: string
  workspaceId: string
  isFocused: boolean
  ui: any
}) {
  const { sessions } = useStore()
  const name = sessions.find(s => s.id === sessionId)?.name ?? 'PowerShell'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(name)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [ctxMenu])

  const commit = () => {
    renameSession(sessionId, draft)
    setEditing(false)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={e => {
        if (editing) { e.preventDefault(); return }
        e.dataTransfer.setData('pane/workspaceId', workspaceId)
        e.dataTransfer.setData('pane/sessionId', sessionId)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onContextMenu={e => {
        e.preventDefault()
        e.stopPropagation()
        setCtxMenu({ x: e.clientX, y: e.clientY })
      }}
      style={{
        height: 30, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 8px',
        background: isFocused ? ui.bgTertiary : ui.bgSecondary,
        borderBottom: `1px solid ${ui.border}`,
        cursor: editing ? 'default' : 'grab',
        flexShrink: 0, userSelect: 'none', gap: 6,
        position: 'relative',
      }}
      onMouseDown={e => { if ((e.target as HTMLElement).closest('button, input')) e.preventDefault() }}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill={ui.textDim} style={{ flexShrink: 0, opacity: 0.6 }}>
        <circle cx="3.5" cy="3" r="1.3" /><circle cx="8.5" cy="3" r="1.3" />
        <circle cx="3.5" cy="8" r="1.3" /><circle cx="8.5" cy="8" r="1.3" />
        <circle cx="3.5" cy="13" r="1.3" /><circle cx="8.5" cy="13" r="1.3" />
      </svg>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
            e.stopPropagation()
          }}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0,
            background: ui.bg,
            border: `1px solid ${ui.accent}`,
            borderRadius: 3,
            color: ui.text,
            fontSize: 11,
            padding: '1px 5px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
          style={{
            flex: 1, fontSize: 11, fontWeight: 500,
            color: isFocused ? ui.text : ui.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'inherit',
          }}
          title="Double-click to rename"
        >
          {name}
        </span>
      )}

      {isFocused && !editing && (
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ui.accent, flexShrink: 0 }} />
      )}
      <button
        onClick={e => { e.stopPropagation(); closePane(workspaceId, sessionId) }}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: `1px solid transparent`,
          borderRadius: 4, color: ui.textDim, cursor: 'pointer', padding: 0, flexShrink: 0,
        }}
        title="Close pane"
        onMouseEnter={e => { e.currentTarget.style.background = ui.danger + '25'; e.currentTarget.style.color = ui.danger; e.currentTarget.style.borderColor = ui.danger + '50' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textDim; e.currentTarget.style.borderColor = 'transparent' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      {ctxMenu && (
        <PaneContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          ui={ui}
          onSplitH={() => { setCtxMenu(null); splitPane(workspaceId, sessionId, 'horizontal') }}
          onSplitV={() => { setCtxMenu(null); splitPane(workspaceId, sessionId, 'vertical') }}
          onRename={() => { setCtxMenu(null); setEditing(true) }}
          onClose={() => { setCtxMenu(null); closePane(workspaceId, sessionId) }}
        />
      )}
    </div>
  )
}

function PaneContextMenu({ x, y, ui, onSplitH, onSplitV, onRename, onClose }: {
  x: number; y: number; ui: any
  onSplitH: () => void; onSplitV: () => void; onRename: () => void; onClose: () => void
}) {
  return (
    <div
      data-win98-exempt
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: x, top: y,
        background: ui.bgSecondary,
        border: `1px solid ${ui.border}`,
        borderRadius: 8,
        boxShadow: `0 8px 24px rgba(0,0,0,0.35)`,
        padding: '4px',
        zIndex: 9999,
        minWidth: 170,
      }}
    >
      {[
        { label: 'Split Horizontally', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>, action: onSplitH },
        { label: 'Split Vertically',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>, action: onSplitV },
        null,
        { label: 'Rename',             icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>, action: onRename },
        null,
        { label: 'Close Pane',         icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>, action: onClose, danger: true },
      ].map((item, i) =>
        item === null
          ? <div key={i} style={{ height: 1, background: ui.border, margin: '4px 0' }} />
          : (
            <button
              key={i}
              onClick={item.action}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 5,
                background: 'transparent', border: 'none',
                color: item.danger ? ui.danger : ui.text,
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = item.danger ? ui.danger + '20' : ui.bgTertiary }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: item.danger ? ui.danger : ui.textMuted, display: 'flex' }}>{item.icon}</span>
              {item.label}
            </button>
          )
      )}
    </div>
  )
}

function EmptyState({ ui, termBg, showNewSession }: { ui: any; termBg: string; showNewSession?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const isWin98 = ui.bg === '#c0c0c0'
  const bg = isWin98 ? ui.bg : termBg

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, background: bg,
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="1.5">
        <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
      </svg>
      <p style={{ fontSize: 13, color: ui.textDim }}>No active session</p>
      {showNewSession && (
        <button
          onClick={() => createTab()}
          onMouseEnter={e => {
            if (isWin98) return
            setHovered(true)
          }}
          onMouseLeave={e => {
            if (isWin98) return
            setHovered(false)
          }}
          style={isWin98 ? {
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 16px',
            fontSize: 11,
            color: '#000000',
            background: '#c0c0c0',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
            boxShadow: 'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf',
            fontFamily: "'Tahoma', 'MS Sans Serif', sans-serif",
            minWidth: 75,
            justifyContent: 'center',
          } : {
            marginTop: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 12,
            color: hovered ? ui.text : ui.textMuted,
            background: hovered ? ui.bgTertiary : 'transparent',
            border: `1px solid ${ui.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
          }}
          onMouseDown={e => {
            if (!isWin98) return
            e.currentTarget.style.boxShadow = 'inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf'
          }}
          onMouseUp={e => {
            if (!isWin98) return
            e.currentTarget.style.boxShadow = 'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf'
          }}
        >
          {!isWin98 && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          New Session
        </button>
      )}
    </div>
  )
}
