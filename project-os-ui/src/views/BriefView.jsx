export default function BriefView({ project, state }) {
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
      <div className="view-empty__icon">📋</div>
      <div className="view-empty__title">Brief not yet complete</div>
      <div className="view-empty__sub">Chat with the Intake Agent to build your project brief. It will appear here automatically.</div>
    </div>
  )

  return (
    <div className="brief-view">
      <div className="brief-view__inner">

        <div className="bv-header">
          <div className="bv-type">{project.project_type ?? 'Project'}</div>
          <h1 className="bv-title">{project.title}</h1>
          {project.one_liner && <p className="bv-oneliner">{project.one_liner}</p>}
          {project.confidence_score != null && (
            <div className="bv-confidence">
              <div className="bv-confidence__bar">
                <div className="bv-confidence__fill" style={{
                  width: `${project.confidence_score}%`,
                  background: project.confidence_score >= 70 ? 'var(--green)' : 'var(--amber)'
                }} />
              </div>
              <span className="bv-confidence__label">Brief confidence {project.confidence_score}/100</span>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="bv-section">
            <div className="bv-section__label">Progress</div>
            <div className="bv-progress">
              <div className="bv-progress__bar">
                <div className="bv-progress__fill" style={{ width: `${Math.round(done / total * 100)}%` }} />
              </div>
              <span className="bv-progress__text">{done} of {total} tasks complete</span>
            </div>
          </div>
        )}

        <div className="bv-grid">
          {project.target_user && (
            <div className="bv-section">
              <div className="bv-section__label">Built for</div>
              <div className="bv-section__content">{project.target_user}</div>
            </div>
          )}
          {project.core_problem && (
            <div className="bv-section">
              <div className="bv-section__label">Problem</div>
              <div className="bv-section__content">{project.core_problem}</div>
            </div>
          )}
        </div>

        {criteria.length > 0 && (
          <div className="bv-section">
            <div className="bv-section__label">Success criteria</div>
            <div className="bv-criteria">
              {criteria.map((c, i) => {
                const hasScores = c.smart_score != null
                const dims = [
                  { label: 'S', key: 'smart_specific' },
                  { label: 'M', key: 'smart_measurable' },
                  { label: 'A', key: 'smart_achievable' },
                  { label: 'R', key: 'smart_relevant' },
                  { label: 'T', key: 'smart_timebound' },
                ]
                const scoreColor = c.smart_score >= 8 ? 'var(--green)' : c.smart_score >= 6 ? 'var(--amber)' : 'var(--red, #e05)'
                return (
                  <div key={i} className="bv-criterion">
                    <div className="bv-criterion__top">
                      <span className="bv-criterion__dot">◎</span>
                      <span>{c.criterion}</span>
                    </div>
                    {hasScores && (
                      <div className="bv-criterion__smart">
                        {dims.map(d => {
                          const val = c[d.key]
                          const col = val === 2 ? 'var(--green)' : val === 1 ? 'var(--amber)' : 'var(--text-3)'
                          return (
                            <span key={d.label} className="bv-smart-dim" style={{ color: col }}>
                              {d.label}{val ?? '–'}
                            </span>
                          )
                        })}
                        <span className="bv-smart-total" style={{ color: scoreColor }}>
                          {c.smart_score}/10
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {(inScope.length > 0 || outScope.length > 0) && (
          <div className="bv-section">
            <div className="bv-section__label">Scope</div>
            <div className="bv-scope">
              {inScope.map((s, i) => (
                <div key={i} className="bv-scope__item bv-scope__item--in">
                  <span className="bv-scope__dot" style={{ color: 'var(--green)' }}>+</span>
                  <span>{s.description}</span>
                </div>
              ))}
              {outScope.map((s, i) => (
                <div key={i} className="bv-scope__item bv-scope__item--out">
                  <span className="bv-scope__dot" style={{ color: 'var(--text-3)' }}>–</span>
                  <span>{s.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(project.hours_per_week || project.planned_weeks || project.budget || project.methodology) && (
          <div className="bv-section">
            <div className="bv-section__label">Constraints</div>
            <div className="bv-chips">
              {project.methodology    && <span className="bv-chip">⊞ {project.methodology}</span>}
              {project.hours_per_week && <span className="bv-chip">◷ {project.hours_per_week}h/week</span>}
              {project.planned_weeks  && <span className="bv-chip">◫ {project.planned_weeks} weeks</span>}
              {project.budget         && <span className="bv-chip">◈ {project.budget}</span>}
            </div>
          </div>
        )}

        {openQs.length > 0 && (
          <div className="bv-section">
            <div className="bv-section__label">Open questions</div>
            {openQs.map((q, i) => (
              <div key={i} className="bv-question">
                <span className="bv-question__dot">?</span>
                <span>{typeof q === 'string' ? q : q.question}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
