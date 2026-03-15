import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../hooks'
import { EnvVariable } from '../../types'

function uid() {
  return `var-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function VariablesSection() {
  const { theme } = useStore()
  const ui = theme.ui

  const [vars, setVarsState] = useState<EnvVariable[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<EnvVariable | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formSecret, setFormSecret] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [importText, setImportText] = useState<string | null>(null)

  useEffect(() => {
    window.api.getVariables().then(loaded => {
      if (loaded?.length) setVarsState(loaded)
    })
  }, [])

  const persist = useCallback((updated: EnvVariable[]) => {
    setVarsState(updated)
    window.api.setVariables(updated)
  }, [])

  const filtered = vars.filter(v => {
    const q = search.toLowerCase()
    return !q || v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
  })

  const enabledCount = vars.filter(v => v.enabled).length

  function openAdd() {
    setFormKey(''); setFormValue(''); setFormSecret(false)
    setEditing(null); setIsAdding(true)
  }

  function openEdit(v: EnvVariable) {
    setFormKey(v.key); setFormValue(v.value); setFormSecret(v.secret)
    setEditing(v); setIsAdding(true)
  }

  function saveForm() {
    const key = formKey.trim()
    if (!key) return
    if (editing) {
      persist(vars.map(v => v.id === editing.id ? { ...v, key, value: formValue, secret: formSecret } : v))
    } else {
      persist([...vars, { id: uid(), key, value: formValue, enabled: true, secret: formSecret }])
    }
    setIsAdding(false); setEditing(null)
  }

  function deleteVar(id: string) {
    persist(vars.filter(v => v.id !== id)); setConfirmDelete(null)
  }

  function toggleEnabled(id: string) {
    persist(vars.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v))
  }

  function toggleAll(enabled: boolean) {
    persist(vars.map(v => ({ ...v, enabled })))
  }

  function parseAndImport(text: string) {
    const lines = text.split('\n')
    const newVars: EnvVariable[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      let key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (key.startsWith('export ')) key = key.slice(7).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!key) continue
      if (vars.some(v => v.key === key) || newVars.some(v => v.key === key)) continue
      newVars.push({ id: uid(), key, value, enabled: true, secret: false })
    }
    if (newVars.length > 0) persist([...vars, ...newVars])
    setImportText(null)
  }

  function duplicateVar(v: EnvVariable) {
    persist([...vars, { id: uid(), key: `${v.key}_COPY`, value: v.value, enabled: v.enabled, secret: v.secret }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search variables..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>
        <button
          onClick={() => window.api.openSystemVariables()}
          title="Open system environment variables"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 4, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s, color 0.15s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = ui.bgTertiary; e.currentTarget.style.color = ui.text }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textMuted }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        <button
          onClick={() => setImportText('')}
          title="Import from .env format"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 4, color: ui.textMuted, cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s, color 0.15s, border-color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = ui.bgTertiary; e.currentTarget.style.color = ui.text }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = ui.textMuted }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: ui.bg, cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      {/* Summary bar */}
      {vars.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: ui.textDim }}>
            {enabledCount}/{vars.length} active
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggleAll(true)}
              style={{ fontSize: 10, color: ui.accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', opacity: enabledCount === vars.length ? 0.4 : 1 }}>
              Enable all
            </button>
            <button onClick={() => toggleAll(false)}
              style={{ fontSize: 10, color: ui.textDim, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', opacity: enabledCount === 0 ? 0.4 : 1 }}>
              Disable all
            </button>
          </div>
        </div>
      )}

      {/* Variable list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState ui={ui} hasSearch={!!search} onAdd={openAdd} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.map(v => (
              <VarRow key={v.id} variable={v} ui={ui}
                onToggle={() => toggleEnabled(v.id)}
                onEdit={() => openEdit(v)}
                onDuplicate={() => duplicateVar(v)}
                onDelete={() => setConfirmDelete(v.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit form modal */}
      {isAdding && (
        <VarForm
          formKey={formKey} formValue={formValue} formSecret={formSecret}
          setFormKey={setFormKey} setFormValue={setFormValue} setFormSecret={setFormSecret}
          editing={editing} ui={ui}
          existingKeys={vars.filter(v => v.id !== editing?.id).map(v => v.key)}
          onSave={saveForm}
          onCancel={() => { setIsAdding(false); setEditing(null) }}
        />
      )}

      {/* Import overlay */}
      {importText !== null && (
        <ImportOverlay ui={ui} text={importText} setText={setImportText}
          onImport={parseAndImport} onCancel={() => setImportText(null)} />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDelete ui={ui}
          varKey={vars.find(v => v.id === confirmDelete)?.key || 'this variable'}
          onConfirm={() => deleteVar(confirmDelete)}
          onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}

// ── Variable Row ──────────────────────────────────────────────────────────────
function VarRow({ variable, ui, onToggle, onEdit, onDuplicate, onDelete }: {
  variable: EnvVariable; ui: any
  onToggle: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const displayValue = variable.secret && !revealed
    ? '\u2022'.repeat(Math.min(variable.value.length || 8, 24))
    : variable.value || '(empty)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setRevealed(false) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px', borderRadius: 6,
        background: hovered ? ui.bgTertiary : 'transparent',
        border: `1px solid ${hovered ? ui.border : 'transparent'}`,
        transition: 'background 0.1s',
        opacity: variable.enabled ? 1 : 0.5,
      }}
    >
      <button onClick={onToggle} title={variable.enabled ? 'Disable' : 'Enable'}
        style={{
          width: 28, height: 16, borderRadius: 8, padding: 0,
          background: variable.enabled ? ui.accent : ui.bgTertiary,
          border: `1px solid ${variable.enabled ? ui.accent : ui.border}`,
          cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
        }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 1, left: variable.enabled ? 14 : 1,
          transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }} />
      </button>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: ui.text, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {variable.key}
          </span>
          {variable.secret && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
        <div style={{
          fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: variable.secret && !revealed ? ui.textDim : ui.textMuted,
          letterSpacing: variable.secret && !revealed ? '0.1em' : undefined,
        }}>
          {displayValue}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        {variable.secret && (
          <IconBtn title={revealed ? 'Hide' : 'Reveal'} ui={ui} onClick={() => setRevealed(!revealed)}>
            {revealed ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </IconBtn>
        )}
        <IconBtn title="Edit" ui={ui} onClick={onEdit}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </IconBtn>
        <IconBtn title="Duplicate" ui={ui} onClick={onDuplicate}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        </IconBtn>
        <IconBtn title="Delete" ui={ui} danger onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
        </IconBtn>
      </div>
    </div>
  )
}

// ── Add/Edit Form ─────────────────────────────────────────────────────────────
function VarForm({ formKey, formValue, formSecret, setFormKey, setFormValue, setFormSecret, editing, ui, existingKeys, onSave, onCancel }: {
  formKey: string; formValue: string; formSecret: boolean
  setFormKey: (v: string) => void; setFormValue: (v: string) => void; setFormSecret: (v: boolean) => void
  editing: EnvVariable | null; ui: any; existingKeys: string[]
  onSave: () => void; onCancel: () => void
}) {
  const [showValue, setShowValue] = useState(!formSecret)
  const key = formKey.trim()
  const isDuplicate = key && existingKeys.some(k => k.toUpperCase() === key.toUpperCase())
  const canSave = key.length > 0 && !isDuplicate && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 380, maxHeight: '85%', boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>
          {editing ? 'Edit Variable' : 'New Variable'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
          onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key *</label>
          <input placeholder="MY_VARIABLE" value={formKey}
            onChange={e => setFormKey(e.target.value.replace(/\s/g, '_'))}
            style={{ width: '100%', padding: '5px 8px', fontSize: 12, fontFamily: 'monospace', background: ui.inputBg, border: `1px solid ${isDuplicate ? ui.danger : ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = isDuplicate ? ui.danger : ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = isDuplicate ? ui.danger : ui.inputBorder)}
            autoFocus spellCheck={false}
          />
          {isDuplicate && <span style={{ fontSize: 10, color: ui.danger }}>A variable with this key already exists</span>}
          {key && !canSave && !isDuplicate && <span style={{ fontSize: 10, color: ui.warning }}>Key must start with a letter or underscore, containing only alphanumerics and underscores</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Value</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input type={formSecret && !showValue ? 'password' : 'text'} placeholder="value" value={formValue}
              onChange={e => setFormValue(e.target.value)}
              style={{ width: '100%', padding: '5px 30px 5px 8px', fontSize: 12, fontFamily: 'monospace', background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
              onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
              spellCheck={false}
            />
            {formSecret && (
              <button type="button" onClick={() => setShowValue(p => !p)}
                style={{ position: 'absolute', right: 6, background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                {showValue ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { setFormSecret(!formSecret); if (formSecret) setShowValue(true) }}
            style={{ width: 28, height: 16, borderRadius: 8, background: formSecret ? ui.accent : ui.bgTertiary, border: `1px solid ${formSecret ? ui.accent : ui.border}`, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s', padding: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 1, left: formSecret ? 14 : 1, transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
          </button>
          <span style={{ fontSize: 11, color: ui.textMuted }}>Mark as secret</span>
          <Tooltip text="Masks the value in the UI. The variable is still passed to terminal sessions." ui={ui}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="2" style={{ cursor: 'default' }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </Tooltip>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={!canSave}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 6, color: canSave ? ui.bg : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}>
          {editing ? 'Save Changes' : 'Add Variable'}
        </button>
      </div>
      </div>
    </div>
  )
}

// ── Import Overlay ────────────────────────────────────────────────────────────
function ImportOverlay({ ui, text, setText, onImport, onCancel }: {
  ui: any; text: string; setText: (v: string) => void; onImport: (text: string) => void; onCancel: () => void
}) {
  const lineCount = text.split('\n').filter(l => { const t = l.trim(); return t && !t.startsWith('#') && t.includes('=') }).length

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: `0 12px 40px ${ui.shadow}`, width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Import Variables</div>
        <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5 }}>
          Paste <span style={{ fontFamily: 'monospace', color: ui.textMuted }}>.env</span> format content below. Lines starting with <span style={{ fontFamily: 'monospace', color: ui.textMuted }}>#</span> are ignored.
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={'API_KEY=sk-abc123\nDATABASE_URL=postgres://...\n# Comments are skipped'}
          rows={8}
          style={{ width: '100%', resize: 'vertical', padding: '8px', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
          onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
          onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          autoFocus spellCheck={false}
        />
        {text.length > 0 && <span style={{ fontSize: 10, color: ui.textDim }}>{lineCount} variable{lineCount !== 1 ? 's' : ''} detected</span>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onImport(text)} disabled={lineCount === 0}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: lineCount > 0 ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 5, color: lineCount > 0 ? ui.bg : ui.textDim, cursor: lineCount > 0 ? 'pointer' : 'not-allowed' }}
            onMouseEnter={e => lineCount > 0 && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}>
            Import {lineCount > 0 ? `(${lineCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Delete ────────────────────────────────────────────────────────────
function ConfirmDelete({ ui, varKey, onConfirm, onCancel }: { ui: any; varKey: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 12px 40px ${ui.shadow}`, maxWidth: 280, width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Delete variable?</div>
        <div style={{ fontSize: 12, color: ui.textMuted, lineHeight: 1.5 }}>Remove <strong style={{ color: ui.text, fontFamily: 'monospace' }}>{varKey}</strong>? This cannot be undone.</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: ui.danger, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ ui, hasSearch, onAdd }: { ui: any; hasSearch: boolean; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ color: ui.textDim, opacity: 0.6 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6" /><path d="M9 16h4" />
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>
        {hasSearch ? 'No matching variables' : 'No Variables'}
      </div>
      {hasSearch ? (
        <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 200 }}>
          Try a different search term.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 220, marginTop: 4 }}>
          <button
            onClick={onAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: ui.accent, border: 'none', borderRadius: 6,
              color: ui.bg, cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Variable
          </button>
          <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5 }}>
            Inject custom variables into new terminal sessions.
          </div>
          <div style={{ width: '100%', height: 1, background: ui.border }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10, color: ui.textDim }}>
              Need to edit OS-level variables?
            </div>
            <button
              onClick={() => window.api.openSystemVariables()}
              style={{
                fontSize: 11, color: ui.accent, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open System Variables
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ children, text, ui }: { children: React.ReactNode; text: string; ui: any }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  function show() {
    setRect(anchorRef.current?.getBoundingClientRect() ?? null)
  }
  function hide() {
    setRect(null)
  }

  const tooltipWidth = 180
  const left = rect ? rect.left + rect.width / 2 - tooltipWidth / 2 : 0
  const top = rect ? rect.bottom + 6 : 0

  return (
    <div
      ref={anchorRef}
      style={{ display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {rect && createPortal(
        <div style={{
          position: 'fixed',
          top,
          left,
          width: tooltipWidth,
          background: ui.bgTertiary,
          border: `1px solid ${ui.border}`,
          borderRadius: 5,
          padding: '5px 8px',
          fontSize: 11,
          color: ui.textMuted,
          whiteSpace: 'normal',
          lineHeight: 1.5,
          pointerEvents: 'none',
          zIndex: 99999,
          boxShadow: `0 4px 12px ${ui.shadow}`,
        }}>
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: `5px solid ${ui.border}`,
          }} />
          {text}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Icon Button ───────────────────────────────────────────────────────────────
function IconBtn({ children, title, ui, onClick, danger }: {
  children: React.ReactNode; title: string; ui: any; onClick: () => void; danger?: boolean
}) {
  const color = danger ? ui.danger : ui.textMuted
  return (
    <button onClick={onClick} title={title}
      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color, cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? `${ui.danger}22` : `${ui.accent}18` }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
      {children}
    </button>
  )
}
