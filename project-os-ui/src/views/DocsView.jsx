import { useState, useEffect } from 'react'
import { listDocuments, fetchDocument, listGeneratedDocuments, generateDocument, getV2Backlog } from '../lib/api.js'

function renderMd(md) {
  if (!md) return null
  return md.split('\n').map((line, i) => {
    if (line.startsWith('# '))   return <h1  key={i} className="doc-h1">{line.slice(2)}</h1>
    if (line.startsWith('## '))  return <h2  key={i} className="doc-h2">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3  key={i} className="doc-h3">{line.slice(4)}</h3>
    if (line.startsWith('> '))   return <blockquote key={i} className="doc-quote">{line.slice(2)}</blockquote>
    if (line.startsWith('---'))  return <hr  key={i} className="doc-hr" />
    if (line.startsWith('- '))   return <li  key={i} className="doc-li">{line.slice(2)}</li>
    if (line.startsWith('| '))   return <div key={i} className="doc-table-row">{line}</div>
    if (line.trim() === '')      return <div key={i} style={{ height: '8px' }} />
    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    return <p key={i} className="doc-p" dangerouslySetInnerHTML={{ __html: boldLine }} />
  })
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

export default function DocsView({ projectId, project }) {
  const [docs,          setDocs]          = useState([])
  const [generatedDocs, setGeneratedDocs] = useState([])
  const [v2Backlog,     setV2Backlog]     = useState([])
  const [selected,      setSelected]      = useState(null)
  const [docContent,    setDocContent]    = useState(null)
  const [loadingDocs,   setLoadingDocs]   = useState(true)
  const [loadingDoc,    setLoadingDoc]    = useState(false)
  const [generating,    setGenerating]    = useState(null)

  useEffect(() => {
    Promise.all([
      listDocuments(projectId).catch(() => ({ documents: [] })),
      listGeneratedDocuments(projectId).catch(() => ({ documents: [] })),
      getV2Backlog(projectId).catch(() => ({ items: [] })),
    ]).then(([live, gen, v2]) => {
      setDocs(live.documents ?? [])
      setGeneratedDocs(gen.documents ?? [])
      setV2Backlog(v2.items ?? [])
    }).finally(() => setLoadingDocs(false))
  }, [projectId])

  async function openDoc(type, label, isGenerated = false) {
    setSelected({ type, label, isGenerated })
    setDocContent(null)
    setLoadingDoc(true)
    try {
      if (isGenerated) {
        const gen = generatedDocs.find(d => d.doc_type === type)
        setDocContent(gen?.content ?? '_No content available._')
      } else {
        const d = await fetchDocument(projectId, type)
        setDocContent(d.content ?? '_No content available yet._')
      }
    } catch { setDocContent('_Failed to load. Try again._') }
    finally { setLoadingDoc(false) }
  }

  async function handleGenerate(type) {
    setGenerating(type)
    try {
      const d = await generateDocument(projectId, type)
      setGeneratedDocs(prev => {
        const filtered = prev.filter(x => x.doc_type !== type)
        return [...filtered, d.document]
      })
      openDoc(type, DOC_TYPE_META[type]?.label ?? type, true)
    } catch (e) { console.error(e) } finally { setGenerating(null) }
  }

  function copyDoc() {
    if (docContent) navigator.clipboard.writeText(docContent)
  }

  const isProjectComplete = project?.stage === 'complete' || project?.stage === 'ship_retro'

  return (
    <div className="docs-view">
      <div className="docs-sidebar">

        <div className="docs-sidebar__section">AUTO-ASSEMBLED</div>
        {loadingDocs
          ? <div className="docs-loading">Loading…</div>
          : docs.length === 0
            ? <div className="docs-sidebar__empty">Documents appear as you progress</div>
            : docs.map(d => (
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
        {[
          { type: 'milestone-report', label: 'Milestone Report', available: ['execution', 'milestone_retro', 'ship_retro', 'complete'].includes(project?.stage) },
          { type: 'close-report',     label: 'Close Report',     available: isProjectComplete },
        ].map(({ type, label, available }) => {
          const existing = generatedDocs.find(d => d.doc_type === type)
          const meta     = DOC_TYPE_META[type]
          const isActive = selected?.type === type && selected?.isGenerated
          if (!available) return null
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
              {loadingDoc ? <div className="docs-loading">Generating…</div> : renderMd(docContent)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
