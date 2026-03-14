import { useEffect } from 'react'
import { useStore } from './hooks'
import { initStore, createTab, setState, toggleSidePanel } from './store'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import PaneContainer from './components/PaneContainer'
import HistoryPanel from './components/HistoryPanel'
import SftpPanel from './components/SftpPanel'
import SettingsPanel from './components/SettingsPanel'
import SidePanel from './components/SidePanel'
import CloseConfirmModal from './components/CloseConfirmModal'

export default function App() {
  const { tabs, theme, sidePanelOpen, sidePanelSection } = useStore()
  const ui = theme.ui

  useEffect(() => {
    initStore().then(() => {
      createTab()
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        setState({ historyOpen: true })
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        createTab()
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        if (sidePanelOpen) {
          setState({ sidePanelOpen: false })
        } else {
          toggleSidePanel(sidePanelSection ?? 'hosts')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidePanelOpen, sidePanelSection])

  useEffect(() => {
    const id = 'wrappedshell-scrollbar-styles'
    let style = document.getElementById(id) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = id
      document.head.appendChild(style)
    }
    style.textContent = `
      .xterm-viewport::-webkit-scrollbar { width: 6px; }
      .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
      .xterm-viewport::-webkit-scrollbar-thumb { background: ${ui.scrollbar}; border-radius: 3px; }
      .xterm-viewport::-webkit-scrollbar-thumb:hover { background: ${ui.scrollbarHover}; }
      .xterm-viewport::-webkit-scrollbar-corner { background: transparent; }
      *::-webkit-scrollbar { width: 6px; height: 6px; }
      *::-webkit-scrollbar-track { background: transparent; }
      *::-webkit-scrollbar-thumb { background: ${ui.scrollbar}; border-radius: 3px; }
      *::-webkit-scrollbar-thumb:hover { background: ${ui.scrollbarHover}; }
      *::-webkit-scrollbar-corner { background: transparent; }
      * { scrollbar-color: ${ui.scrollbar} transparent; scrollbar-width: thin; }

      /* Pane header: always visible, no hover trick needed */
    `
    return () => { style?.remove() }
  }, [ui.scrollbar, ui.scrollbarHover])

  return (
    <div style={{
      width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
      background: ui.bg, color: ui.text, overflow: 'hidden',
    }}>
      <TitleBar />
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', position: 'relative' }}>
        {/* PaneContainer always mounted so PTYs stay alive */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <PaneContainer />
        </div>
        {sidePanelOpen && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
            <SidePanel />
          </div>
        )}
      </div>
      <StatusBar ui={ui} theme={theme} />
      <HistoryPanel />
      <SftpPanel />
      <SettingsPanel />
      <CloseConfirmModal />
    </div>
  )
}

function StatusBar({ ui, theme }: { ui: any; theme: any }) {
  const { sessions, aiStatus, settings } = useStore()
  return (
    <div style={{
      height: 24, background: ui.bgSecondary, borderTop: `1px solid ${ui.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px', fontSize: 11, color: ui.textDim,
      flexShrink: 0, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
        <span>PowerShell</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {aiStatus.available && settings.aiEnabled && (
          <span style={{ color: ui.textMuted, opacity: 0.7 }}>
            <kbd style={{
              background: ui.bgTertiary, border: `1px solid ${ui.border}`,
              borderRadius: 3, padding: '0 4px', fontSize: 10, fontFamily: 'inherit',
            }}>Shift+Tab</kbd> AI Assist
          </span>
        )}
        {aiStatus.available && (
          <span style={{ color: ui.success }}>AI: {settings.aiModel || aiStatus.models[0] || 'connected'}</span>
        )}
        <span>{theme.name}</span>
      </div>
    </div>
  )
}
