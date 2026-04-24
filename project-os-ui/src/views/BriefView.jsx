import { useState, useEffect } from 'react'
import { fetchBrief, saveBriefVersion, approveBriefVersion } from '../lib/api.js'

export default function BriefView({ project, state }) {
  const [briefMeta,  setBriefMeta]  = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [approving,  setApproving]  = useState(false)

  useEffect(() => {
    if (!project?.id) return
    fetchBrief(project.id).then(d => setBriefMeta(d)).catch(() => {})
  }, [project?.id])

  async function handleSave() {
    setSaving(true)
    try {
      const d = await saveBriefVersion(project.id, {
        sections: [],
        change_note: 'Manual save from Brief view',
      })
      setBriefMeta(prev => prev ? {
        ...prev,
        brief:    { ...prev.brief, current_version: d.version.version },
        current:  d.version,
        versions: [d.version, ...(prev.versions ?? [])],
      } : null)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function handleApprove() {
    if (!briefMeta?.current?.id) return
    setApproving(true)
    try {
      await approveBriefVersion(project.id, briefMeta.current.id)
      setBriefMeta(prev => prev ? {
        ...prev,
        current: { ...prev.current, approved_at: new Date().toISOString() },
      } : null)
    } catch (e) { console.error(e) }
    finally { setApproving(false) }
  }

  if (!project) return <div className="view-empty">No project loaded</div>

  const inScope  = (project.scope_items ?? []).filter(s => s.in_scope)
  const outScope = (project.scope_items ?? []).filter(s => !s.in_scope)
  const criteria = (project.success_criteria ?? []).map(s => typeof s === 'string' ? { criterion: s } : s)
  const openQs   = (project.open_questions ?? []).filter(q => !q.resolved)
  const allTasks = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const done     = allTasks.filter(t => t.status === 'done').length
  const total    = allTasks.length

  const empty = !project.one_liner && !project.core_problem && !project.target_user
  if (empty) return (
    <div className="view-empty">
      <div className="view-empty__title">Brief not yet complete</div>
      <div className="view-empty__sub">Chat with the Intake Agent to build your project brief. It will appear here automatically.</div>
    </div>
  )

  let n = 0
  const seq = () => String(++n).padStart(2, '0')

  return (
    <div className="view view--pad">
      <div className="brief-v">
        <span className="brief-v__chip">
          v{briefMeta?.brief?.current_version ?? 1} · {briefMeta?.current?.approved_at ? 'APPROVED' : 'DRAFT'}
        </span>
        <span className="brief-v__text">{project.title} — {project.project_type ?? 'Project'}</span>
        {project.confidence_score != null && (
          <span className="brief-v__diff">confidence {project.confidence_score}/100</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {briefMeta?.current && !briefMeta.current.approved_at && (
            <button
              style={{ padding: '3px 10px', fontSize: 11, borderRadius: 'var(--r)', border: '0.5px solid var(--teal)', color: 'var(--teal)', background: 'transparent', cursor: 'pointer' }}
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? '…' : '✓ Approve'}
            </button>
          )}
          <button
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 'var(--r)', border: '0.5px solid var(--border)', color: 'var(--text-2)', background: 'transparent', cursor: 'pointer' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '…' : 'Save version'}
          </button>
        </div>
      </div>

      <div className="brief">

        {(project.core_problem || project.target_user) && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Problem &amp; context</span>
            </div>
            <div className="bsec__body">
              <div className="brief__grid">
                {project.target_user && (
                  <div>
                    <div className="brief__k">Built for</div>
                    <div className="brief__v">{project.target_user}</div>
                  </div>
                )}
                {project.core_problem && (
                  <div>
                    <div className="brief__k">Problem</div>
                    <div className="brief__v">{project.core_problem}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {project.one_liner && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Goals</span>
            </div>
            <div className="bsec__body">{project.one_liner}</div>
          </div>
        )}

        {(inScope.length > 0 || outScope.length > 0) && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Scope</span>
            </div>
            <div className="bsec__body">
              {inScope.length > 0 && outScope.length > 0 ? (
                <div className="brief__two">
                  <div>
                    <div className="brief__k">In scope</div>
                    <ul className="brief__ul">
                      {inScope.map((s, i) => <li key={i}>{s.description}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="brief__k">Out of scope</div>
                    <ul className="brief__ul brief__ul--strike">
                      {outScope.map((s, i) => <li key={i}>{s.description}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <ul className="brief__ul">
                  {[...inScope, ...outScope].map((s, i) => <li key={i}>{s.description}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}

        {criteria.length > 0 && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Success criteria</span>
            </div>
            <div className="bsec__body">
              <ul className="brief__ul">
                {criteria.map((c, i) => {
                  const sc = c.smart_score
                  const color = sc >= 8 ? 'var(--teal)' : sc >= 6 ? 'var(--amber)' : sc != null ? 'var(--red)' : null
                  return (
                    <li key={i}>
                      {c.criterion}
                      {sc != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color, marginLeft: 6 }}>{sc}/10</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {(project.hours_per_week || project.planned_weeks || project.budget || project.methodology) && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Constraints</span>
            </div>
            <div className="bsec__body">
              <div className="brief__grid">
                {project.methodology    && <div><div className="brief__k">Methodology</div><div className="brief__v">{project.methodology}</div></div>}
                {project.hours_per_week && <div><div className="brief__k">Capacity</div><div className="brief__v">{project.hours_per_week}h/week</div></div>}
                {project.planned_weeks  && <div><div className="brief__k">Duration</div><div className="brief__v">{project.planned_weeks} weeks</div></div>}
                {project.budget         && <div><div className="brief__k">Budget</div><div className="brief__v">{project.budget}</div></div>}
              </div>
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Progress</span>
            </div>
            <div className="bsec__body">
              <div className="brief__grid">
                <div>
                  <div className="brief__k">Tasks</div>
                  <div className="brief__v">{done} of {total} complete ({Math.round(done / total * 100)}%)</div>
                </div>
                {project.planned_weeks && (
                  <div>
                    <div className="brief__k">Timeline</div>
                    <div className="brief__v">{project.planned_weeks} weeks planned</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {openQs.length > 0 && (
          <div className="bsec">
            <div className="bsec__head">
              <span className="bsec__n mono">{seq()}</span>
              <span className="bsec__title">Open questions</span>
            </div>
            <div className="bsec__body">
              <ul className="brief__ul">
                {openQs.map((q, i) => (
                  <li key={i}>{typeof q === 'string' ? q : q.question}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
