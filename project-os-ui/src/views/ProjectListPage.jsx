import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjectsAll, createProject, archiveProject, unarchiveProject } from '../lib/api.js'
import ThemeToggle from '../components/ThemeToggle.jsx'

const STAGE_ORDER = ['intake', 'planning', 'awaiting_approval', 'execution', 'milestone_retro', 'ship_retro', 'complete']
const STAGE_LABEL = {
  intake: 'Intake', planning: 'Planning', awaiting_approval: 'Approval',
  execution: 'Execution', milestone_retro: 'Retro', ship_retro: 'Ship Retro', complete: 'Complete',
}
const STAGE_COLOR = {
  intake: 'var(--blue)', planning: 'var(--purple)', awaiting_approval: 'var(--amber)',
  execution: 'var(--green)', milestone_retro: 'var(--amber)', ship_retro: 'var(--amber)', complete: 'var(--text-3)',
}

function stageProgress(stage) {
  const idx = STAGE_ORDER.indexOf(stage)
  return idx < 0 ? 0 : Math.round((idx / (STAGE_ORDER.length - 1)) * 100)
}

function ProjectCard({ project, onClick }) {
  const stage     = project.stage ?? 'intake'
  const color     = STAGE_COLOR[stage] ?? 'var(--text-3)'
  const label     = STAGE_LABEL[stage] ?? stage
  const pct       = stageProgress(stage)
  const daysAgo   = project.updated_at
    ? Math.floor((Date.now() - new Date(project.updated_at)) / 86400000)
    : null
  const timeLabel = daysAgo === null ? '' : daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`

  return (
    <button className="project-card" onClick={onClick}>
      <div className="project-card__header">
        <div className="project-card__title">{project.title}</div>
        <span className="project-card__stage-badge" style={{ color, background: `${color}18` }}>{label}</span>
      </div>
      {project.one_liner && <div className="project-card__oneliner">{project.one_liner}</div>}
      <div className="project-card__footer">
        <div className="project-card__progress">
          <div className="project-card__progress-bar">
            <div className="project-card__progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
        <div className="project-card__meta">
          {project.momentum_score != null && (
            <span className="project-card__momentum" style={{
              color: project.momentum_score >= 60 ? 'var(--green)' : project.momentum_score >= 30 ? 'var(--amber)' : 'var(--red)'
            }}>↑ {project.momentum_score}</span>
          )}
          {timeLabel && <span className="project-card__time">{timeLabel}</span>}
        </div>
      </div>
    </button>
  )
}

function NewProjectModal({ onClose, onCreate }) {
  const [title,   setTitle]   = useState('')
  const [oneLiner,setOneLiner]= useState('')
  const [creating,setCreating]= useState(false)
  const [err,     setErr]     = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true); setErr(null)
    try {
      const data = await createProject({ title: title.trim(), one_liner: oneLiner.trim() || undefined })
      onCreate(data.project.id)
    } catch (e) { setErr(e.message) } finally { setCreating(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">New project</div>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="modal__body">
          <label className="modal__label">Project name</label>
          <input
            className="modal__input"
            placeholder="e.g. SaaS Analytics Dashboard"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <label className="modal__label" style={{ marginTop: 12 }}>One-liner (optional)</label>
          <input
            className="modal__input"
            placeholder="e.g. Real-time analytics for indie SaaS founders"
            value={oneLiner}
            onChange={e => setOneLiner(e.target.value)}
          />
          {err && <div className="modal__error">{err}</div>}
          <div className="modal__footer">
            <button type="button" className="modal__cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="modal__submit" disabled={!title.trim() || creating}>
              {creating ? 'Creating…' : 'Create project →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProjectListPage() {
  const navigate = useNavigate()
  const [projects,    setProjects]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showNew,     setShowNew]     = useState(false)
  const [showArchived,setShowArchived]= useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await listProjectsAll(true)   // include archived
      setProjects(d.projects ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function handleCreate(id) {
    navigate(`/projects/${id}`)
  }

  const active   = projects.filter(p => !p.is_archived)
  const archived = projects.filter(p => p.is_archived)

  return (
    <div className="project-list-page">
      <header className="project-list-header">
        <div className="project-list-header__logo">Project OS</div>
        <div className="project-list-header__actions">
          <ThemeToggle />
          <button className="project-list-header__new-btn" onClick={() => setShowNew(true)}>+ New project</button>
        </div>
      </header>

      <main className="project-list-main">
        {loading ? (
          <div className="loading-screen">
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          </div>
        ) : active.length === 0 ? (
          <div className="project-list-empty">
            <div className="project-list-empty__icon">⬡</div>
            <div className="project-list-empty__title">No projects yet</div>
            <div className="project-list-empty__sub">Create your first project to get started. The Intake Agent will guide you through defining your brief.</div>
            <button className="project-list-empty__btn" onClick={() => setShowNew(true)}>Create your first project →</button>
          </div>
        ) : (
          <>
            <div className="project-list-section-label">Active projects</div>
            <div className="project-grid">
              {active.map(p => (
                <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
              ))}
            </div>
          </>
        )}

        {archived.length > 0 && (
          <div className="project-list-archived">
            <button className="project-list-archived__toggle" onClick={() => setShowArchived(s => !s)}>
              {showArchived ? '▾' : '▸'} Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="project-grid project-grid--archived">
                {archived.map(p => (
                  <div key={p.id} className="project-card-wrap">
                    <ProjectCard project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    <button
                      className="project-card__unarchive"
                      title="Restore project"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await unarchiveProject(p.id)
                        load()
                      }}
                    >↩ Restore</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  )
}
