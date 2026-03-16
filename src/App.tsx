import { useEffect, useState, useRef } from 'react'
import { useStore } from './hooks'
import { initStore, createTab, setState, getState, toggleSidePanel } from './store'
import { themes } from './themes'
import { TerminalTheme } from './types'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import PaneContainer from './components/PaneContainer'
import HistoryPanel from './components/HistoryPanel'
import SftpPanel from './components/SftpPanel'
import SettingsPanel from './components/SettingsPanel'
import SidePanel from './components/SidePanel'
import CloseConfirmModal from './components/CloseConfirmModal'
import UpdateModal from './components/UpdateModal'

export default function App() {
  const { tabs, theme, settings, sidePanelOpen, sidePanelSection, focusMode } = useStore()
  const ui = theme.ui
  const chromeHidden = focusMode !== 'off'
  const uiScale = settings.uiScale ?? 1

  useEffect(() => {
    initStore().then(() => {
      if (getState().tabs.length === 0) createTab()
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // F11 toggles Fullscreen mode (chrome hidden + OS fullscreen)
      if (e.key === 'F11') {
        e.preventDefault()
        const s = getState()
        if (s.focusMode === 'fullscreen') {
          setState({ focusMode: 'off' })
          window.api.setFullScreen(false)
        } else {
          setState({ focusMode: 'fullscreen', sidePanelOpen: false })
          window.api.setFullScreen(true)
        }
        return
      }
      // Escape exits either focus mode
      if (e.key === 'Escape' && getState().focusMode !== 'off') {
        const s = getState()
        if (!s.historyOpen && !s.settingsOpen && !s.sftpOpen && !s.closeConfirmOpen) {
          e.preventDefault()
          const wasFullscreen = s.focusMode === 'fullscreen'
          setState({ focusMode: 'off' })
          if (wasFullscreen) window.api.setFullScreen(false)
          return
        }
      }
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

      .xterm-viewport { contain: strict; will-change: scroll-position; }
      [data-file-row] { content-visibility: auto; contain-intrinsic-size: auto 28px; }
    `
    return () => { style?.remove() }
  }, [ui.scrollbar, ui.scrollbarHover])

  useEffect(() => {
    const id = 'wrappedshell-theme-fx-styles'
    let style = document.getElementById(id) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = id
      document.head.appendChild(style)
    }
    style.textContent = theme.effects?.globalCss ?? ''
    return () => { style?.remove() }
  }, [theme.effects?.globalCss])

  const postProcessFilter = theme.effects?.postProcessFilter

  return (
    <div
      className={
        theme.id === 'windows98' ? 'win98' :
        theme.id === 'commodore64' ? 'c64' :
        (theme.id === 'fallout' || theme.id === 'amber-crt') ? 'dos-font' :
        undefined
      }
      style={{
        width: uiScale !== 1 ? `${100 / uiScale}%` : '100%',
        height: uiScale !== 1 ? `${100 / uiScale}vh` : '100vh',
        display: 'flex', flexDirection: 'column',
        background: ui.bg, color: ui.text, overflow: 'hidden',
        filter: postProcessFilter ?? 'none',
        transition: 'filter 0.4s ease',
        transform: uiScale !== 1 ? `scale(${uiScale})` : undefined,
        transformOrigin: 'top left',
      }}
    >
      {!chromeHidden && <TitleBar />}
      {!chromeHidden && <TabBar />}
      {focusMode === 'zen' && <ZenDragBar ui={ui} />}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', position: 'relative' }}>
        {/* PaneContainer always mounted so PTYs stay alive */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <PaneContainer />
        </div>
        {sidePanelOpen && !chromeHidden && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
            <SidePanel />
          </div>
        )}
      </div>
      {!chromeHidden && <StatusBar ui={ui} theme={theme} />}
      <HistoryPanel />
      <SftpPanel />
      <SettingsPanel />
      <CloseConfirmModal />
      <UpdateModal />
    </div>
  )
}

function ThemeQuickPicker({ ui, activeTheme, onClose }: { ui: any; activeTheme: TerminalTheme; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const filtered = search.trim()
    ? themes.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : themes

  function selectTheme(t: TerminalTheme) {
    setState({ theme: t })
    window.api.setTheme(t)
    onClose()
  }

  return (
    <div
      ref={ref}
      data-win98-exempt
      style={{
        position: 'absolute',
        bottom: 28,
        right: 0,
        width: 240,
        background: ui.bgSecondary,
        border: `1px solid ${ui.border}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 2000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '8px 8px 4px' }}>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search themes..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: ui.bgTertiary,
            border: `1px solid ${ui.border}`,
            borderRadius: 5,
            color: ui.text,
            fontSize: 11,
            padding: '4px 8px',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 280, padding: '4px 0' }}>
        {filtered.map(t => {
          const isActive = t.id === activeTheme.id
          return (
            <button
              key={t.id}
              onClick={() => selectTheme(t)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 12px',
                background: isActive ? ui.bgTertiary : 'transparent',
                border: 'none',
                color: isActive ? ui.accent : ui.text,
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ui.bgTertiary }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {[t.colors.red, t.colors.green, t.colors.blue, t.colors.cyan].map((c, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                ))}
              </div>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </span>
              {isActive && (
                <span style={{ fontSize: 10, color: ui.accent, flexShrink: 0 }}>✓</span>
              )}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '8px 12px', color: ui.textDim, fontSize: 11 }}>No themes found</div>
        )}
      </div>
      <div
        style={{
          borderTop: `1px solid ${ui.border}`,
          padding: '6px 12px',
          fontSize: 10,
          color: ui.textDim,
          cursor: 'pointer',
        }}
        onClick={() => { setState({ settingsOpen: true }); onClose() }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = ui.text }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ui.textDim }}
      >
        Open full settings →
      </div>
    </div>
  )
}

function ZenDragBar({ ui }: { ui: any }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: hovered ? 38 : 38,
        zIndex: 100,
        WebkitAppRegion: 'drag',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? `${ui.bg}e0` : 'transparent',
        backdropFilter: hovered ? 'blur(8px)' : 'none',
        transition: 'background 0.2s ease',
      } as any}
    >
      {hovered && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: ui.textDim,
          fontSize: 11,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" style={{ opacity: 0.5 }}>
            <rect x="0" y="0" width="16" height="1.5" rx="0.75" />
            <rect x="0" y="2.5" width="16" height="1.5" rx="0.75" />
          </svg>
          <span style={{ opacity: 0.6 }}>Drag to move</span>
          <span style={{ opacity: 0.4, fontSize: 10 }}>Esc to exit</span>
        </div>
      )}
    </div>
  )
}

function StatusBar({ ui, theme }: { ui: any; theme: any }) {
  const { sessions, aiStatus, settings } = useStore()
  const [pickerOpen, setPickerOpen] = useState(false)

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
        <div style={{ position: 'relative' }}>
          <span
            onClick={() => setPickerOpen(o => !o)}
            title="Change theme"
            style={{
              cursor: 'pointer',
              color: pickerOpen ? ui.accent : ui.textDim,
              borderBottom: `1px dotted ${pickerOpen ? ui.accent : ui.border}`,
              paddingBottom: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { if (!pickerOpen) (e.currentTarget as HTMLElement).style.color = ui.text }}
            onMouseLeave={e => { if (!pickerOpen) (e.currentTarget as HTMLElement).style.color = ui.textDim }}
          >
            {theme.name}
          </span>
          {pickerOpen && (
            <ThemeQuickPicker
              ui={ui}
              activeTheme={theme}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
