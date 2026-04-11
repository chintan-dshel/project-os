/**
 * KnowledgeView — Organisation Knowledge Hub
 *
 * Displays all accumulated learnings from retros, decisions, and manual entries.
 * Searchable and filterable. Lets founders add new entries manually.
 */

import { useState, useEffect, useCallback } from 'react'
import { listKnowledge, createKnowledgeEntry } from '../lib/api.js'

const TYPE_META = {
  lesson_learned:  { label: 'Lesson Learned', color: 'var(--green)',  bg: 'var(--green-bg, rgba(52,211,153,.1))'  },
  friction_point:  { label: 'Friction Point',  color: 'var(--amber)',  bg: 'var(--amber-bg, rgba(251,191,36,.1))'  },
  decision:        { label: 'Decision',         color: 'var(--blue)',   bg: 'var(--blue-bg,  rgba(99,179,237,.1))'  },
  risk_insight:    { label: 'Risk Insight',     color: 'var(--red)',    bg: 'var(--red-bg,   rgba(252,129,129,.1))' },
  domain_knowledge:{ label: 'Knowledge',        color: 'var(--purple)', bg: 'var(--purple-bg,rgba(167,139,250,.1))' },
}

const FILTERS = [
  { id: null,              label: 'All' },
  { id: 'lesson_learned',  label: 'Lessons' },
  { id: 'friction_point',  label: 'Friction' },
  { id: 'decision',        label: 'Decisions' },
  { id: 'risk_insight',    label: 'Risk Insights' },
  { id: 'domain_knowledge',label: 'Knowledge' },
]

function TypeBadge({ type }) {
  const meta = TYPE_META[type] ?? TYPE_META.domain_knowledge
  return (
    <span className="kh-badge" style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  )
}

function EntryCard({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const isLong = entry.content.length > 200

  return (
    <div className="kh-card" onClick={() => isLong && setExpanded(e => !e)}>
      <div className="kh-card__header">
        <TypeBadge type={entry.type} />
        {entry.project_name && (
          <span className="kh-card__project">{entry.project_name}</span>
        )}
        <span className="kh-card__date">{date}</span>
      </div>
      <div className="kh-card__title">{entry.title}</div>
      <div className={`kh-card__content${expanded ? ' kh-card__content--expanded' : ''}`}>
        {entry.content}
      </div>
      {isLong && (
        <button className="kh-card__toggle" onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}>
          {expanded ? 'Show less ↑' : 'Show more ↓'}
        </button>
      )}
      {entry.tags?.length > 0 && (
        <div className="kh-card__tags">
          {entry.tags.map(t => <span key={t} className="kh-card__tag">{t}</span>)}
        </div>
      )}
    </div>
  )
}

function AddEntryModal({ onClose, onSave }) {
  const [type, setType]       = useState('domain_knowledge')
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ type, title: title.trim(), content: content.trim() })
      onClose()
    } catch (e) {
      setError(e.message ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box kh-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-box__header">
          <div className="modal-box__title">Add Knowledge Entry</div>
          <button className="modal-box__close" onClick={onClose}>✕</button>
        </div>

        <div className="kh-modal__field">
          <label className="kh-modal__label">Type</label>
          <div className="kh-modal__type-row">
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button
                key={key}
                className={`kh-modal__type-btn${type === key ? ' kh-modal__type-btn--active' : ''}`}
                style={type === key ? { color: meta.color, borderColor: meta.color, background: meta.bg } : {}}
                onClick={() => setType(key)}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kh-modal__field">
          <label className="kh-modal__label">Title</label>
          <input
            className="kh-modal__input"
            placeholder="One-line summary of what was learned"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="kh-modal__field">
          <label className="kh-modal__label">Content</label>
          <textarea
            className="kh-modal__textarea"
            placeholder="Describe the lesson, decision, or insight in detail…"
            rows={5}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>

        {error && <div className="kh-modal__error">{error}</div>}

        <div className="kh-modal__actions">
          <button className="kh-modal__cancel" onClick={onClose}>Cancel</button>
          <button className="kh-modal__save" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KnowledgeView({ project }) {
  const [entries,     setEntries]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeType,  setActiveType]  = useState(null)
  const [showModal,   setShowModal]   = useState(false)
  const [debouncedQ,  setDebouncedQ]  = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (debouncedQ)  params.q          = debouncedQ
      if (activeType)  params.type       = activeType
      if (project?.id) params.project_id = project.id
      const data = await listKnowledge(params)
      setEntries(data.entries ?? [])
    } catch (e) {
      setError(e.message ?? 'Failed to load knowledge entries.')
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, activeType, project?.id])

  useEffect(() => { loadEntries() }, [loadEntries])

  async function handleSave(payload) {
    await createKnowledgeEntry({
      ...payload,
      project_id:   project?.id   ?? null,
      project_name: project?.title ?? null,
    })
    await loadEntries()
  }

  const grouped = entries.reduce((acc, e) => {
    const key = e.type
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})

  return (
    <div className="kh-view">
      {/* Header */}
      <div className="kh-header">
        <div className="kh-header__left">
          <div className="kh-header__title">Knowledge Hub</div>
          <div className="kh-header__sub">
            Lessons learned, decisions, and insights accumulated across all projects.
            Agents use this to plan and execute smarter.
          </div>
        </div>
        <button className="kh-header__add-btn" onClick={() => setShowModal(true)}>
          + Add entry
        </button>
      </div>

      {/* Search + filters */}
      <div className="kh-toolbar">
        <input
          className="kh-search"
          type="text"
          placeholder="Search knowledge…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <div className="kh-filters">
          {FILTERS.map(f => (
            <button
              key={f.id ?? 'all'}
              className={`kh-filter${activeType === f.id ? ' kh-filter--active' : ''}`}
              onClick={() => setActiveType(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="kh-empty">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      )}

      {!loading && error && (
        <div className="kh-empty kh-empty--error">{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="kh-empty">
          <div className="kh-empty__icon">◎</div>
          <div className="kh-empty__title">
            {debouncedQ || activeType ? 'No entries match your search.' : 'No knowledge entries yet.'}
          </div>
          <div className="kh-empty__sub">
            {debouncedQ || activeType
              ? 'Try a different search term or filter.'
              : 'Entries are created automatically when retros complete and decisions are logged. You can also add entries manually.'}
          </div>
          {!debouncedQ && !activeType && (
            <button className="kh-empty__btn" onClick={() => setShowModal(true)}>Add the first entry →</button>
          )}
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="kh-results">
          {/* When searching show flat list ordered by relevance */}
          {debouncedQ || activeType ? (
            <div className="kh-grid">
              {entries.map(e => <EntryCard key={e.id} entry={e} />)}
            </div>
          ) : (
            /* Grouped by type when browsing */
            Object.entries(TYPE_META).map(([typeKey]) => {
              const group = grouped[typeKey]
              if (!group?.length) return null
              return (
                <div key={typeKey} className="kh-group">
                  <div className="kh-group__label">
                    <TypeBadge type={typeKey} />
                    <span className="kh-group__count">{group.length}</span>
                  </div>
                  <div className="kh-grid">
                    {group.map(e => <EntryCard key={e.id} entry={e} />)}
                  </div>
                </div>
              )
            })
          )}
          <div className="kh-count">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</div>
        </div>
      )}

      {showModal && (
        <AddEntryModal onClose={() => setShowModal(false)} onSave={handleSave} />
      )}
    </div>
  )
}
