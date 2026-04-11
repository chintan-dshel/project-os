/**
 * WorkspaceView — Project Workspace
 *
 * Master-detail layout:
 *   Left:  filter + doc list (scrollable)
 *   Right: doc detail — editable for user docs, read-only for agent outputs,
 *          with "→ Save to Knowledge Hub" action on all docs
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  listWorkspaceDocs, createWorkspaceDoc,
  updateWorkspaceDoc, deleteWorkspaceDoc, promoteToKnowledge,
} from '../lib/api.js'

const TYPE_META = {
  note:         { label: 'Note',         icon: '◻', color: 'var(--text-2)' },
  research:     { label: 'Research',     icon: '◎', color: 'var(--blue)'   },
  spec:         { label: 'Spec',         icon: '◐', color: 'var(--purple)' },
  code:         { label: 'Code',         icon: '⟨⟩', color: 'var(--green)' },
  report:       { label: 'Report',       icon: '▦', color: 'var(--amber)'  },
  agent_output: { label: 'Agent Output', icon: '★', color: 'var(--blue)'   },
  reference:    { label: 'Reference',    icon: '◈', color: 'var(--text-3)' },
}

const FILTERS = [
  { id: null,          label: 'All' },
  { id: 'note',        label: 'Notes' },
  { id: 'research',    label: 'Research' },
  { id: 'spec',        label: 'Specs' },
  { id: 'code',        label: 'Code' },
  { id: 'report',      label: 'Reports' },
  { id: 'agent_output',label: 'Agent' },
  { id: 'reference',   label: 'Reference' },
]

function TypeBadge({ type }) {
  const meta = TYPE_META[type] ?? TYPE_META.note
  return (
    <span className="ws-type-badge" style={{ color: meta.color }}>
      {meta.icon} {meta.label}
    </span>
  )
}

function DocListItem({ doc, active, onClick }) {
  const date = new Date(doc.updated_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short',
  })
  const preview = doc.content?.slice(0, 80).replace(/\n/g, ' ') ?? ''

  return (
    <button
      className={`ws-doc-item${active ? ' ws-doc-item--active' : ''}`}
      onClick={onClick}
    >
      <div className="ws-doc-item__header">
        <TypeBadge type={doc.type} />
        <span className="ws-doc-item__date">{date}</span>
      </div>
      <div className="ws-doc-item__title">{doc.title}</div>
      {doc.task_title && (
        <div className="ws-doc-item__task">↳ {doc.task_title}</div>
      )}
      {preview && (
        <div className="ws-doc-item__preview">{preview}{doc.content?.length > 80 ? '…' : ''}</div>
      )}
    </button>
  )
}

function DocDetail({ doc, onUpdate, onDelete, onPromote }) {
  const [title,     setTitle]     = useState(doc.title)
  const [content,   setContent]   = useState(doc.content)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [promoted,  setPromoted]  = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const saveTimer = useRef(null)

  // Reset when doc changes
  useEffect(() => {
    setTitle(doc.title)
    setContent(doc.content)
    setSaved(false)
    setPromoted(false)
    setDelConfirm(false)
  }, [doc.id])

  const isAgentDoc = doc.created_by === 'agent'

  // Auto-save for user docs (debounced)
  useEffect(() => {
    if (isAgentDoc) return
    if (title === doc.title && content === doc.content) return

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await onUpdate(doc.id, { title, content })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } finally {
        setSaving(false)
      }
    }, 1200)

    return () => clearTimeout(saveTimer.current)
  }, [title, content])

  async function handlePromote() {
    setPromoting(true)
    try {
      await onPromote(doc.id)
      setPromoted(true)
    } finally {
      setPromoting(false)
    }
  }

  const date = new Date(doc.created_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="ws-detail">
      <div className="ws-detail__header">
        {isAgentDoc ? (
          <div className="ws-detail__title">{title}</div>
        ) : (
          <input
            className="ws-detail__title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Document title"
          />
        )}
        <div className="ws-detail__meta">
          <TypeBadge type={doc.type} />
          {doc.agent_slug && (
            <span className="ws-detail__agent">by {doc.agent_slug}</span>
          )}
          {doc.task_title && (
            <span className="ws-detail__task-link">↳ {doc.task_title}</span>
          )}
          <span className="ws-detail__date">{date}</span>
        </div>
      </div>

      {isAgentDoc ? (
        <pre className="ws-detail__content ws-detail__content--agent">{content}</pre>
      ) : (
        <textarea
          className="ws-detail__content ws-detail__content--editable"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Start writing…"
        />
      )}

      <div className="ws-detail__footer">
        <div className="ws-detail__save-status">
          {saving && <span className="ws-save-indicator">Saving…</span>}
          {saved  && <span className="ws-save-indicator ws-save-indicator--done">Saved ✓</span>}
        </div>
        <div className="ws-detail__actions">
          {promoted ? (
            <span className="ws-detail__promoted">✓ In Knowledge Hub</span>
          ) : (
            <button
              className="ws-detail__promote-btn"
              disabled={promoting}
              onClick={handlePromote}
            >
              {promoting ? 'Saving…' : '◈ Save to Knowledge Hub'}
            </button>
          )}
          {!isAgentDoc && (
            delConfirm ? (
              <span className="ws-detail__del-confirm">
                Sure?&nbsp;
                <button className="ws-detail__del-yes" onClick={() => onDelete(doc.id)}>Delete</button>
                &nbsp;/&nbsp;
                <button className="ws-detail__del-no" onClick={() => setDelConfirm(false)}>Cancel</button>
              </span>
            ) : (
              <button className="ws-detail__delete-btn" onClick={() => setDelConfirm(true)}>
                Delete
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function NewDocModal({ onClose, onSave }) {
  const [type,    setType]    = useState('note')
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    setSaving(true); setError(null)
    try {
      await onSave({ type, title: title.trim(), content: content.trim() })
      onClose()
    } catch (e) {
      setError(e.message ?? 'Failed to create doc.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box ws-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-box__header">
          <div className="modal-box__title">New document</div>
          <button className="modal-box__close" onClick={onClose}>✕</button>
        </div>

        <div className="ws-modal__field">
          <label className="ws-modal__label">Type</label>
          <div className="ws-modal__type-row">
            {Object.entries(TYPE_META).filter(([k]) => k !== 'agent_output').map(([key, meta]) => (
              <button
                key={key}
                className={`ws-modal__type-btn${type === key ? ' ws-modal__type-btn--active' : ''}`}
                onClick={() => setType(key)}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ws-modal__field">
          <label className="ws-modal__label">Title</label>
          <input
            className="ws-modal__input"
            placeholder="Document title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="ws-modal__field">
          <label className="ws-modal__label">Content (optional — you can edit after)</label>
          <textarea
            className="ws-modal__textarea"
            placeholder="Start writing, or leave blank and fill in later…"
            rows={5}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        {error && <div className="ws-modal__error">{error}</div>}

        <div className="ws-modal__actions">
          <button className="ws-modal__cancel" onClick={onClose}>Cancel</button>
          <button className="ws-modal__save" disabled={saving} onClick={handleSave}>
            {saving ? 'Creating…' : 'Create document'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function WorkspaceView({ project }) {
  const [docs,       setDocs]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showModal,  setShowModal]  = useState(false)

  const loadDocs = useCallback(async () => {
    if (!project?.id) return
    setLoading(true); setError(null)
    try {
      const params = {}
      if (activeType) params.type = activeType
      const data = await listWorkspaceDocs(project.id, params)
      setDocs(data.docs ?? [])
    } catch (e) {
      setError(e.message ?? 'Failed to load workspace.')
    } finally {
      setLoading(false)
    }
  }, [project?.id, activeType])

  useEffect(() => { loadDocs() }, [loadDocs])

  // Auto-select first doc
  useEffect(() => {
    if (docs.length > 0 && !selectedId) setSelectedId(docs[0].id)
    if (docs.length === 0) setSelectedId(null)
  }, [docs])

  const selectedDoc = docs.find(d => d.id === selectedId)

  async function handleCreate(payload) {
    const data = await createWorkspaceDoc(project.id, payload)
    await loadDocs()
    setSelectedId(data.doc.id)
  }

  async function handleUpdate(docId, updates) {
    const data = await updateWorkspaceDoc(project.id, docId, updates)
    setDocs(prev => prev.map(d => d.id === docId ? data.doc : d))
  }

  async function handleDelete(docId) {
    await deleteWorkspaceDoc(project.id, docId)
    setDocs(prev => {
      const next = prev.filter(d => d.id !== docId)
      setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  async function handlePromote(docId) {
    await promoteToKnowledge(project.id, docId)
  }

  const byType = docs.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc }, {})

  return (
    <div className="ws-view">
      {/* Header */}
      <div className="ws-header">
        <div className="ws-header__left">
          <div className="ws-header__title">Workspace</div>
          <div className="ws-header__sub">Your notes, specs, and agent outputs — all in one place.</div>
        </div>
        <button className="ws-header__new-btn" onClick={() => setShowModal(true)}>+ New doc</button>
      </div>

      {/* Type filters */}
      <div className="ws-filters">
        {FILTERS.map(f => (
          <button
            key={f.id ?? 'all'}
            className={`ws-filter${activeType === f.id ? ' ws-filter--active' : ''}`}
            onClick={() => { setActiveType(f.id); setSelectedId(null) }}
          >
            {f.label}
            {f.id && byType[f.id] > 0 && (
              <span className="ws-filter__count">{byType[f.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="ws-body">
        {/* Left: doc list */}
        <div className="ws-list">
          {loading && (
            <div className="ws-list__empty">
              <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
            </div>
          )}
          {!loading && error && (
            <div className="ws-list__empty ws-list__empty--error">{error}</div>
          )}
          {!loading && !error && docs.length === 0 && (
            <div className="ws-list__empty">
              <div className="ws-list__empty-icon">{activeType ? TYPE_META[activeType]?.icon ?? '◻' : '◻'}</div>
              <div className="ws-list__empty-title">
                {activeType ? `No ${TYPE_META[activeType]?.label ?? activeType} docs yet` : 'Workspace is empty'}
              </div>
              <div className="ws-list__empty-sub">
                {activeType
                  ? 'Switch to All or create a new document.'
                  : 'Create a note, spec, or reference doc. Agent outputs appear here automatically when agents run.'}
              </div>
              <button className="ws-list__empty-btn" onClick={() => setShowModal(true)}>+ New doc</button>
            </div>
          )}
          {!loading && docs.map(doc => (
            <DocListItem
              key={doc.id}
              doc={doc}
              active={doc.id === selectedId}
              onClick={() => setSelectedId(doc.id)}
            />
          ))}
        </div>

        {/* Right: detail panel */}
        <div className="ws-detail-panel">
          {selectedDoc ? (
            <DocDetail
              key={selectedDoc.id}
              doc={selectedDoc}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onPromote={handlePromote}
            />
          ) : (
            <div className="ws-detail-empty">
              <div className="ws-detail-empty__icon">◻</div>
              <div className="ws-detail-empty__text">Select a document to view or edit it</div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewDocModal onClose={() => setShowModal(false)} onSave={handleCreate} />
      )}
    </div>
  )
}
