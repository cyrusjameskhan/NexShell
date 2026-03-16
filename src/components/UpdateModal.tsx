import { useEffect } from 'react'
import { useStore } from '../hooks'
import { setState } from '../store'

export default function UpdateModal() {
  const { updateAvailable, updateDownloading, updateDownloaded, theme } = useStore()
  const ui = theme.ui

  useEffect(() => {
    const unsubAvailable = window.api.onUpdateAvailable((info) => {
      setState({ updateAvailable: info, updateDownloaded: false })
    })
    const unsubDownloaded = window.api.onUpdateDownloaded(() => {
      setState({ updateDownloading: false, updateDownloaded: true })
    })
    const unsubError = window.api.onUpdateError((msg) => {
      setState({ updateAvailable: null, updateDownloading: false, updateDownloaded: false })
      console.warn('Update error:', msg)
    })
    return () => {
      unsubAvailable()
      unsubDownloaded()
      unsubError()
    }
  }, [])

  useEffect(() => {
    if (!updateAvailable && !updateDownloaded) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !updateDownloading) {
        setState({ updateAvailable: null, updateDownloading: false, updateDownloaded: false })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [updateAvailable, updateDownloaded, updateDownloading])

  if (!updateAvailable && !updateDownloaded) return null

  const version = updateAvailable?.version ?? ''
  const isReady = updateDownloaded

  async function handleInstall() {
    if (isReady) {
      window.api.updateInstall()
    } else {
      setState({ updateDownloading: true })
      window.api.updateDownload()
    }
  }

  async function handleRemindLater() {
    await window.api.updateRemindLater()
    setState({ updateAvailable: null, updateDownloading: false, updateDownloaded: false })
  }

  async function handleSkip() {
    if (version) await window.api.updateDontShowAgain(version)
    setState({ updateAvailable: null, updateDownloading: false, updateDownloaded: false })
  }

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
      onClick={() => !isReady && !updateDownloading && setState({ updateAvailable: null, updateDownloaded: false })}
    >
      <div
        onClick={e => e.stopPropagation()}
        data-win98-exempt
        style={{
          width: 400,
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
            background: `${ui.accent}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
                stroke={ui.accent}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: ui.text, margin: 0 }}>
              {isReady ? 'Update ready' : updateDownloading ? 'Downloading...' : 'Update available'}
            </h2>
            <p style={{ fontSize: 13, color: ui.textMuted, margin: '4px 0 0', lineHeight: 1.4 }}>
              {isReady
                ? `NexShell ${version} has been downloaded. Restart to install.`
                : updateDownloading
                  ? `Downloading NexShell ${version}...`
                  : `NexShell ${version} is available. Download and install now?`}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: 8,
          padding: '12px 24px 20px',
        }}>
          <button
            onClick={handleSkip}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${ui.border}`,
              background: 'transparent',
              color: ui.textMuted,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = ui.text }}
            onMouseLeave={e => { e.currentTarget.style.color = ui.textMuted }}
          >
            Skip this version
          </button>
          <button
            onClick={handleRemindLater}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              border: `1px solid ${ui.border}`,
              background: ui.bgTertiary,
              color: ui.text,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = ui.inputBg }}
            onMouseLeave={e => { e.currentTarget.style.background = ui.bgTertiary }}
          >
            Remind me later
          </button>
          <button
            onClick={handleInstall}
            disabled={updateDownloading}
            style={{
              padding: '7px 18px',
              borderRadius: 6,
              border: 'none',
              background: updateDownloading ? ui.bgTertiary : ui.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: updateDownloading ? 'wait' : 'pointer',
              transition: 'opacity 0.15s',
              opacity: updateDownloading ? 0.8 : 1,
            }}
            onMouseEnter={e => { if (!updateDownloading) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { if (!updateDownloading) e.currentTarget.style.opacity = '1' }}
          >
            {isReady ? 'Restart & install' : updateDownloading ? 'Downloading...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
