import { useEffect, useState, useRef } from 'react'
import { useStore } from '../hooks'
import { setState } from '../store'

export default function HistoryPanel() {
  const { historyOpen, theme, activeSessionId } = useStore()
  const ui = theme.ui
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (historyOpen) {
      setQuery('')
      setSelectedIndex(0)
      window.api.searchHistory('').then(setResults)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [historyOpen])

  useEffect(() => {
    if (!historyOpen) return
    window.api.searchHistory(query).then(r => {
      setResults(r)
      setSelectedIndex(0)
    })
  }, [query, historyOpen])

  useEffect(() => {
    if (!historyOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setState({ historyOpen: false })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        if (activeSessionId) {
          window.api.writePty(activeSessionId, results[selectedIndex])
        }
        setState({ historyOpen: false })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [historyOpen, results, selectedIndex, activeSessionId])

  if (!historyOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 100,
        zIndex: 1000,
      }}
      onClick={() => setState({ historyOpen: false })}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 560,
          maxHeight: 460,
          background: ui.bgSecondary,
          border: `1px solid ${ui.border}`,
          borderRadius: 12,
          boxShadow: `0 16px 48px ${ui.shadow}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: ui.inputBg,
            border: `1px solid ${ui.inputBorder}`,
            borderRadius: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ui.textMuted} strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search command history..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: ui.text,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 10, color: ui.textDim }}>ESC to close</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px 8px 12px',
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: ui.textDim, fontSize: 13 }}>
              {query ? 'No matching commands' : 'No command history yet'}
            </div>
          ) : (
            results.map((cmd, i) => (
              <div
                key={`${cmd}-${i}`}
                onClick={() => {
                  if (activeSessionId) {
                    window.api.writePty(activeSessionId, cmd)
                  }
                  setState({ historyOpen: false })
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: i === selectedIndex ? ui.accentMuted : 'transparent',
                  color: i === selectedIndex ? ui.text : ui.textMuted,
                  fontSize: 13,
                  fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {cmd}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
