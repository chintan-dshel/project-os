import { useState, useEffect } from 'react'
import { listDocuments, fetchDocument, listGeneratedDocuments, generateDocument, getV2Backlog, listWorkspaceDocs } from '../lib/api.js'
import { renderMd } from '../lib/renderMd.jsx'

function RetroEmptyTemplate({ onOpenChat }) {
  const sections = [
    { label: 'What was delivered',    hint: 'tasks shipped, features completed, goals met' },
    { label: 'What created friction', hint: 'blockers, delays, things that slowed you down' },
    { label: 'What I\'d change',      hint: 'process improvements, different decisions' },
    { label: 'Founder growth read',   hint: 'personal learning from this milestone' },
    { label: 'Patterns detected',     hint: 'recurring themes the agent noticed' },
  ]
  return (
    <div className="retro-empty">
      <div className="retro-empty__notice">
        <div className="retro-empty__notice-body">
          <span className="retro-empty__notice-icon">◫</span>
          <div>
            <div className="retro-empty__notice-title">Retrospective not yet completed</div>
            <div className="retro-empty__notice-sub">Chat with the Retro Agent to answer the three questions — this report populates automatically when you're done.</div>
          </div>
        </div>
        <button className="retro-empty__cta" onClick={onOpenChat}>Open Retro Agent →</button>
      </div>

      <div className="retro-empty__skeleton">
        <div className="retro-empty__meta-row">
          <div className="retro-empty__meta-cell">
            <div className="retro-empty__meta-label">Tasks completed</div>
            <div className="retro-empty__meta-val">— / —</div>
          </div>
          <div className="retro-empty__meta-cell">
            <div className="retro-empty__meta-label">Hours (est. vs actual)</div>
            <div className="retro-empty__meta-val">—h / —h</div>
          </div>
          <div className="retro-empty__meta-cell">
            <div className="retro-empty__meta-label">Date</div>
            <div className="retro-empty__meta-val">—</div>
          </div>
        </div>
        {sections.map(s => (
          <div key={s.label} className="retro-empty__field">
            <div className="retro-empty__field-label">{s.label}</div>
            <div className="retro-empty__field-placeholder">{s.hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const ACL_CFG = {
  everyone: { label: 'Everyone', color: 'var(--text-3)' },
  core:     { label: 'Core',     color: 'var(--blue)' },
  owner:    { label: 'Owner',    color: 'var(--amber)' },
}

const DOC_TYPE_META = {
  charter:        { icon: '📋', label: 'Project Charter',       color: 'var(--blue)' },
  plan:           { icon: '🗂', label: 'Execution Plan',        color: 'var(--purple)' },
  risks:          { icon: '⚑', label: 'Risk Register',         color: 'var(--amber)' },
  decisions:      { icon: '◉', label: 'Decision Log',          color: 'var(--text-2)' },
  retro:          { icon: '◫', label: 'Retrospective Report',  color: 'var(--green)' },
  'milestone-report': { icon: '📊', label: 'Milestone Report', color: 'var(--amber)' },
  'close-report': { icon: '🏁', label: 'Close Report',         color: 'var(--green)' },
}

export default function DocsView({ projectId, project, onOpenChat }) {
  const [tab,           setTab]           = useState('docs')
  const [docs,          setDocs]          = useState([])
  const [generatedDocs, setGeneratedDocs] = useState([])
  const [v2Backlog,     setV2Backlog]     = useState([])
  const [workspaceDocs, setWorkspaceDocs] = useState([])
  const [selected,      setSelected]      = useState(null)
  const [docContent,    setDocContent]    = useState(null)
  const [loadingDocs,   setLoadingDocs]   = useState(true)
  const [loadingDoc,    setLoadingDoc]    = useState(false)
  const [generating,    setGenerating]    = useState(null)
  const [generateError, setGenerateError] = useState(null)

  useEffect(() => {
    Promise.all([
      listDocuments(projectId).catch(() => ({ documents: [] })),
      listGeneratedDocuments(projectId).catch(() => ({ documents: [] })),
      getV2Backlog(projectId).catch(() => ({ items: [] })),
      listWorkspaceDocs(projectId).catch(() => ({ docs: [] })),
    ]).then(([live, gen, v2, ws]) => {
      setDocs(live.documents ?? [])
      setGeneratedDocs(gen.documents ?? [])
      setV2Backlog(v2.items ?? [])
      setWorkspaceDocs(ws.docs ?? [])
    }).finally(() => setLoadingDocs(false))
  }, [projectId])

  async function openDoc(type, label, isGenerated = false) {
    setSelected({ type, label, isGenerated, isEmpty: false })
    setDocContent(null)
    setLoadingDoc(true)
    try {
      if (isGenerated) {
        const gen = generatedDocs.find(d => d.doc_type === type)
        setDocContent(gen?.content ?? '_Report exists but content could not be loaded. Try regenerating._')
      } else {
        const d = await fetchDocument(projectId, type)
        if (!d.content && type === 'retro-report') {
          setSelected(s => ({ ...s, isEmpty: true }))
        } else {
          setDocContent(d.content ?? '_No content available yet._')
        }
      }
    } catch { setDocContent('_Failed to load. Try again._') }
    finally { setLoadingDoc(false) }
  }

  async function handleGenerate(type) {
    setGenerating(type)
    setGenerateError(null)
    try {
      const d = await generateDocument(projectId, type)
      const label = DOC_TYPE_META[type]?.label ?? type
      setGeneratedDocs(prev => [...prev.filter(x => x.doc_type !== type), d.document])
      // Set content directly — don't call openDoc which would read stale generatedDocs state
      setSelected({ type, label, isGenerated: true })
      setDocContent(d.document.content ?? '_Generation returned empty content._')
    } catch (e) {
      setGenerateError(e.message ?? 'Generation failed — check your API budget or try again.')
    } finally {
      setGenerating(null)
    }
  }

  function copyDoc() {
    if (docContent) navigator.clipboard.writeText(docContent)
  }

  const isProjectComplete = project?.stage === 'complete' || project?.stage === 'ship_retro'

  return (
    <div className="docs-view">
      <div className="docs-sidebar">
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 10px 4px', borderBottom: '0.5px solid var(--line)' }}>
          {['docs', 'workspace'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 'var(--r)',
                border: '0.5px solid var(--border)',
                background: tab === t ? 'var(--teal)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-2)',
                cursor: 'pointer', fontWeight: tab === t ? 600 : 400,
                textTransform: 'uppercase', letterSpacing: '.05em',
              }}
            >
              {t === 'docs' ? 'Project Docs' : 'Workspace'}
            </button>
          ))}
        </div>

        {tab === 'workspace' ? (
          <div className="doc__list">
            {loadingDocs
              ? <div className="docs-loading">Loading…</div>
              : workspaceDocs.length === 0
                ? <div className="docs-sidebar__empty">No workspace docs yet.</div>
                : workspaceDocs.map(d => {
                    const acl = ACL_CFG[d.acl] ?? ACL_CFG.everyone
                    return (
                      <button
                        key={d.id}
                        className={`doc__row${selected?.id === d.id ? ' doc__row--active' : ''}`}
                        onClick={() => {
                          setSelected({ id: d.id, type: d.type, label: d.title, isWorkspace: true })
                          setDocContent(d.content ?? '')
                        }}
                      >
                        <div className="doc__row-main">
                          <span className="doc__row-title">{d.title}</span>
                          <span className="doc__acl" style={{ color: acl.color }}>{acl.label}</span>
                        </div>
                        <div className="doc__row-meta">
                          <span className="doc__kind">{d.kind ?? d.type}</span>
                          <span className="doc__row-time">{new Date(d.updated_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    )
                  })
            }
          </div>
        ) : (
          <>
            <div className="docs-sidebar__section">AUTO-ASSEMBLED</div>
        {loadingDocs
          ? <div className="docs-loading">Loading…</div>
          : docs.length === 0
            ? <div className="docs-sidebar__empty">Documents appear as you progress</div>
            : docs.filter(d => d.id !== 'execution-plan').map(d => (
              <button
                key={d.id}
                className={`docs-item${selected?.type === d.id && !selected?.isGenerated ? ' docs-item--active' : ''}`}
                onClick={() => openDoc(d.id, d.label, false)}
              >
                <span className="docs-item__icon">{d.icon}</span>
                <span className="docs-item__label">{d.label}</span>
              </button>
            ))
        }

        <div className="docs-sidebar__section" style={{ marginTop: 16 }}>AI REPORTS</div>
        {generateError && (
          <div className="docs-gen-error">{generateError}</div>
        )}
        {[
          {
            type: 'milestone-report', label: 'Milestone Report',
            available: ['execution', 'milestone_retro', 'ship_retro', 'complete'].includes(project?.stage),
            lockHint: 'Available once execution begins',
          },
          {
            type: 'close-report', label: 'Close Report',
            available: isProjectComplete,
            lockHint: 'Available after Ship Retro',
          },
        ].map(({ type, label, available, lockHint }) => {
          const existing = generatedDocs.find(d => d.doc_type === type)
          const meta     = DOC_TYPE_META[type]
          const isActive = selected?.type === type && selected?.isGenerated
          if (!available) {
            return (
              <div key={type} className="docs-item docs-item--locked">
                <span className="docs-item__icon" style={{ opacity: .4 }}>{meta.icon}</span>
                <span className="docs-item__label" style={{ opacity: .4 }}>{label}</span>
                <span className="docs-item__lock-hint">{lockHint}</span>
              </div>
            )
          }
          return (
            <div key={type} className={`docs-item docs-item--ai${isActive ? ' docs-item--active' : ''}`}>
              {existing
                ? <button className="docs-item__btn" onClick={() => openDoc(type, label, true)}>
                    <span className="docs-item__icon">{meta.icon}</span>
                    <span className="docs-item__label">{label}</span>
                    <span className="docs-item__generated-badge">✓</span>
                  </button>
                : <button className="docs-item__btn docs-item__btn--generate" onClick={() => handleGenerate(type)} disabled={generating === type}>
                    <span className="docs-item__icon">{meta.icon}</span>
                    <span className="docs-item__label">{generating === type ? 'Generating…' : `Generate ${label}`}</span>
                  </button>
              }
            </div>
          )
        })}

        {v2Backlog.length > 0 && (
          <>
            <div className="docs-sidebar__section" style={{ marginTop: 16 }}>V2 BACKLOG</div>
            <div className="docs-v2-list">
              {v2Backlog.map((item, i) => (
                <div key={i} className="docs-v2-item">
                  <span className="docs-v2-item__text">{typeof item === 'string' ? item : item.item ?? item.description ?? JSON.stringify(item)}</span>
                </div>
              ))}
            </div>
          </>
        )}
          </>
        )}
      </div>

      <div className="docs-viewer">
        {!selected ? (
          <div className="view-empty">
            <div className="view-empty__icon">📄</div>
            <div className="view-empty__title">Select a document</div>
            <div className="view-empty__sub">Auto-assembled docs are built from your project data. AI Reports are synthesised by Claude from your retro and execution data.</div>
          </div>
        ) : (
          <div className="docs-doc">
            <div className="docs-doc__header">
              <span className="docs-doc__title">{selected.label}</span>
              {docContent && (
                <button className="docs-doc__copy" onClick={copyDoc} title="Copy markdown">⎘ Copy</button>
              )}
            </div>
            <div className="docs-doc__body">
              {loadingDoc
                ? <div className="docs-loading">Loading…</div>
                : selected?.isEmpty
                  ? <RetroEmptyTemplate onOpenChat={onOpenChat} />
                  : renderMd(docContent)
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
