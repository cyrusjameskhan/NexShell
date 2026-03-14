import { useEffect } from 'react'
import { useStore } from '../hooks'
import { setState } from '../store'

export default function CloseConfirmModal() {
  const { closeConfirmOpen, theme, tabs } = useStore()
  const ui = theme.ui

  useEffect(() => {
    if (!closeConfirmOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setState({ closeConfirmOpen: false })
      } else if (e.key === 'Enter') {
        window.api.close()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [closeConfirmOpen])

  if (!closeConfirmOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={() => setState({ closeConfirmOpen: false })}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380,
          background: ui.bgSecondary,
          border: `1px solid ${ui.border}`,
          borderRadius: 12,
          boxShadow: `0 16px 48px ${ui.shadow}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '20px 24px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${ui.danger}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4m0 4h.01M4.93 19h14.14c1.34 0 2.18-1.46 1.5-2.62l-7.07-12.24a1.73 1.73 0 0 0-3 0L3.43 16.38C2.75 17.54 3.59 19 4.93 19Z"
                stroke={ui.danger}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: ui.text, margin: 0 }}>
              Close NexShell
            </h2>
            <p style={{ fontSize: 13, color: ui.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>
              You have {tabs.length} open tabs. All sessions will be terminated.
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '12px 24px 20px',
        }}>
          <button
            onClick={() => setState({ closeConfirmOpen: false })}
            style={{
              padding: '7px 18px',
              borderRadius: 6,
              border: `1px solid ${ui.border}`,
              background: ui.bgTertiary,
              color: ui.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = ui.inputBg }}
            onMouseLeave={e => { e.currentTarget.style.background = ui.bgTertiary }}
          >
            Cancel
          </button>
          <button
            onClick={() => window.api.close()}
            style={{
              padding: '7px 18px',
              borderRadius: 6,
              border: 'none',
              background: ui.danger,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            Close All
          </button>
        </div>
      </div>
    </div>
  )
}
