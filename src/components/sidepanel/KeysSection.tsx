import { useStore } from '../../hooks'

export default function KeysSection() {
  const { theme } = useStore()
  const ui = theme.ui

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: `1px solid ${ui.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          SSH Keys
        </span>
        <button
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 11,
            background: `${ui.accent}22`,
            border: `1px solid ${ui.accent}44`,
            borderRadius: 4,
            color: ui.accent,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Key
        </button>
      </div>
      <EmptyState
        ui={ui}
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M21 2L13 10" />
            <path d="M19 2h2v2" />
            <path d="M15 6l2 2" />
          </svg>
        }
        title="No SSH Keys"
        description="Store and manage your SSH private keys for secure connections."
      />
    </div>
  )
}

function EmptyState({ ui, icon, title, description }: {
  ui: any
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      gap: 10,
      textAlign: 'center',
    }}>
      <div style={{ color: ui.textDim, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>{title}</div>
      <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 180 }}>{description}</div>
    </div>
  )
}
