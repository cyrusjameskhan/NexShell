import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../hooks'
import { getState, setState } from '../../store'
import { Snippet } from '../../types'

function uid() {
  return `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function SnippetsSection() {
  const { theme } = useStore()
  const ui = theme.ui

  const [snippets, setSnippetsState] = useState<Snippet[]>([])
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editing, setEditing] = useState<Snippet | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    window.api.getSnippets().then(loaded => {
      if (loaded?.length) setSnippetsState(loaded)
    })
  }, [])

  const persist = useCallback((updated: Snippet[]) => {
    setSnippetsState(updated)
    window.api.setSnippets(updated)
  }, [])

  const filtered = snippets.filter(s => {
    const q = search.toLowerCase()
    const matchesSearch = !q || (
      s.name.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q))
    )
    const matchesTags = activeTags.length === 0 || activeTags.every(t => (s.tags ?? []).includes(t))
    return matchesSearch && matchesTags
  })

  function openAdd() {
    setEditing(null)
    setIsAdding(true)
  }

  function openEdit(s: Snippet) {
    setEditing(s)
    setIsAdding(true)
  }

  function saveSnippet(data: { name: string; command: string; description: string; tags: string[] }) {
    const now = Date.now()
    const { tags } = data

    if (editing) {
      persist(snippets.map(s =>
        s.id === editing.id
          ? { ...s, name: data.name, command: data.command, description: data.description, tags, updatedAt: now }
          : s
      ))
    } else {
      persist([...snippets, {
        id: uid(),
        name: data.name,
        command: data.command,
        description: data.description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        createdAt: now,
        updatedAt: now,
      }])
    }
    setIsAdding(false)
    setEditing(null)
  }

  function deleteSnippet(id: string) {
    persist(snippets.filter(s => s.id !== id))
    setConfirmDelete(null)
  }

  function duplicateSnippet(s: Snippet) {
    const now = Date.now()
    persist([...snippets, { ...s, id: uid(), name: `${s.name} (copy)`, createdAt: now, updatedAt: now }])
  }

  function runSnippet(s: Snippet) {
    const { activeSessionId } = getState()
    if (!activeSessionId) return
    setState({ sidePanelOpen: false })
    window.api.writePty(activeSessionId, s.command + '\r')
  }

  function copySnippet(s: Snippet) {
    navigator.clipboard.writeText(s.command).then(() => {
      setCopiedId(s.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const allTags = Array.from(new Set(snippets.flatMap(s => s.tags ?? []))).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: allTags.length > 0 ? 'none' : `1px solid ${ui.border}`, flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search snippets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, fontWeight: 500, background: ui.accent, border: 'none', borderRadius: 5, color: ui.bg, cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <TagFilterBar tags={allTags} activeTags={activeTags} ui={ui} onToggle={tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} onClear={() => setActiveTags([])} />
      )}

      {/* Snippet count */}
      {snippets.length > 0 && (
        <div style={{ padding: '4px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: ui.textDim }}>
            {filtered.length === snippets.length
              ? `${snippets.length} snippet${snippets.length !== 1 ? 's' : ''}`
              : `${filtered.length} of ${snippets.length}`}
          </span>
        </div>
      )}


      {/* Snippet list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState ui={ui} hasSearch={!!search || activeTags.length > 0} onAdd={openAdd} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(s => (
              <SnippetRow
                key={s.id}
                snippet={s}
                ui={ui}
                copied={copiedId === s.id}
                activeTags={activeTags}
                onRun={() => runSnippet(s)}
                onCopy={() => copySnippet(s)}
                onEdit={() => openEdit(s)}
                onDuplicate={() => duplicateSnippet(s)}
                onDelete={() => setConfirmDelete(s.id)}
                onTagClick={tag => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit form modal */}
      {isAdding && (
        <SnippetForm
          editing={editing}
          ui={ui}
          existingNames={snippets.filter(s => s.id !== editing?.id).map(s => s.name)}
          onSave={saveSnippet}
          onCancel={() => { setIsAdding(false); setEditing(null) }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDelete
          ui={ui}
          snippetName={snippets.find(s => s.id === confirmDelete)?.name || 'this snippet'}
          onConfirm={() => deleteSnippet(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// ── Tag Filter Bar ─────────────────────────────────────────────────────────────
function TagFilterBar({ tags, activeTags, ui, onToggle, onClear }: {
  tags: string[]; activeTags: string[]; ui: any
  onToggle: (tag: string) => void; onClear: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px 6px',
      borderBottom: `1px solid ${ui.border}`, flexShrink: 0, flexWrap: 'wrap',
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: ui.textDim, flexShrink: 0 }}>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
      {tags.map(tag => {
        const isActive = activeTags.includes(tag)
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              padding: '2px 7px', fontSize: 10, fontWeight: 500, borderRadius: 3, cursor: 'pointer',
              background: isActive ? ui.accent : `${ui.accent}18`,
              color: isActive ? ui.bg : ui.accent,
              border: `1px solid ${isActive ? ui.accent : 'transparent'}`,
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {tag}
          </button>
        )
      })}
      {activeTags.length > 0 && (
        <button
          onClick={onClear}
          title="Clear tag filters"
          style={{ padding: '2px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer', background: 'transparent', border: `1px solid ${ui.border}`, color: ui.textDim, marginLeft: 2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ui.danger; (e.currentTarget as HTMLButtonElement).style.color = ui.danger }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ui.border; (e.currentTarget as HTMLButtonElement).style.color = ui.textDim }}
        >
          ✕ clear
        </button>
      )}
    </div>
  )
}

// ── Snippet Row ────────────────────────────────────────────────────────────────
function SnippetRow({ snippet, ui, copied, activeTags, onRun, onCopy, onEdit, onDuplicate, onDelete, onTagClick }: {
  snippet: Snippet; ui: any; copied: boolean; activeTags: string[]
  onRun: () => void; onCopy: () => void; onEdit: () => void
  onDuplicate: () => void; onDelete: () => void; onTagClick: (tag: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 7,
        background: hovered ? ui.bgTertiary : 'transparent',
        border: `1px solid ${hovered ? ui.border : 'transparent'}`,
        transition: 'background 0.1s',
        overflow: 'hidden',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px' }}>
        {/* Run button */}
        <button
          onClick={onRun}
          title="Run in active terminal"
          style={{
            width: 24, height: 24, borderRadius: 5, flexShrink: 0,
            background: hovered ? `${ui.accent}22` : 'transparent',
            border: `1px solid ${hovered ? ui.accent + '44' : 'transparent'}`,
            color: ui.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s, color 0.1s, border-color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${ui.accent}40`; e.currentTarget.style.borderColor = `${ui.accent}88` }}
          onMouseLeave={e => { e.currentTarget.style.background = hovered ? `${ui.accent}22` : 'transparent'; e.currentTarget.style.borderColor = hovered ? `${ui.accent}44` : 'transparent' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>

        {/* Name + command */}
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setExpanded(p => !p)}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: ui.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {snippet.name}
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace', color: ui.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {snippet.command}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
          <IconBtn title={copied ? 'Copied!' : 'Copy command'} ui={ui} onClick={onCopy}>
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
          </IconBtn>
          <IconBtn title="Edit" ui={ui} onClick={onEdit}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </IconBtn>
          <IconBtn title="Duplicate" ui={ui} onClick={onDuplicate}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </IconBtn>
          <IconBtn title="Delete" ui={ui} danger onClick={onDelete}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
          </IconBtn>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {snippet.description && (
            <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5 }}>{snippet.description}</div>
          )}
          <div style={{
            padding: '6px 8px', borderRadius: 5,
            background: ui.inputBg, border: `1px solid ${ui.inputBorder}`,
            fontFamily: 'monospace', fontSize: 11, color: ui.text,
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6,
          }}>
            {snippet.command}
          </div>
          {(snippet.tags ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(snippet.tags ?? []).map(tag => {
                const isActive = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => onTagClick(tag)}
                    title={isActive ? 'Remove filter' : 'Filter by tag'}
                    style={{
                      padding: '1px 6px', fontSize: 10, fontWeight: 500, borderRadius: 3, cursor: 'pointer',
                      background: isActive ? ui.accent : `${ui.accent}18`,
                      color: isActive ? ui.bg : ui.accent,
                      border: `1px solid ${isActive ? ui.accent : 'transparent'}`,
                      transition: 'background 0.12s, color 0.12s',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 10, color: ui.textDim, opacity: 0.6 }}>
            Updated {new Date(snippet.updatedAt).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Snippet Form ───────────────────────────────────────────────────────────────
function SnippetForm({ editing, ui, existingNames, onSave, onCancel }: {
  editing: Snippet | null; ui: any; existingNames: string[]
  onSave: (data: { name: string; command: string; description: string; tags: string[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [command, setCommand] = useState(editing?.command ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmedName = name.trim()
  const trimmedCmd = command.trim()
  const isDuplicateName = trimmedName && existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase())
  const canSave = trimmedName.length > 0 && trimmedCmd.length > 0 && !isDuplicateName

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSave) {
      onSave({ name: trimmedName, command: trimmedCmd, description, tags })
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}
      onKeyDown={handleKeyDown} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 420, maxHeight: '85%', boxShadow: `0 20px 60px rgba(0,0,0,0.4)`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>
          {editing ? 'Edit Snippet' : 'New Snippet'}
        </span>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: ui.textDim, cursor: 'pointer', padding: 2, borderRadius: 3 }}
          onMouseEnter={e => (e.currentTarget.style.color = ui.text)}
          onMouseLeave={e => (e.currentTarget.style.color = ui.textDim)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>

      {/* Scrollable fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
          <input
            placeholder="My Snippet"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '5px 8px', fontSize: 12,
              background: ui.inputBg, border: `1px solid ${isDuplicateName ? ui.danger : ui.inputBorder}`,
              borderRadius: 5, color: ui.text, outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = isDuplicateName ? ui.danger : ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = isDuplicateName ? ui.danger : ui.inputBorder)}
          />
          {isDuplicateName && <span style={{ fontSize: 10, color: ui.danger }}>A snippet with this name already exists</span>}
        </div>

        {/* Command */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Command *</label>
          <textarea
            ref={textareaRef}
            placeholder="echo Hello World"
            value={command}
            onChange={e => setCommand(e.target.value)}
            rows={4}
            spellCheck={false}
            style={{
              width: '100%', resize: 'vertical', padding: '5px 8px', fontSize: 11,
              fontFamily: 'monospace', lineHeight: 1.6,
              background: ui.inputBg, border: `1px solid ${ui.inputBorder}`,
              borderRadius: 5, color: ui.text, outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>

        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
          <input
            placeholder="What does this snippet do?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{
              width: '100%', padding: '5px 8px', fontSize: 12,
              background: ui.inputBg, border: `1px solid ${ui.inputBorder}`,
              borderRadius: 5, color: ui.text, outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags</label>
          <TagInput tags={tags} onChange={setTags} ui={ui} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', padding: '12px 16px', borderTop: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: ui.textDim, marginRight: 'auto' }}>Ctrl+Enter to save</span>
        <button onClick={onCancel}
          style={{ padding: '6px 14px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 6, color: ui.textMuted, cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={() => canSave && onSave({ name: trimmedName, command: trimmedCmd, description, tags })}
          disabled={!canSave}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: canSave ? ui.accent : ui.bgTertiary, border: 'none', borderRadius: 6, color: canSave ? ui.bg : ui.textDim, cursor: canSave ? 'pointer' : 'not-allowed' }}
          onMouseEnter={e => canSave && ((e.currentTarget as HTMLButtonElement).style.opacity = '0.85')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}>
          {editing ? 'Save Changes' : 'Add Snippet'}
        </button>
      </div>
      </div>
    </div>
  )
}

// ── Confirm Delete ─────────────────────────────────────────────────────────────
function ConfirmDelete({ ui, snippetName, onConfirm, onCancel }: {
  ui: any; snippetName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: ui.bgSecondary, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 12px 40px ${ui.shadow}`, maxWidth: 280, width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ui.text }}>Delete snippet?</div>
        <div style={{ fontSize: 12, color: ui.textMuted, lineHeight: 1.5 }}>
          Remove <strong style={{ color: ui.text }}>{snippetName}</strong>? This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '5px 12px', fontSize: 12, background: ui.bgTertiary, border: `1px solid ${ui.border}`, borderRadius: 5, color: ui.textMuted, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, background: ui.danger, border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ ui, hasSearch, onAdd }: { ui: any; hasSearch: boolean; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ color: ui.textDim, opacity: 0.6 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: ui.textMuted }}>
        {hasSearch ? 'No matching snippets' : 'No Snippets'}
      </div>
      {hasSearch ? (
        <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5, maxWidth: 200 }}>
          Try a different search term or tag.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 220, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: ui.textDim, lineHeight: 1.5 }}>
            Save reusable shell commands for one-click execution in any terminal session.
          </div>
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
            Create your first snippet
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tag chip input ────────────────────────────────────────────────────────────
function TagInput({ tags, onChange, ui }: { tags: string[]; onChange: (tags: string[]) => void; ui: any }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const parts = raw.split(',').map(t => t.trim()).filter(Boolean)
    if (parts.length === 0) return
    onChange(Array.from(new Set([...tags, ...parts])))
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
        padding: '4px 6px', minHeight: 32,
        background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5,
        cursor: 'text',
      }}
    >
      {tags.map(tag => (
        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px 1px 7px', borderRadius: 3, background: `${ui.accent}22`, color: ui.accent, fontSize: 10, fontWeight: 500 }}>
          {tag}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); removeTag(tag) }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: ui.accent, padding: 0, opacity: 0.7, lineHeight: 1 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? 'Add tags (Enter or comma)...' : ''}
        style={{ flex: 1, minWidth: 80, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: ui.text, padding: '1px 2px' }}
      />
    </div>
  )
}

// ── Icon Button ────────────────────────────────────────────────────────────────
function IconBtn({ children, title, ui, onClick, danger }: {
  children: React.ReactNode; title: string; ui: any; onClick: () => void; danger?: boolean
}) {
  const color = danger ? ui.danger : ui.textMuted
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 4, color, cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? `${ui.danger}22` : `${ui.accent}18` }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
