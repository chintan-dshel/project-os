/**
 * ProjectLoader.jsx — v0.4.1
 *
 * Landing page with:
 *   - All projects list (persisted from DB, not localStorage)
 *   - Project cards showing stage, momentum, progress
 *   - Start new project CTA
 *   - Load by UUID for sharing/bookmarking
 *   - Doc Vault section (upload + browse project documents)
 */

import { useState, useEffect } from 'react'
import { listProjects, createProject } from '../lib/api.js'

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_LABELS = {
  intake:            { label: 'Intake',    color: 'var(--text-3)' },
  planning:          { label: 'Planning',  color: 'var(--blue)' },
  awaiting_approval: { label: 'Approval',  color: 'var(--amber)' },
  execution:         { label: 'Execution', color: 'var(--green)' },
  milestone_retro:   { label: 'Retro',     color: 'var(--purple)' },
  ship_retro:        { label: 'Ship Retro',color: 'var(--purple)' },
  complete:          { label: 'Complete',  color: 'var(--green)' },
}

const STATUS_COLORS = {
  on_track: 'var(--green)',
  at_risk:  'var(--amber)',
  blocked:  'var(--red)',
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen }) {
  const stage   = STAGE_LABELS[project.stage] ?? { label: project.stage, color: 'var(--text-3)' }
  const daysAgo = Math.floor((Date.now() - new Date(project.updated_at)) / 86400000)
  const updated = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`

  return (
    <button className="proj-card" onClick={() => onOpen(project.id)}>
      <div className="proj-card__header">
        <div className="proj-card__title">{project.title}</div>
        <span className="proj-card__stage" style={{ color: stage.color }}>{stage.label}</span>
      </div>

      {project.one_liner && (
        <div className="proj-card__oneliner">{project.one_liner}</div>
      )}

      <div className="proj-card__footer">
        {project.momentum_score != null && (
          <span className="proj-card__metric">
            <span style={{
              color: project.momentum_score >= 60 ? 'var(--green)' : project.momentum_score >= 30 ? 'var(--amber)' : 'var(--red)',
              fontFamily: 'var(--mono)',
              fontSize: '14px',
            }}>
              {project.momentum_score}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: '10px', fontFamily: 'var(--mono)' }}> MOM</span>
          </span>
        )}
        {project.overall_status && project.overall_status !== 'on_track' && (
          <span className="proj-card__status" style={{ color: STATUS_COLORS[project.overall_status] }}>
            {project.overall_status.replace('_', ' ')}
          </span>
        )}
        <span className="proj-card__updated">{updated}</span>
      </div>
    </button>
  )
}

// ── Doc Vault ─────────────────────────────────────────────────────────────────

const DOC_TYPES = {
  'application/pdf':  { icon: '📄', label: 'PDF' },
  'image/png':        { icon: '🖼',  label: 'Image' },
  'image/jpeg':       { icon: '🖼',  label: 'Image' },
  'text/plain':       { icon: '📝',  label: 'Text' },
  'text/markdown':    { icon: '📝',  label: 'Markdown' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: '📘', label: 'Word' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       { icon: '📊', label: 'Excel' },
  'default':          { icon: '📎',  label: 'File' },
}

function DocVault() {
  const [docs, setDocs]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('project-os:docs') ?? '[]') }
    catch { return [] }
  })
  const [dragging, setDragging] = useState(false)

  function saveDocs(updated) {
    setDocs(updated)
    localStorage.setItem('project-os:docs', JSON.stringify(updated))
  }

  function handleFiles(files) {
    const newDocs = Array.from(files).map(f => ({
      id:      `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name:    f.name,
      type:    f.type || 'default',
      size:    f.size,
      added:   new Date().toISOString(),
    }))
    saveDocs([...docs, ...newDocs])
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  function removeDoc(id) {
    saveDocs(docs.filter(d => d.id !== id))
  }

  function fmtSize(bytes) {
    if (bytes < 1024)       return `${bytes}B`
    if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)}KB`
    return `${(bytes/1024/1024).toFixed(1)}MB`
  }

  const cfg = t => DOC_TYPES[t] ?? DOC_TYPES['default']

  return (
    <div className="vault">
      <div className="vault__header">
        <span className="vault__title">Doc Vault</span>
        <span className="vault__sub">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Drop zone */}
      <div
        className={`vault__drop${dragging ? ' vault__drop--active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <span className="vault__drop-icon">📁</span>
        <span className="vault__drop-text">Drop files here</span>
        <label className="vault__browse-btn">
          Browse
          <input type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </label>
      </div>

      {/* Document list */}
      {docs.length > 0 && (
        <div className="vault__list">
          {docs.map(doc => (
            <div key={doc.id} className="vault__doc">
              <span className="vault__doc-icon">{cfg(doc.type).icon}</span>
              <div className="vault__doc-info">
                <span className="vault__doc-name">{doc.name}</span>
                <span className="vault__doc-meta">
                  {cfg(doc.type).label} · {fmtSize(doc.size)} · {new Date(doc.added).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <button className="vault__doc-remove" onClick={() => removeDoc(doc.id)} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <div className="vault__empty">
          PRDs, wireframes, contracts, research — drop anything here
        </div>
      )}
    </div>
  )
}

// ── Main loader ───────────────────────────────────────────────────────────────

export default function ProjectLoader({ onLoad }) {
  const [projects,  setProjects]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const [uuid,      setUuid]      = useState('')
  const [err,       setErr]       = useState(null)

  // Load all projects from DB on mount
  useEffect(() => {
    listProjects()
      .then(data => setProjects(data.projects ?? []))
      .catch(() => setProjects([]))  // graceful — show empty state, not error
      .finally(() => setLoading(false))
  }, [])

  async function startNew() {
    setCreating(true)
    setErr(null)
    try {
      const data = await createProject({ title: 'New Project' })
      onLoad(data.project.id)
    } catch (e) {
      setErr(e.message ?? 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  function loadByUuid() {
    const id = uuid.trim()
    if (!id) return
    onLoad(id)
  }

  return (
    <div className="landing">
      {/* Left column — projects */}
      <div className="landing__left">
        <div className="landing__brand">
          <span className="landing__wordmark">PROJECT OS</span>
          <span className="landing__tagline">AI project management for solo founders</span>
        </div>

        <div className="landing__actions">
          <button className="landing__new-btn" onClick={startNew} disabled={creating}>
            {creating ? 'Creating…' : '+ Start new project'}
          </button>

          <div className="landing__load-row">
            <input
              className="landing__uuid-input"
              placeholder="Paste project UUID…"
              value={uuid}
              onChange={e => setUuid(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && uuid.trim() && loadByUuid()}
              spellCheck={false}
            />
            <button
              className="landing__load-btn"
              onClick={loadByUuid}
              disabled={!uuid.trim()}
            >
              Load →
            </button>
          </div>

          {err && <div className="landing__error">{err}</div>}
        </div>

        {/* Projects list */}
        <div className="landing__projects">
          <div className="landing__section-label">
            {loading ? 'Loading projects…' : projects.length > 0 ? `Your projects (${projects.length})` : 'No projects yet'}
          </div>

          {loading && (
            <div style={{ display: 'flex', gap: 6, padding: '16px 0' }}>
              <span className="app-loading__dot" />
              <span className="app-loading__dot" />
              <span className="app-loading__dot" />
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div className="proj-cards">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} onOpen={onLoad} />
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="landing__empty">
              Start your first project above. It takes about 60 seconds to go from idea to execution plan.
            </div>
          )}
        </div>
      </div>

      {/* Right column — Doc Vault */}
      <div className="landing__right">
        <DocVault />
      </div>
    </div>
  )
}
