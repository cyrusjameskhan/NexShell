import { useState } from 'react'
import { useStore } from '../hooks'
import { toggleSidePanel, setState } from '../store'
import { SidePanelSection } from '../types'

const SECTIONS: { id: SidePanelSection; label: string; icon: React.ReactNode; c64Icon: string }[] = [
  {
    id: 'hosts',
    label: 'SSH Hosts',
    c64Icon: '♦',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'agents',
    label: 'Agents',
    c64Icon: '★',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M12 2 C12 2 13.5 8.5 22 12 C13.5 15.5 12 22 12 22 C12 22 10.5 15.5 2 12 C10.5 8.5 12 2 12 2Z" />
      </svg>
    ),
  },
  {
    id: 'variables',
    label: 'System Variables',
    c64Icon: '▒',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    ),
  },
  {
    id: 'snippets',
    label: 'Snippets',
    c64Icon: '«»',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: 'logs',
    label: 'Logs',
    c64Icon: '▪▪▪',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'libraries',
    label: 'Libraries',
    c64Icon: '♣',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="9" height="9" rx="2" />
        <rect x="13" y="2" width="9" height="9" rx="2" />
        <rect x="2" y="13" width="9" height="9" rx="2" />
        <rect x="13" y="13" width="9" height="9" rx="2" />
      </svg>
    ),
  },
]

export default function IconRail() {
  const { theme, sidePanelOpen, sidePanelSection, aiStatus, settings } = useStore()
  const ui = theme.ui
  const [tooltip, setTooltip] = useState<string | null>(null)

  return (
    <div
      style={{
        width: 44,
        flexShrink: 0,
        background: ui.sidebar,
        borderRight: `1px solid ${ui.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Section buttons — top group */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}>
        {SECTIONS.map(section => {
          const isActive = sidePanelOpen && sidePanelSection === section.id
          return (
            <RailButton
              key={section.id}
              tooltipKey={section.id}
              tooltipLabel={section.label}
              tooltip={tooltip}
              setTooltip={setTooltip}
              isActive={isActive}
              activeColor={ui.accent}
              color={isActive ? ui.accent : ui.textMuted}
              activeBg={`${ui.accent}18`}
              onClick={() => toggleSidePanel(section.id)}
              ui={ui}
              c64Icon={section.c64Icon}
            >
              {section.icon}
            </RailButton>
          )
        })}
      </div>

      {/* Spacer pushes bottom items down */}
      <div style={{ flex: 1 }} />

      {/* Bottom group — AI indicator + Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 2, paddingBottom: 6 }}>
        {/* Divider */}
        <div style={{ height: 1, background: ui.border, margin: '4px 8px 6px' }} />

        {aiStatus.available && (
          <RailButton
            tooltipKey="ai"
            tooltipLabel={`AI: ${settings.aiModel || aiStatus.models[0] || 'connected'}`}
            tooltip={tooltip}
            setTooltip={setTooltip}
            isActive={false}
            color={ui.success}
            ui={ui}
            c64Icon="●"
          >
            {/* Pulse dot inside the button area */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="9" y1="10" x2="9" y2="10" strokeWidth="2.5" />
                <line x1="12" y1="10" x2="12" y2="10" strokeWidth="2.5" />
                <line x1="15" y1="10" x2="15" y2="10" strokeWidth="2.5" />
              </svg>
              <div style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ui.success,
              }} />
            </div>
          </RailButton>
        )}

        <RailButton
          tooltipKey="settings"
          tooltipLabel="Settings"
          tooltip={tooltip}
          setTooltip={setTooltip}
          isActive={false}
          color={ui.textMuted}
          onClick={() => setState({ settingsOpen: true })}
          ui={ui}
          c64Icon="✛"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </RailButton>
      </div>
    </div>
  )
}

function RailButton({ children, tooltipKey, tooltipLabel, tooltip, setTooltip, isActive, color, activeBg, activeColor, onClick, ui, c64Icon }: {
  children: React.ReactNode
  tooltipKey: string
  tooltipLabel: string
  tooltip: string | null
  setTooltip: (v: string | null) => void
  isActive: boolean
  color: string
  activeBg?: string
  activeColor?: string
  onClick?: () => void
  ui: any
  c64Icon?: string
}) {
  const isWin98 = ui.bg === '#c0c0c0'
  const isC64 = ui.bg === '#3b2b7e'
  const isRetro = isWin98 || isC64

  return (
    <div style={{ position: 'relative', width: '100%', padding: isRetro ? '2px 4px' : 0, boxSizing: 'border-box' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setTooltip(tooltipKey)}
        onMouseLeave={() => setTooltip(null)}
        className={isWin98 && isActive ? 'win98-btn-active' : isC64 && isActive ? 'c64-btn-active' : undefined}
        style={isRetro ? {
          width: '100%',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          outline: 'none',
        } : {
          width: '100%',
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isActive && activeBg ? activeBg : 'transparent',
          border: 'none',
          borderLeft: `2px solid ${isActive && activeColor ? activeColor : 'transparent'}`,
          color,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'color 0.15s, background 0.15s',
          outline: 'none',
        }}
      >
        {children}
      </button>
      {tooltip === tooltipKey && (
        <div
          style={{
            position: 'fixed',
            left: 50,
            pointerEvents: 'none',
            background: isWin98 ? '#ffffe1' : ui.bgTertiary,
            border: isWin98 ? '1px solid #000000' : `1px solid ${ui.border}`,
            color: isWin98 ? '#000000' : ui.text,
            fontSize: isWin98 ? 11 : 12,
            padding: '2px 6px',
            borderRadius: 0,
            whiteSpace: 'nowrap',
            zIndex: 9999,
            boxShadow: isWin98 ? 'none' : `0 4px 12px ${ui.shadow}`,
            fontFamily: isWin98 ? "'Tahoma', 'MS Sans Serif', sans-serif" : 'inherit',
          }}
        >
          {tooltipLabel}
        </div>
      )}
    </div>
  )
}
