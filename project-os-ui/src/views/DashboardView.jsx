import { useState, useEffect } from 'react'
import { listAssignments, runAssignment, updateAssignment } from '../lib/api.js'
import KanbanBoard from '../components/KanbanBoard.jsx'

// ── Guided Stage Card — "what do I do next?" ──────────────────────────────────

export function GuidedStageCard({ project, state, transition, setView, transitioning, onOpenChat }) {
  const stage = project?.stage
  if (!stage) return null

  const allTasks     = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const doneTasks    = allTasks.filter(t => t.status === 'done').length
  const totalTasks   = allTasks.length
  const allMilestones = (state?.phases ?? []).flatMap(p => p.milestones ?? [])
  const allMsDone    = allMilestones.length > 0 && allMilestones.every(m =>
    m.completed_at != null ||
    ((m.tasks ?? []).length > 0 && (m.tasks ?? []).every(t => t.status === 'done'))
  )

  if (stage === 'intake') {
    return (
      <div className="guided-card guided-card--blue">
        <div className="guided-card__icon">◎</div>
        <div className="guided-card__body">
          <div className="guided-card__title">Step 1 — Tell the Intake Agent about your project</div>
          <div className="guided-card__sub">Describe your idea in plain English. The agent will draft a complete brief and ask at most one clarifying question. Usually takes 1–2 messages.</div>
          <button className="guided-card__btn" onClick={onOpenChat}>Chat with Intake Agent →</button>
        </div>
      </div>
    )
  }

  if (stage === 'planning') {
    return (
      <div className="guided-card guided-card--blue">
        <div className="guided-card__icon">◑</div>
        <div className="guided-card__body">
          <div className="guided-card__title">Step 2 — Planning Agent is generating your execution plan</div>
          <div className="guided-card__sub">Review the plan being built. When it's ready you'll be asked to approve it — after that, the Kanban board unlocks and execution begins.</div>
          <button className="guided-card__btn" onClick={onOpenChat}>Chat with Planning Agent →</button>
        </div>
      </div>
    )
  }

  if (stage === 'execution' && !project?.last_checkin_at) {
    return (
      <div className="action-strip action-strip--blue">
        <span className="action-strip__icon">◎</span>
        <span className="action-strip__text">Day 1 — Your Execution Agent is ready. Tell it what you worked on and it will update the board.</span>
        <button className="action-strip__btn" onClick={onOpenChat}>Start check-in →</button>
      </div>
    )
  }

  if (stage === 'execution' && project?.last_checkin_at && doneTasks < totalTasks) {
    const hoursAgo = Math.floor((Date.now() - new Date(project.last_checkin_at)) / 3600000)
    const timeStr = hoursAgo < 1 ? 'just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`
    if (hoursAgo >= 20) {
      return (
        <div className="action-strip action-strip--amber">
          <span className="action-strip__icon">◷</span>
          <span className="action-strip__text">Last check-in was {timeStr} — tell the Execution Agent what you worked on.</span>
          <button className="action-strip__btn" onClick={onOpenChat}>Check in →</button>
        </div>
      )
    }
    return null
  }

  if (stage === 'execution' && totalTasks > 0 && doneTasks === totalTasks) {
    return (
      <div className="action-strip action-strip--green">
        <span className="action-strip__icon">🎉</span>
        <span className="action-strip__text">{allMsDone ? 'Every milestone is done — run the ship retro to close the project.' : 'All tasks in this milestone are done — run a retro before the next milestone.'}</span>
        <button className="action-strip__btn" disabled={transitioning} onClick={() => transition(allMsDone ? 'ship_retro' : 'milestone_retro')}>
          {transitioning ? 'Starting…' : allMsDone ? 'Ship retro →' : 'Milestone retro →'}
        </button>
      </div>
    )
  }

  if (stage === 'milestone_retro') {
    return (
      <div className="action-strip action-strip--amber">
        <span className="action-strip__icon">◫</span>
        <span className="action-strip__text">Milestone retro in progress — answer the Retro Agent's three questions. Board unlocks automatically when done.</span>
        <button className="action-strip__btn" onClick={onOpenChat}>Continue →</button>
      </div>
    )
  }

  if (stage === 'ship_retro') {
    return (
      <div className="action-strip action-strip--amber">
        <span className="action-strip__icon">🚀</span>
        <span className="action-strip__text">Ship retro in progress — five questions about what you built, learned, and what goes in the v2 backlog.</span>
        <button className="action-strip__btn" onClick={onOpenChat}>Continue →</button>
      </div>
    )
  }

  if (stage === 'complete') {
    return (
      <div className="action-strip action-strip--green">
        <span className="action-strip__icon">✓</span>
        <span className="action-strip__text">Project complete — your documents, retro summary, decisions, and v2 backlog are saved.</span>
        <button className="action-strip__btn" onClick={() => setView('docs')}>View documents →</button>
      </div>
    )
  }

  return null
}

// ── Command Strip (quick stats) ───────────────────────────────────────────────

function CommandStrip({ project, state }) {
  const allTasks  = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const done      = allTasks.filter(t => t.status === 'done').length
  const total     = allTasks.length
  const inProg    = allTasks.filter(t => t.status === 'in_progress').length
  const blocked   = allTasks.filter(t => t.status === 'blocked').length
  const highRisks = (state?.risk_register ?? []).filter(r => r.risk_score >= 7 && r.status === 'open' && !r.description?.startsWith('ASSUMPTION:')).length
  const daysIn    = project?.created_at ? Math.floor((Date.now() - new Date(project.created_at)) / 86400000) + 1 : null
  const planned   = project?.planned_weeks ? project.planned_weeks * 7 : null
  const pct       = total > 0 ? Math.round(done / total * 100) : 0

  const metrics = [
    { value: `${done}/${total || '—'}`, label: 'Tasks Done',   variant: done > 0 && done === total ? 'green' : '' },
    { value: inProg,                    label: 'In Progress',  variant: inProg > 0 ? 'blue' : '' },
    { value: blocked,                   label: 'Blocked',      variant: blocked > 0 ? 'red' : '' },
    { value: highRisks,                 label: 'High Risks',   variant: highRisks > 0 ? 'red' : '' },
    project?.momentum_score != null && {
      value: project.momentum_score,
      label: 'Momentum',
      variant: project.momentum_score >= 60 ? 'green' : project.momentum_score >= 30 ? 'amber' : 'red',
    },
    daysIn && {
      value: `D${daysIn}`,
      label: planned ? `of ${planned} days` : 'elapsed',
      variant: planned && daysIn > planned ? 'red' : '',
    },
  ].filter(Boolean)

  return (
    <div className="cmd-strip">
      {metrics.map((m, i) => (
        <div key={i} className={`cmd-metric${m.variant ? ` cmd-metric--${m.variant}` : ''}`}>
          <span className="cmd-metric__value">{m.value}</span>
          <span className="cmd-metric__label">{m.label}</span>
        </div>
      ))}
      {total > 0 && (
        <div className="cmd-metric cmd-metric--progress">
          <div className="cmd-progress-bar">
            <div className="cmd-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="cmd-metric__label">{pct}% complete</span>
        </div>
      )}
    </div>
  )
}

// ── Milestone Sidebar ─────────────────────────────────────────────────────────

function MilestoneSidebar({ state }) {
  const phases = state?.phases ?? []
  const allMs  = phases.flatMap(p => p.milestones ?? [])
  if (!allMs.length) return (
    <div className="ms-sidebar">
      <div className="ms-sidebar__label">MILESTONES</div>
      <div className="ms-empty">Milestones appear once planning is complete</div>
    </div>
  )

  return (
    <div className="ms-sidebar">
      <div className="ms-sidebar__label">MILESTONES</div>
      {phases.map(ph => (
        <div key={ph.id} className="ms-phase">
          <div className="ms-phase__label">{ph.title}</div>
          {(ph.milestones ?? []).map(ms => {
            const tasks    = ms.tasks ?? []
            const done     = tasks.filter(t => t.status === 'done').length
            const total    = tasks.length
            const blocked  = tasks.filter(t => t.status === 'blocked').length
            const pct      = total > 0 ? Math.round(done / total * 100) : 0
            const complete = ms.completed_at != null
            const allDone  = !complete && total > 0 && done === total
            return (
              <div key={ms.id} className={`ms-item${complete ? ' ms-item--complete' : allDone ? ' ms-item--ready' : ''}`}>
                <div className="ms-item__header">
                  <span className="ms-item__title">{ms.title}</span>
                  {complete && <span className="ms-item__pill ms-item__pill--done">✓</span>}
                  {allDone  && <span className="ms-item__pill ms-item__pill--ready">ready</span>}
                  {blocked > 0 && !complete && <span className="ms-item__pill ms-item__pill--blocked">{blocked} ⊘</span>}
                </div>
                <div className="ms-item__bar">
                  <div className="ms-item__bar-fill" style={{
                    width: `${pct}%`,
                    background: complete ? 'var(--green)' : blocked > 0 ? 'var(--red)' : 'var(--amber)'
                  }} />
                </div>
                <div className="ms-item__sub">{done}/{total} tasks</div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Dashboard View ────────────────────────────────────────────────────────────

export default function DashboardView({ project, state, updateTaskDirect, addComment, transition, setView, transitioning, onOpenChat }) {
  const allTasks  = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const showStrip = allTasks.length > 0 || project?.momentum_score != null

  // Fetch assignments and build a task_key → assignment map for the kanban
  const [assignmentMap, setAssignmentMap] = useState({})
  useEffect(() => {
    if (!project?.id) return

    function fetchAndBuild() {
      listAssignments(project.id)
        .then(d => {
          const map = {}
          for (const a of d.assignments ?? []) {
            if (a.status === 'rejected') continue
            const existing = map[a.task_key]
            if (!existing || a.updated_at > existing.updated_at) map[a.task_key] = a
          }
          setAssignmentMap(map)
        })
        .catch(() => {})
    }

    // Immediate fetch
    fetchAndBuild()

    // Delayed re-fetch: the fire-and-forget assignment analysis on the backend
    // is an LLM call (~3–8s). This ensures we pick up assignments once ready.
    const timer = setTimeout(fetchAndBuild, 6000)
    return () => clearTimeout(timer)
  }, [project?.id, state]) // re-fetch after every check-in (state changes)

  const pendingReview = Object.values(assignmentMap).filter(a => a.status === 'pending_review').length

  // Run an agent directly from the kanban board
  async function handleRunAgent(assignmentId) {
    const entry = Object.values(assignmentMap).find(a => a.id === assignmentId)
    if (!entry) return
    // Optimistic: mark running
    setAssignmentMap(prev => ({ ...prev, [entry.task_key]: { ...entry, status: 'running' } }))
    try {
      await runAssignment(project.id, assignmentId)
      // Refresh full state (triggers re-fetch of assignments via useEffect)
      await updateTaskDirect(entry.task_key, {}) // lightweight re-read
    } catch {
      // Revert on error
      setAssignmentMap(prev => ({ ...prev, [entry.task_key]: { ...entry, status: 'pending_review' } }))
    }
  }

  // Skip/reject an assignment from the kanban board
  async function handleSkipAgent(assignmentId) {
    const entry = Object.values(assignmentMap).find(a => a.id === assignmentId)
    if (!entry) return
    setAssignmentMap(prev => {
      const next = { ...prev }
      delete next[entry.task_key]
      return next
    })
    await updateAssignment(project.id, assignmentId, { status: 'rejected' }).catch(() => {})
  }

  return (
    <div className="dashboard">
      <GuidedStageCard
        project={project} state={state}
        transition={transition} setView={setView}
        transitioning={transitioning} onOpenChat={onOpenChat}
      />
      {showStrip && <CommandStrip project={project} state={state} />}

      {pendingReview > 0 && (
        <div className="assignment-notice" onClick={() => setView('specialists')}>
          <span className="assignment-notice__icon">★</span>
          <span className="assignment-notice__text">
            {pendingReview} task{pendingReview > 1 ? 's have' : ' has'} been auto-assigned to agents — review before running
          </span>
          <span className="assignment-notice__cta">Review →</span>
        </div>
      )}

      <div className="dashboard__body">
        <div className="dashboard__board">
          <KanbanBoard
            phases={state?.phases}
            projectStage={project?.stage}
            assignmentMap={assignmentMap}
            onUpdateTask={updateTaskDirect}
            onAddComment={addComment}
            onRunAgent={handleRunAgent}
            onSkipAgent={handleSkipAgent}
            onViewAgents={() => setView('specialists')}
            onMilestoneComplete={() => {
              const allMs  = (state?.phases ?? []).flatMap(p => p.milestones ?? [])
              const allDone = allMs.every(m =>
                m.completed_at != null ||
                ((m.tasks ?? []).length > 0 && (m.tasks ?? []).every(t => t.status === 'done'))
              )
              transition(allDone ? 'ship_retro' : 'milestone_retro')
            }}
            onOpenChat={onOpenChat}
          />
        </div>
        <div className="dashboard__sidebar">
          <MilestoneSidebar state={state} setView={setView} />
        </div>
      </div>
    </div>
  )
}
