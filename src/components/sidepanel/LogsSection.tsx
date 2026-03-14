import { useStore } from '../../hooks'

export default function LogsSection() {
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
          Logs
        </span>
        <button
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 11,
            background: `${ui.danger}18`,
            border: `1px solid ${ui.danger}33`,
            borderRadius: 4,
            color: ui.danger,
            cursor: 'not-allowed',
            opacity: 0.5,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Clear
        </button>
      </div>
      <EmptyState
        ui={ui}
        icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        }
        title="No Logs"
        description="Past shell session logs will appear here for review and search."
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
