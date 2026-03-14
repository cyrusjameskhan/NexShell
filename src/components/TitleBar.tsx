import { useStore } from '../hooks'
import { setState } from '../store'
import logo from '../assets/logo.png'

export default function TitleBar() {
  const { theme, tabs } = useStore()
  const ui = theme.ui

  const handleClose = () => {
    if (tabs.length > 1) {
      setState({ closeConfirmOpen: true })
    } else {
      window.api.close()
    }
  }

  return (
    <div
      style={{
        height: 38,
        background: ui.titlebar,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 0,
        borderBottom: `1px solid ${ui.border}`,
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        flexShrink: 0,
      } as any}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={logo} alt="NexShell" style={{ width: 18, height: 18, objectFit: 'contain', opacity: 0.9 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: ui.text, letterSpacing: 0.5 }}>
          NexShell
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: '100%',
          WebkitAppRegion: 'no-drag',
        } as any}
      >
        <WindowButton onClick={() => window.api.minimize()} color={ui.textMuted} hoverBg={ui.bgTertiary}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </WindowButton>
        <WindowButton onClick={() => window.api.maximize()} color={ui.textMuted} hoverBg={ui.bgTertiary}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </WindowButton>
        <WindowButton onClick={handleClose} color={ui.textMuted} hoverBg="#e81123" hoverColor="#fff">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </WindowButton>
      </div>
    </div>
  )
}

function WindowButton({
  children,
  onClick,
  color,
  hoverBg,
  hoverColor,
}: {
  children: React.ReactNode
  onClick: () => void
  color: string
  hoverBg: string
  hoverColor?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 46,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = hoverBg
        if (hoverColor) e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = color
      }}
    >
      {children}
    </button>
  )
}
