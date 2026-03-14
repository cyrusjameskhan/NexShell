import { useEffect } from 'react'
import { useStore } from '../hooks'
import { setState } from '../store'
import { SidePanelSection } from '../types'
import IconRail from './IconRail'
import HostsSection from './sidepanel/HostsSection'
import AgentsSection from './sidepanel/AgentsSection'
import VariablesSection from './sidepanel/VariablesSection'
import SnippetsSection from './sidepanel/SnippetsSection'
import LogsSection from './sidepanel/LogsSection'
import LibrariesSection from './sidepanel/LibrariesSection'

const SECTION_LABELS: Record<SidePanelSection, string> = {
  hosts: 'SSH Hosts',
  agents: 'Agents',
  variables: 'System Variables',
  snippets: 'Snippets',
  logs: 'Logs',
  libraries: 'Libraries',
}

function SectionContent({ section }: { section: SidePanelSection }) {
  switch (section) {
    case 'hosts': return <HostsSection />
    case 'agents': return <AgentsSection />
    case 'variables': return <VariablesSection />
    case 'snippets': return <SnippetsSection />
    case 'logs': return <LogsSection />
    case 'libraries': return <LibrariesSection />
  }
}

export default function SidePanel() {
  const { theme, sidePanelSection } = useStore()
  const ui = theme.ui

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setState({ sidePanelOpen: false })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!sidePanelSection) return null

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Icon rail for switching sections */}
      <IconRail />

      {/* Section content */}
      <div style={{
        flex: 1,
        minWidth: 0,
        background: ui.bgSecondary,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 12px',
          height: 38,
          borderBottom: `1px solid ${ui.border}`,
          flexShrink: 0,
          background: ui.bgTertiary,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: ui.text, userSelect: 'none' }}>
            {SECTION_LABELS[sidePanelSection]}
          </span>
          <button
            onClick={() => setState({ sidePanelOpen: false })}
            title="Close panel (Ctrl+B)"
            style={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: ui.textMuted,
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = ui.text;
              (e.currentTarget as HTMLButtonElement).style.background = ui.bgSecondary
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = ui.textMuted;
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <SectionContent section={sidePanelSection} />
        </div>
      </div>
    </div>
  )
}
