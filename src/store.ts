import { TerminalSession, TerminalTheme, Workspace, Tab, SplitNode, AppSettings, SidePanelSection, SshHost } from './types'
import { defaultTheme } from './themes'

type Listener = () => void

export const defaultShellName = navigator.platform.toLowerCase().includes('win') ? 'PowerShell' : 'Terminal'

const defaultSettings: AppSettings = {
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
  cursorStyle: 'bar',
  cursorBlink: true,
  scrollback: 5000,
  aiModel: 'codellama',
  aiEnabled: true,
  aiProvider: 'ollama',
  aiEndpoint: 'http://localhost:11434',
  aiApiKey: '',
  aiApiFormat: 'auto',
  shell: 'powershell.exe',
  agentCommand: 'claude',
  logRetention: 100,
  opacity: 1,
  alwaysOnTop: false,
  uiScale: 1,
}

export interface SshConnectionInfo {
  sessionId: string
  host: SshHost
}

interface Store {
  sessions: TerminalSession[]
  workspaces: Workspace[]
  tabs: Tab[]
  activeTabIndex: number
  activeSessionId: string | null
  theme: TerminalTheme
  settings: AppSettings
  settingsOpen: boolean
  historyOpen: boolean
  sftpOpen: boolean
  aiStatus: { available: boolean; models: string[] }
  sidePanelOpen: boolean
  sidePanelSection: SidePanelSection | null
  sidePanelWidth: number
  closeConfirmOpen: boolean
  fontZoomTick: number
  sshConnections: SshConnectionInfo[]
  focusMode: 'off' | 'zen' | 'fullscreen'
  /** Temporary filter to pre-select a Libraries category when navigating from another panel */
  libraryFilter: string | null
}

let state: Store = {
  sessions: [],
  workspaces: [],
  tabs: [],
  activeTabIndex: 0,
  activeSessionId: null,
  theme: defaultTheme,
  settings: { ...defaultSettings },
  settingsOpen: false,
  historyOpen: false,
  sftpOpen: false,
  aiStatus: { available: false, models: [] },
  sidePanelOpen: false,
  sidePanelSection: null,
  sidePanelWidth: 280,
  closeConfirmOpen: false,
  fontZoomTick: 0,
  sshConnections: [],
  focusMode: 'off',
  libraryFilter: null,
}

const listeners = new Set<Listener>()
export function getState(): Store { return state }
export function setState(partial: Partial<Store>) {
  state = { ...state, ...partial }
  listeners.forEach(fn => fn())
}
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let counter = 0
function uid(prefix: string) { return `${prefix}-${Date.now()}-${++counter}` }

function makeSession(): TerminalSession {
  const n = state.sessions.length + 1
  return { id: uid('session'), name: `${defaultShellName} ${n}`, isActive: true, createdAt: Date.now() }
}

// ── SplitNode tree utilities ─────────────────────────────────────────────────

function collectSessionIds(node: SplitNode): (string | null)[] {
  if (node.type === 'leaf') return [node.sessionId]
  return node.children.flatMap(collectSessionIds)
}

function containsSession(node: SplitNode, sessionId: string): boolean {
  if (node.type === 'leaf') return node.sessionId === sessionId
  return node.children.some(c => containsSession(c, sessionId))
}

// Replace a leaf that matches `sessionId` with `replacement`
function replaceLeaf(node: SplitNode, sessionId: string, replacement: SplitNode): SplitNode {
  if (node.type === 'leaf') {
    return node.sessionId === sessionId ? replacement : node
  }
  return {
    ...node,
    children: node.children.map(c => replaceLeaf(c, sessionId, replacement)),
  }
}

// Remove a leaf by sessionId and simplify the tree
function removeLeaf(node: SplitNode, sessionId: string): SplitNode | null {
  if (node.type === 'leaf') {
    return node.sessionId === sessionId ? null : node
  }
  const remaining = node.children
    .map(c => removeLeaf(c, sessionId))
    .filter(Boolean) as SplitNode[]
  if (remaining.length === 0) return null
  if (remaining.length === 1) return remaining[0]
  return { ...node, children: remaining }
}

// Simplify: flatten nested splits with same direction, unwrap single children
function simplify(node: SplitNode): SplitNode {
  if (node.type === 'leaf') return node
  let children = node.children.map(simplify)
  // Flatten same-direction children
  const flat: SplitNode[] = []
  for (const c of children) {
    if (c.type === 'split' && c.direction === node.direction) {
      flat.push(...c.children)
    } else {
      flat.push(c)
    }
  }
  if (flat.length === 1) return flat[0]
  return { ...node, children: flat }
}

// ── Tab / Session helpers ────────────────────────────────────────────────────

export function getActiveTab(): Tab | null { return state.tabs[state.activeTabIndex] ?? null }

export function createTab(): TerminalSession {
  const session = makeSession()
  const tab: Tab = { kind: 'session', sessionId: session.id }
  const sessions = [...state.sessions, session]
  const tabs = [...state.tabs, tab]
  setState({ sessions, tabs, activeTabIndex: tabs.length - 1, activeSessionId: session.id })
  return session
}

export function closeTab(tabIndex: number) {
  const tab = state.tabs[tabIndex]
  if (!tab) return
  if (tab.kind === 'session') {
    window.api.killPty(tab.sessionId)
    const sessions = state.sessions.filter(s => s.id !== tab.sessionId)
    const tabs = state.tabs.filter((_, i) => i !== tabIndex)
    const ni = Math.min(tabIndex, tabs.length - 1)
    const nt = tabs[ni] ?? null
    setState({ sessions, tabs, activeTabIndex: Math.max(0, ni), activeSessionId: nt ? firstSessionOfTab(nt) : null })
  } else {
    const ws = state.workspaces.find(w => w.id === tab.workspaceId)
    if (!ws) return
    const ids = collectSessionIds(ws.root).filter(Boolean) as string[]
    ids.forEach(id => window.api.killPty(id))
    const sessions = state.sessions.filter(s => !ids.includes(s.id))
    const workspaces = state.workspaces.filter(w => w.id !== ws.id)
    const tabs = state.tabs.filter((_, i) => i !== tabIndex)
    const ni = Math.min(tabIndex, tabs.length - 1)
    const nt = tabs[ni] ?? null
    setState({ sessions, workspaces, tabs, activeTabIndex: Math.max(0, ni), activeSessionId: nt ? firstSessionOfTab(nt) : null })
  }
}

function firstSessionOfTab(tab: Tab): string | null {
  if (tab.kind === 'session') return tab.sessionId
  const ws = state.workspaces.find(w => w.id === (tab as any).workspaceId)
  if (!ws) return null
  const ids = collectSessionIds(ws.root).filter(Boolean) as string[]
  return ids[0] ?? null
}

export function setActiveTab(index: number) {
  const tab = state.tabs[index]
  if (!tab) return
  setState({ activeTabIndex: index, activeSessionId: firstSessionOfTab(tab) })
}

export function setActivePaneInWorkspace(workspaceId: string, sessionId: string) {
  setState({
    workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, activePaneSessionId: sessionId } : w),
    activeSessionId: sessionId,
  })
}

export function getTabLabel(tab: Tab): string {
  if (tab.kind === 'session') return state.sessions.find(s => s.id === tab.sessionId)?.name ?? defaultShellName
  return state.workspaces.find(w => w.id === tab.workspaceId)?.name ?? 'Workspace'
}

// ── Close a pane inside a workspace ──────────────────────────────────────────
export function closePane(workspaceId: string, sessionId: string) {
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return
  window.api.killPty(sessionId)
  const sessions = state.sessions.filter(s => s.id !== sessionId)
  const newRoot = removeLeaf(ws.root, sessionId)

  if (!newRoot || (newRoot.type === 'leaf' && newRoot.sessionId === null)) {
    // No panes left
    const tabIndex = state.tabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === workspaceId)
    const tabs = state.tabs.filter((_, i) => i !== tabIndex)
    setState({ sessions, workspaces: state.workspaces.filter(w => w.id !== workspaceId), tabs, activeTabIndex: Math.max(0, Math.min(tabIndex, tabs.length - 1)), activeSessionId: null })
    return
  }

  const simplified = simplify(newRoot)
  if (simplified.type === 'leaf' && simplified.sessionId !== null) {
    // Single session left — demote to plain tab
    const tabIndex = state.tabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === workspaceId)
    const newTabs = state.tabs.map((t, i) => i === tabIndex ? { kind: 'session' as const, sessionId: simplified.sessionId! } : t)
    setState({ sessions, workspaces: state.workspaces.filter(w => w.id !== workspaceId), tabs: newTabs, activeSessionId: simplified.sessionId })
  } else {
    const remaining = collectSessionIds(simplified).filter(Boolean) as string[]
    const active = remaining.includes(ws.activePaneSessionId) ? ws.activePaneSessionId : (remaining[0] ?? ws.activePaneSessionId)
    setState({ sessions, workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: simplified, activePaneSessionId: active } : w), activeSessionId: active })
  }
}

// ── Split via right-click menu (creates empty slot) ──────────────────────────
export function splitTab(tabIndex: number, direction: 'horizontal' | 'vertical') {
  const tab = state.tabs[tabIndex]
  if (!tab) return
  if (tab.kind === 'session') {
    const ws: Workspace = {
      id: uid('workspace'), name: 'Workspace',
      root: { type: 'split', direction, children: [{ type: 'leaf', sessionId: tab.sessionId }, { type: 'leaf', sessionId: null }] },
      activePaneSessionId: tab.sessionId,
    }
    setState({ workspaces: [...state.workspaces, ws], tabs: state.tabs.map((t, i) => i === tabIndex ? { kind: 'workspace' as const, workspaceId: ws.id } : t), activeTabIndex: tabIndex })
  } else {
    const ws = state.workspaces.find(w => w.id === tab.workspaceId)
    if (!ws) return
    // Add empty slot beside the active pane
    const targetId = ws.activePaneSessionId
    const newSplit: SplitNode = { type: 'split', direction, children: [{ type: 'leaf', sessionId: targetId }, { type: 'leaf', sessionId: null }] }
    const newRoot = simplify(replaceLeaf(ws.root, targetId, newSplit))
    setState({ workspaces: state.workspaces.map(w => w.id === ws.id ? { ...w, root: newRoot } : w) })
  }
}

export function fillEmptyPane(workspaceId: string) {
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return
  const session = makeSession()
  const fill = (node: SplitNode): SplitNode => {
    if (node.type === 'leaf' && node.sessionId === null) return { type: 'leaf', sessionId: session.id }
    if (node.type === 'split') return { ...node, children: node.children.map(fill) }
    return node
  }
  setState({ sessions: [...state.sessions, session], workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: fill(ws.root), activePaneSessionId: session.id } : w), activeSessionId: session.id })
}

export function closeEmptyPane(workspaceId: string) {
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return
  const remove = (node: SplitNode): SplitNode | null => {
    if (node.type === 'leaf') return node.sessionId === null ? null : node
    const children = node.children.map(remove).filter(Boolean) as SplitNode[]
    if (children.length === 0) return null
    if (children.length === 1) return children[0]
    return { ...node, children }
  }
  const newRoot = remove(ws.root)
  if (!newRoot || (newRoot.type === 'leaf' && newRoot.sessionId !== null)) {
    // Demote back to session tab
    const tabIndex = state.tabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === workspaceId)
    const sid = newRoot?.type === 'leaf' ? newRoot.sessionId : null
    if (sid) {
      setState({ workspaces: state.workspaces.filter(w => w.id !== workspaceId), tabs: state.tabs.map((t, i) => i === tabIndex ? { kind: 'session' as const, sessionId: sid } : t), activeSessionId: sid })
    }
  } else {
    setState({ workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: simplify(newRoot) } : w) })
  }
}

export function dropTabIntoEmptySlot(fromTabIndex: number, workspaceId: string) {
  const fromTab = state.tabs[fromTabIndex]
  if (!fromTab || fromTab.kind !== 'session') return
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return
  const fill = (node: SplitNode): SplitNode => {
    if (node.type === 'leaf' && node.sessionId === null) return { type: 'leaf', sessionId: fromTab.sessionId }
    if (node.type === 'split') return { ...node, children: node.children.map(fill) }
    return node
  }
  const tabs = state.tabs.filter((_, i) => i !== fromTabIndex)
  const toTabIndex = tabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === workspaceId)
  setState({ workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: fill(ws.root), activePaneSessionId: fromTab.sessionId } : w), tabs, activeTabIndex: Math.max(0, toTabIndex), activeSessionId: fromTab.sessionId })
}

// ── Drag a tab onto a pane to split (nested properly) ────────────────────────
export function dragSplitOntoPane(fromTabIndex: number, ontoSessionId: string, position: 'left' | 'right' | 'top' | 'bottom') {
  const fromTab = state.tabs[fromTabIndex]
  if (!fromTab || fromTab.kind !== 'session') return
  const fromSessionId = fromTab.sessionId
  if (fromSessionId === ontoSessionId) return

  const direction: 'horizontal' | 'vertical' = (position === 'left' || position === 'right') ? 'horizontal' : 'vertical'
  const newChildren: SplitNode[] = (position === 'left' || position === 'top')
    ? [{ type: 'leaf', sessionId: fromSessionId }, { type: 'leaf', sessionId: ontoSessionId }]
    : [{ type: 'leaf', sessionId: ontoSessionId }, { type: 'leaf', sessionId: fromSessionId }]
  const replacement: SplitNode = { type: 'split', direction, children: newChildren }

  const ownerTabIndex = state.tabs.findIndex(t => {
    if (t.kind === 'session') return t.sessionId === ontoSessionId
    const ws = state.workspaces.find(w => w.id === (t as any).workspaceId)
    return ws ? containsSession(ws.root, ontoSessionId) : false
  })
  if (ownerTabIndex === -1) return

  const ownerTab = state.tabs[ownerTabIndex]
  let newTabs = state.tabs.filter((_, i) => i !== fromTabIndex)
  const adjusted = ownerTabIndex > fromTabIndex ? ownerTabIndex - 1 : ownerTabIndex

  if (ownerTab.kind === 'session') {
    const ws: Workspace = { id: uid('workspace'), name: 'Workspace', root: simplify(replacement), activePaneSessionId: fromSessionId }
    newTabs = newTabs.map((t, i) => i === adjusted ? { kind: 'workspace' as const, workspaceId: ws.id } : t)
    setState({ workspaces: [...state.workspaces, ws], tabs: newTabs, activeTabIndex: adjusted, activeSessionId: fromSessionId })
  } else {
    const ws = state.workspaces.find(w => w.id === (ownerTab as any).workspaceId)
    if (!ws) return
    const newRoot = simplify(replaceLeaf(ws.root, ontoSessionId, replacement))
    setState({ workspaces: state.workspaces.map(w => w.id === ws.id ? { ...w, root: newRoot, activePaneSessionId: fromSessionId } : w), tabs: newTabs, activeTabIndex: adjusted, activeSessionId: fromSessionId })
  }
}

// ── Move a pane within the same workspace to a new position ──────────────────
export function movePaneWithinWorkspace(workspaceId: string, fromSessionId: string, ontoSessionId: string, position: 'left' | 'right' | 'top' | 'bottom') {
  if (fromSessionId === ontoSessionId) return
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return

  // Remove from current spot, re-insert next to target
  const rootWithout = removeLeaf(ws.root, fromSessionId)
  if (!rootWithout) return
  const simplified = simplify(rootWithout)
  if (!containsSession(simplified, ontoSessionId)) return

  const direction: 'horizontal' | 'vertical' = (position === 'left' || position === 'right') ? 'horizontal' : 'vertical'
  const newChildren: SplitNode[] = (position === 'left' || position === 'top')
    ? [{ type: 'leaf', sessionId: fromSessionId }, { type: 'leaf', sessionId: ontoSessionId }]
    : [{ type: 'leaf', sessionId: ontoSessionId }, { type: 'leaf', sessionId: fromSessionId }]
  const newRoot = simplify(replaceLeaf(simplified, ontoSessionId, { type: 'split', direction, children: newChildren }))

  setState({
    workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: newRoot, activePaneSessionId: fromSessionId } : w),
    activeSessionId: fromSessionId,
  })
}

// ── Move a pane from one workspace onto a pane in another workspace ───────────
// Pass ontoWsId='' when the target is a standalone session (not in a workspace)
export function movePaneAcrossWorkspaces(fromWsId: string, fromSessionId: string, ontoWsId: string, ontoSessionId: string, position: 'left' | 'right' | 'top' | 'bottom') {
  const fromWs = state.workspaces.find(w => w.id === fromWsId)
  if (!fromWs) return

  // If target is a standalone session (no workspace), create a new workspace for both
  if (!ontoWsId) {
    const ontoTabIndex = state.tabs.findIndex(t => t.kind === 'session' && t.sessionId === ontoSessionId)
    if (ontoTabIndex === -1) return

    const direction: 'horizontal' | 'vertical' = (position === 'left' || position === 'right') ? 'horizontal' : 'vertical'
    const newChildren: SplitNode[] = (position === 'left' || position === 'top')
      ? [{ type: 'leaf', sessionId: fromSessionId }, { type: 'leaf', sessionId: ontoSessionId }]
      : [{ type: 'leaf', sessionId: ontoSessionId }, { type: 'leaf', sessionId: fromSessionId }]
    const newWs: Workspace = { id: uid('workspace'), name: 'Workspace', root: { type: 'split', direction, children: newChildren }, activePaneSessionId: fromSessionId }

    // Remove fromSession from its source workspace
    const srcRoot = removeLeaf(fromWs.root, fromSessionId)
    const srcSimplified = srcRoot ? simplify(srcRoot) : null

    let newWorkspaces = [...state.workspaces, newWs]
    let newTabs = state.tabs.map((t, i) => i === ontoTabIndex ? { kind: 'workspace' as const, workspaceId: newWs.id } : t)

    if (!srcSimplified || (srcSimplified.type === 'leaf' && srcSimplified.sessionId === null)) {
      newWorkspaces = newWorkspaces.filter(w => w.id !== fromWsId)
      newTabs = newTabs.filter(t => !(t.kind === 'workspace' && t.workspaceId === fromWsId))
    } else if (srcSimplified.type === 'leaf' && srcSimplified.sessionId !== null) {
      newWorkspaces = newWorkspaces.filter(w => w.id !== fromWsId)
      newTabs = newTabs.map(t => (t.kind === 'workspace' && t.workspaceId === fromWsId)
        ? { kind: 'session' as const, sessionId: srcSimplified.sessionId! }
        : t)
    } else {
      const srcIds = collectSessionIds(srcSimplified).filter(Boolean) as string[]
      newWorkspaces = newWorkspaces.map(w => w.id === fromWsId ? { ...w, root: srcSimplified, activePaneSessionId: srcIds[0] ?? fromWs.activePaneSessionId } : w)
    }

    const newTabIndex = newTabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === newWs.id)
    setState({ workspaces: newWorkspaces, tabs: newTabs, activeTabIndex: Math.max(0, newTabIndex), activeSessionId: fromSessionId })
    return
  }

  const ontoWs = state.workspaces.find(w => w.id === ontoWsId)
  if (!ontoWs) return

  // Remove from source workspace
  const srcRoot = removeLeaf(fromWs.root, fromSessionId)
  const srcSimplified = srcRoot ? simplify(srcRoot) : null

  // Insert into target workspace next to ontoSessionId
  const direction: 'horizontal' | 'vertical' = (position === 'left' || position === 'right') ? 'horizontal' : 'vertical'
  const newChildren: SplitNode[] = (position === 'left' || position === 'top')
    ? [{ type: 'leaf', sessionId: fromSessionId }, { type: 'leaf', sessionId: ontoSessionId }]
    : [{ type: 'leaf', sessionId: ontoSessionId }, { type: 'leaf', sessionId: fromSessionId }]
  const dstRoot = simplify(replaceLeaf(ontoWs.root, ontoSessionId, { type: 'split', direction, children: newChildren }))

  let newWorkspaces = state.workspaces.map(w => {
    if (w.id === ontoWsId) return { ...w, root: dstRoot, activePaneSessionId: fromSessionId }
    return w
  })

  let newTabs = state.tabs

  if (!srcSimplified || (srcSimplified.type === 'leaf' && srcSimplified.sessionId === null)) {
    // Source workspace is now empty — remove it
    newWorkspaces = newWorkspaces.filter(w => w.id !== fromWsId)
    newTabs = newTabs.filter(t => !(t.kind === 'workspace' && t.workspaceId === fromWsId))
  } else if (srcSimplified.type === 'leaf' && srcSimplified.sessionId !== null) {
    // Source workspace demoted to single session tab
    newWorkspaces = newWorkspaces.filter(w => w.id !== fromWsId)
    newTabs = newTabs.map(t => (t.kind === 'workspace' && t.workspaceId === fromWsId)
      ? { kind: 'session' as const, sessionId: srcSimplified.sessionId! }
      : t)
  } else {
    // Source workspace still has multiple panes
    const srcIds = collectSessionIds(srcSimplified).filter(Boolean) as string[]
    const srcActive = srcIds[0] ?? fromWs.activePaneSessionId
    newWorkspaces = newWorkspaces.map(w => w.id === fromWsId ? { ...w, root: srcSimplified, activePaneSessionId: srcActive } : w)
  }

  const ontoTabIndex = newTabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === ontoWsId)
  setState({ workspaces: newWorkspaces, tabs: newTabs, activeTabIndex: Math.max(0, ontoTabIndex), activeSessionId: fromSessionId })
}

// ── Eject a pane out of a workspace into its own tab ─────────────────────────
export function ejectPaneToTab(workspaceId: string, sessionId: string) {
  const ws = state.workspaces.find(w => w.id === workspaceId)
  if (!ws) return
  const newRoot = removeLeaf(ws.root, sessionId)
  const wsTabIndex = state.tabs.findIndex(t => t.kind === 'workspace' && t.workspaceId === workspaceId)
  const newTab: Tab = { kind: 'session', sessionId }

  if (!newRoot || (newRoot.type === 'leaf' && newRoot.sessionId !== null)) {
    // 0 or 1 pane left — demote/remove workspace
    let newTabs: Tab[]
    if (newRoot?.type === 'leaf' && newRoot.sessionId) {
      newTabs = state.tabs.map((t, i) => i === wsTabIndex ? { kind: 'session' as const, sessionId: newRoot.sessionId! } : t)
      newTabs = [...newTabs.slice(0, wsTabIndex + 1), newTab, ...newTabs.slice(wsTabIndex + 1)]
    } else {
      newTabs = state.tabs.map((t, i) => i === wsTabIndex ? newTab : t)
    }
    setState({ workspaces: state.workspaces.filter(w => w.id !== workspaceId), tabs: newTabs, activeTabIndex: newTabs.findIndex(t => t.kind === 'session' && t.sessionId === sessionId), activeSessionId: sessionId })
  } else {
    const simplified = simplify(newRoot)
    const ids = collectSessionIds(simplified).filter(Boolean) as string[]
    const active = ids[0] ?? ws.activePaneSessionId
    const newTabs = [...state.tabs.slice(0, wsTabIndex + 1), newTab, ...state.tabs.slice(wsTabIndex + 1)]
    setState({ workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, root: simplified, activePaneSessionId: active } : w), tabs: newTabs, activeTabIndex: wsTabIndex + 1, activeSessionId: sessionId })
  }
}

// ── Check if a sessionId is in a specific workspace ──────────────────────────
export function isSessionInWorkspace(workspaceId: string, sessionId: string): boolean {
  const ws = state.workspaces.find(w => w.id === workspaceId)
  return ws ? containsSession(ws.root, sessionId) : false
}

// ── Merge tab into workspace ─────────────────────────────────────────────────
export function mergeTabIntoWorkspace(fromTabIndex: number, toWorkspaceId: string) {
  dropTabIntoEmptySlot(fromTabIndex, toWorkspaceId)
}

// ── Rename ────────────────────────────────────────────────────────────────────
export function renameSession(sessionId: string, name: string) {
  setState({ sessions: state.sessions.map(s => s.id === sessionId ? { ...s, name: name.trim() || s.name } : s) })
}

export function renameWorkspace(workspaceId: string, name: string) {
  setState({ workspaces: state.workspaces.map(w => w.id === workspaceId ? { ...w, name: name.trim() || w.name } : w) })
}

// ── Font zoom ─────────────────────────────────────────────────────────────────
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 32

export function zoomFontSize(delta: number) {
  const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, state.settings.fontSize + delta))
  if (next === state.settings.fontSize) return
  const settings = { ...state.settings, fontSize: next }
  setState({ settings, fontZoomTick: state.fontZoomTick + 1 })
  window.api.setSettings(settings)
}

export function resetFontSize() {
  const settings = { ...state.settings, fontSize: defaultSettings.fontSize }
  setState({ settings, fontZoomTick: state.fontZoomTick + 1 })
  window.api.setSettings(settings)
}

// ── Side Panel ────────────────────────────────────────────────────────────────
export function toggleSidePanel(section: SidePanelSection) {
  setState({ sidePanelOpen: true, sidePanelSection: section })
  window.api.setSidebarState({ section: state.sidePanelSection, width: state.sidePanelWidth })
}

export function setSidePanelWidth(width: number) {
  const clamped = Math.min(400, Math.max(200, width))
  setState({ sidePanelWidth: clamped })
  window.api.setSidebarState({ section: state.sidePanelSection, width: clamped })
}

// ── SSH Connection tracking ───────────────────────────────────────────────────

export function registerSshConnection(sessionId: string, host: SshHost) {
  const existing = state.sshConnections.find(c => c.sessionId === sessionId)
  if (existing) return
  setState({ sshConnections: [...state.sshConnections, { sessionId, host }] })
}

export function unregisterSshConnection(sessionId: string) {
  setState({ sshConnections: state.sshConnections.filter(c => c.sessionId !== sessionId) })
}

export function getActiveSessionSshConnection(): SshConnectionInfo | null {
  if (!state.activeSessionId) return null
  return state.sshConnections.find(c => c.sessionId === state.activeSessionId) ?? null
}

export async function refreshAiStatus(endpoint?: string) {
  const aiStatus = await window.api.aiCheck(endpoint)
  setState({ aiStatus })
}

export async function initStore() {
  const [savedTheme, savedSettings, aiStatus, savedSidebar] = await Promise.all([
    window.api.getTheme(), window.api.getSettings(), window.api.aiCheck(), window.api.getSidebarState(),
  ])
  const mergedSettings = savedSettings ? { ...defaultSettings, ...savedSettings } : defaultSettings
  setState({
    theme: savedTheme || defaultTheme,
    settings: mergedSettings,
    aiStatus,
    sidePanelWidth: savedSidebar?.width ?? 280,
    sidePanelSection: savedSidebar?.section ?? 'hosts',
  })
  if (mergedSettings.opacity !== 1) {
    window.api.setOpacity(mergedSettings.opacity)
  }
  if (mergedSettings.alwaysOnTop) {
    window.api.setAlwaysOnTop(true)
  }
}
