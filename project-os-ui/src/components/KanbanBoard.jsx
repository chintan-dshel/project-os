/**
 * KanbanBoard.jsx — v0.9
 *
 * Key changes from user feedback:
 * 1. Drop to Done → prompts for actual hours inline (no chat needed)
 * 2. Hours chip on collapsed card is directly editable (click to edit)
 * 3. Status mini pill still cycles on click
 * 4. Drag and drop preserved
 */

import { useState, useRef } from 'react'

const COLUMNS = [
  { id: 'todo',        label: 'TODO',        color: 'var(--text-3)', bg: 'transparent' },
  { id: 'in_progress', label: 'IN PROGRESS', color: 'var(--blue)',   bg: 'var(--blue-2)' },
  { id: 'done',        label: 'DONE',        color: 'var(--green)',  bg: 'var(--green-2)' },
  { id: 'blocked',     label: 'BLOCKED',     color: 'var(--red)',    bg: 'var(--red-2)' },
]

const STATUS_CYCLE  = ['todo', 'in_progress', 'done', 'blocked']
const STATUS_COLORS = {
  todo:        { color: 'var(--text-3)',  bg: 'var(--bg-5)' },
  in_progress: { color: 'var(--blue)',   bg: 'var(--blue-2)' },
  done:        { color: 'var(--green)',  bg: 'var(--green-2)' },
  blocked:     { color: 'var(--red)',    bg: 'var(--red-2)' },
}
const STATUS_LABELS = { todo: 'TODO', in_progress: 'IN PROGRESS', done: 'DONE', blocked: 'BLOCKED' }
const PRIORITY_CFG  = {
  critical: { label: 'CRIT', color: 'var(--red)',    bg: 'var(--red-2)' },
  high:     { label: 'HIGH', color: 'var(--amber)',  bg: 'var(--amber-2)' },
  normal:   { label: 'NRM',  color: 'var(--text-3)', bg: 'var(--bg-5)' },
}

function parseNotes(notes) {
  if (!notes) return { comments: [], plainNotes: '' }
  const lines = notes.split('\n')
  const comments = [], plain = []
  for (const line of lines) {
    const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] (.+)$/)
    if (m) comments.push({ ts: m[1], text: m[2] })
    else plain.push(line)
  }
  return { comments, plainNotes: plain.filter(Boolean).join('\n') }
}

// ── "How long did this take?" prompt — shown when card dropped to Done ─────────

function HoursPrompt({ task, onSave, onSkip }) {
  const [hours, setHours] = useState('')
  const inputRef = useRef(null)

  // Auto-focus when prompt appears
  useState(() => { setTimeout(() => inputRef.current?.focus(), 50) })

  function submit() {
    const h = parseFloat(hours)
    if (!isNaN(h) && h > 0) {
      onSave(h)
    } else {
      onSkip()
    }
  }

  return (
    <div className="hours-prompt">
      <div className="hours-prompt__title">Task complete! How long did it take?</div>
      <div className="hours-prompt__hint">
        {task.estimated_hours ? `Estimated: ${task.estimated_hours}h` : 'Log actual hours for EVM tracking'}
      </div>
      <div className="hours-prompt__row">
        <input
          ref={inputRef}
          className="hours-prompt__input"
          type="number"
          min="0.5"
          step="0.5"
          placeholder="e.g. 3.5"
          value={hours}
          onChange={e => setHours(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onSkip()
          }}
        />
        <span className="hours-prompt__unit">hours</span>
        <button className="hours-prompt__save" onClick={submit}>Save</button>
        <button className="hours-prompt__skip" onClick={onSkip}>Skip</button>
      </div>
    </div>
  )
}

// ── Inline hours chip editor — click to edit without expanding card ─────────────

function HoursChip({ task, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(task.actual_hours ?? ''))
  const inputRef              = useRef(null)
  const isOver = task.actual_hours != null && task.estimated_hours != null
    && parseFloat(task.actual_hours) > parseFloat(task.estimated_hours)

  function startEdit(e) {
    e.stopPropagation()
    setVal(String(task.actual_hours ?? ''))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  function commit() {
    const h = parseFloat(val)
    setEditing(false)
    if (!isNaN(h) && h > 0) onSave(h)
  }

  if (editing) {
    return (
      <div className="kcard__chip-edit" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="kcard__chip-input"
          type="number" min="0" step="0.5"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>h</span>
      </div>
    )
  }

  if (task.actual_hours != null) {
    return (
      <span
        className={`kcard__chip${isOver ? ' kcard__chip--over' : ' kcard__chip--under'} kcard__chip--editable`}
        onClick={startEdit}
        title="Click to edit actual hours"
      >
        {parseFloat(task.actual_hours).toFixed(1)}h actual {isOver ? '▲' : ''}✎
      </span>
    )
  }

  // No hours logged yet — show a subtle prompt
  if (task.status === 'done' || task.status === 'in_progress') {
    return (
      <span
        className="kcard__chip kcard__chip--log-hours"
        onClick={startEdit}
        title="Log actual hours"
      >
        + log hours
      </span>
    )
  }

  return null
}

// ── Assignment Badge ──────────────────────────────────────────────────────────

const ASSIGNMENT_BADGE = {
  pending_review:  { label: '★ Review',   color: 'var(--amber)',  bg: 'var(--amber-2)',  title: 'Agent assigned — awaiting your review' },
  approved:        { label: '▶ Queued',   color: 'var(--blue)',   bg: 'var(--blue-2)',   title: 'Approved — ready to run' },
  running:         { label: '⟳ Running',  color: 'var(--blue)',   bg: 'var(--blue-2)',   title: 'Agent is running' },
  completed:       { label: '✓ Agent',    color: 'var(--green)',  bg: 'var(--green-2)',  title: 'Completed by agent — review output' },
  assigned_to_user:{ label: '◉ You',      color: 'var(--text-2)', bg: 'var(--bg-5)',     title: 'Assigned to you — no suitable agent found' },
}

function AssignmentBadge({ assignment }) {
  if (!assignment) return null
  const cfg = ASSIGNMENT_BADGE[assignment.status]
  if (!cfg) return null
  return (
    <span
      className="kcard__assignment-badge"
      style={{ color: cfg.color, background: cfg.bg }}
      title={`${cfg.title}${assignment.agent_name ? ` · ${assignment.agent_name}` : ''}`}
    >
      {cfg.label}
    </span>
  )
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, assignment, onUpdateTask, onAddComment, onRunAgent, onSkipAgent, onViewAgents, onDragStart, onDragEnd, isDragging }) {
  const [expanded,     setExpanded]     = useState(false)
  const [localStatus,  setLocalStatus]  = useState(task.status)
  const [commentInput, setCommentInput] = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveErr,      setSaveErr]      = useState(null)
  const [agentRunning, setAgentRunning] = useState(false)

  const pri = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.normal
  const { comments, plainNotes } = parseNotes(task.notes)
  const sc = STATUS_COLORS[localStatus] ?? STATUS_COLORS.todo

  async function changeStatus(next) {
    setLocalStatus(next)
    setSaveErr(null)
    try { await onUpdateTask(task.task_key, { status: next }) }
    catch { setLocalStatus(task.status); setSaveErr('Failed to update') }
  }

  async function saveActualHours(h) {
    try { await onUpdateTask(task.task_key, { actual_hours: h }) }
    catch { setSaveErr('Failed to save hours') }
  }

  async function postComment() {
    const c = commentInput.trim()
    if (!c) return
    setSaving(true)
    try { await onAddComment(task.task_key, c); setCommentInput('') }
    catch { setSaveErr('Failed to post') }
    finally { setSaving(false) }
  }

  function handleDragStart(e) {
    if (expanded) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', task.task_key)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(task)
  }

  return (
    <div
      className={`kcard${localStatus === 'blocked' ? ' kcard--blocked' : ''}${localStatus === 'done' ? ' kcard--done' : ''}${expanded ? ' kcard--expanded' : ''}${isDragging ? ' kcard--dragging' : ''}`}
      draggable={!expanded}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Top row: priority + status pill + assignment badge + chevron */}
      <div className="kcard__top" onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
        <span className="kcard__pri" style={{ color: pri.color, background: pri.bg }}>{pri.label}</span>
        <button
          className="kcard__status-mini"
          style={{ color: sc.color, background: sc.bg }}
          onClick={e => {
            e.stopPropagation()
            const idx  = STATUS_CYCLE.indexOf(localStatus)
            const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
            changeStatus(next)
          }}
          onMouseDown={e => e.stopPropagation()}
          title="Click to cycle status"
        >
          {STATUS_LABELS[localStatus]}
        </button>
        {localStatus === 'blocked' && <span className="kcard__blocked-icon">⊘</span>}
        <AssignmentBadge assignment={assignment} />
        {comments.length > 0 && !expanded && (
          <span className="kcard__comment-dot" title={`${comments.length} comment${comments.length > 1 ? 's' : ''}`} />
        )}
        <span className="kcard__chevron">{expanded ? '▴' : '▾'}</span>
      </div>

      {/* Title */}
      <div className="kcard__title" onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
        {task.title}
      </div>

      {/* Hours row — directly editable, no expansion needed */}
      <div className="kcard__hours">
        {task.estimated_hours != null && (
          <span className="kcard__chip">{task.estimated_hours}h est</span>
        )}
        <HoursChip task={task} onSave={saveActualHours} />
        {task.completed_at && (
          <span className="kcard__chip kcard__chip--done">
            ✓ {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="kcard__panel" onMouseDown={e => e.stopPropagation()}>
          {task.description && (
            <div>
              <div className="kpanel__label">DESCRIPTION</div>
              <div className="kpanel__desc">{task.description}</div>
            </div>
          )}

          {/* Status selector */}
          <div>
            <div className="kpanel__label">STATUS</div>
            <div className="kpanel__statuses">
              {STATUS_CYCLE.map(s => {
                const c = STATUS_COLORS[s]
                return (
                  <button
                    key={s}
                    className={`kpanel__status-btn${localStatus === s ? ' kpanel__status-btn--active' : ''}`}
                    style={localStatus === s ? { color: c.color, background: c.bg, borderColor: c.color } : {}}
                    onClick={() => changeStatus(s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Plain notes */}
          {plainNotes && (
            <div>
              <div className="kpanel__label">NOTES</div>
              <div className="kpanel__desc" style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>
                {plainNotes}
              </div>
            </div>
          )}

          {/* Comment thread */}
          <div>
            <div className="kpanel__label">
              COMMENTS {comments.length > 0 && <span className="kpanel__count">({comments.length})</span>}
            </div>
            {comments.length > 0 && (
              <div className="kpanel__comments">
                {comments.map((c, i) => (
                  <div key={i} className="kpanel__comment">
                    <span className="kpanel__comment-ts">{c.ts}</span>
                    <span className="kpanel__comment-text">{c.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="kpanel__comment-row">
              <input
                className="kpanel__comment-input"
                type="text"
                placeholder="Add a comment… (Enter to post)"
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); postComment() } }}
                disabled={saving}
              />
              <button
                className="kpanel__comment-btn"
                onClick={postComment}
                disabled={!commentInput.trim() || saving}
              >
                {saving ? '…' : '↵'}
              </button>
            </div>
          </div>

          {/* Agent assignment section */}
          {assignment && assignment.status !== 'rejected' && (
            <div className="kpanel__agent-section">
              <div className="kpanel__label">AGENT</div>

              {assignment.status === 'assigned_to_user' && (
                <div className="kpanel__agent-note">◉ No suitable agent — this one is yours to do.</div>
              )}

              {assignment.status === 'pending_review' && (
                <>
                  <div className="kpanel__agent-who">
                    {assignment.agent_name ?? 'Specialist Agent'}
                    <span className="kpanel__agent-reason">{assignment.analysis_reason}</span>
                  </div>
                  {assignment.suggested_prompt && (
                    <div className="kpanel__agent-brief">{assignment.suggested_prompt}</div>
                  )}
                  <div className="kpanel__agent-actions">
                    <button
                      className="kpanel__agent-run"
                      disabled={agentRunning}
                      onClick={async () => {
                        setAgentRunning(true)
                        await onRunAgent?.(assignment.id)
                        setAgentRunning(false)
                      }}
                    >
                      {agentRunning ? '⟳ Running…' : `▶ Run ${assignment.agent_name ?? 'Agent'}`}
                    </button>
                    <button className="kpanel__agent-skip" onClick={() => onSkipAgent?.(assignment.id)}>
                      ✕ Skip
                    </button>
                  </div>
                </>
              )}

              {assignment.status === 'running' && (
                <div className="kpanel__agent-who">
                  <span className="kpanel__agent-spinner">⟳</span> {assignment.agent_name ?? 'Agent'} is running…
                </div>
              )}

              {assignment.status === 'completed' && (
                <>
                  <div className="kpanel__agent-who">✓ {assignment.agent_name ?? 'Agent'} completed</div>
                  <button className="kpanel__agent-view" onClick={() => onViewAgents?.()}>
                    Review output in Agents tab →
                  </button>
                </>
              )}

              {assignment.status === 'approved' && (
                <div className="kpanel__agent-who">▶ {assignment.agent_name ?? 'Agent'} is queued to run</div>
              )}
            </div>
          )}

          {saveErr && <div className="kpanel__error">{saveErr}</div>}
        </div>
      )}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({ col, tasks, assignmentMap, onUpdateTask, onAddComment, onRunAgent, onSkipAgent, onViewAgents, dragState, onColDragOver, onColDrop, onColDragLeave }) {
  const isOver = dragState?.overCol === col.id

  return (
    <div
      className={`kcol${isOver ? ` kcol--drag-over-${col.id}` : ''}`}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onColDragOver(col.id) }}
      onDrop={e => { e.preventDefault(); onColDrop(col.id) }}
      onDragLeave={onColDragLeave}
    >
      <div className="kcol__header">
        <span className="kcol__label" style={{ color: col.color }}>{col.label}</span>
        <span className="kcol__count" style={{ color: tasks.length > 0 ? col.color : 'var(--text-3)' }}>
          {tasks.length}
        </span>
      </div>
      <div className="kcol__cards">
        {tasks.length === 0
          ? <div className="kcol__empty">drop here</div>
          : tasks.map(t => (
              <TaskCard
                key={t.id ?? t.task_key}
                task={t}
                assignment={assignmentMap?.[t.task_key]}
                onUpdateTask={onUpdateTask}
                onAddComment={onAddComment}
                onRunAgent={onRunAgent}
                onSkipAgent={onSkipAgent}
                onViewAgents={onViewAgents}
                onDragStart={dragState?.onDragStart}
                onDragEnd={dragState?.onDragEnd}
                isDragging={dragState?.draggingKey === t.task_key}
              />
            ))
        }
      </div>
    </div>
  )
}

// ── Milestone ─────────────────────────────────────────────────────────────────

function MilestoneBoard({ milestone, assignmentMap, onUpdateTask, onAddComment, onComplete, onRunAgent, onSkipAgent, onViewAgents, projectStage }) {
  const [collapsed,     setCollapsed]     = useState(false)
  const [draggingTask,  setDraggingTask]  = useState(null)
  const [overCol,       setOverCol]       = useState(null)
  // Hours prompt state: { task } when a card is dropped to Done without hours
  const [hoursPrompt,   setHoursPrompt]   = useState(null)

  const tasks    = milestone.tasks ?? []
  const grouped  = COLUMNS.reduce((a, c) => { a[c.id] = tasks.filter(t => t.status === c.id); return a }, {})
  const done     = grouped.done.length
  const total    = tasks.length
  const blocked  = grouped.blocked.length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0
  const isComplete = milestone.completed_at != null
  const inExecution = !projectStage || projectStage === 'execution'
  const allDone    = !isComplete && total > 0 && done === total && inExecution
  const barColor   = isComplete ? 'var(--green)' : blocked > 0 ? 'var(--red)' : 'var(--amber)'

  const dragState = {
    draggingKey: draggingTask?.task_key ?? null,
    overCol,
    onDragStart: (task) => setDraggingTask(task),
    onDragEnd:   ()     => { setDraggingTask(null); setOverCol(null) },
  }

  function handleColDragOver(colId) { setOverCol(colId) }
  function handleColDragLeave()     { setOverCol(null) }

  function handleColDrop(colId) {
    if (!draggingTask) return
    const { task: dropped } = { task: draggingTask }
    const fromCol = draggingTask.status

    if (colId !== fromCol) {
      onUpdateTask(draggingTask.task_key, { status: colId }).catch(() => {})

      // If dropped to Done and no actual hours → prompt
      if (colId === 'done' && !draggingTask.actual_hours) {
        setHoursPrompt(draggingTask)
      }
    }
    setDraggingTask(null)
    setOverCol(null)
  }

  function handleHoursSave(h) {
    if (hoursPrompt) {
      onUpdateTask(hoursPrompt.task_key, { actual_hours: h }).catch(() => {})
    }
    setHoursPrompt(null)
  }

  return (
    <div className="kms">
      <button className="kms__header" onClick={() => setCollapsed(v => !v)}>
        <span className="kms__toggle">{collapsed ? '▸' : '▾'}</span>
        <span className="kms__title">{milestone.title}</span>
        {milestone.success_condition && !collapsed && (
          <span className="kms__condition">· {milestone.success_condition}</span>
        )}
        <div className="kms__stats">
          {blocked > 0 && <span className="kms__pill kms__pill--blocked">{blocked} blocked</span>}
          {isComplete
            ? <span className="kms__pill kms__pill--done">✓ complete</span>
            : <span className="kms__pill kms__pill--count">{done}/{total}</span>
          }
          <div className="kms__bar">
            <div className="kms__bar-fill" style={{ width: `${pct}%`, background: barColor }} />
          </div>
        </div>
      </button>

      {!collapsed && (
        <>
          {/* Hours prompt shown at milestone level, above columns */}
          {hoursPrompt && (
            <HoursPrompt
              task={hoursPrompt}
              onSave={handleHoursSave}
              onSkip={() => setHoursPrompt(null)}
            />
          )}

          {allDone && (
            <div className="next-step-banner">
              <span className="next-step-banner__icon">🎉</span>
              <div className="next-step-banner__body">
                <div className="next-step-banner__title">Milestone complete!</div>
                <div className="next-step-banner__sub">
                  All {total} tasks are done. Run a retro to capture learnings before starting the next milestone.
                </div>
                <button className="next-step-banner__btn" onClick={() => onComplete?.(milestone)}>
                  Run milestone retro →
                </button>
              </div>
            </div>
          )}

          <div className="kms__cols">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={grouped[col.id]}
                assignmentMap={assignmentMap}
                onUpdateTask={onUpdateTask}
                onAddComment={onAddComment}
                onRunAgent={onRunAgent}
                onSkipAgent={onSkipAgent}
                onViewAgents={onViewAgents}
                dragState={dragState}
                onColDragOver={handleColDragOver}
                onColDrop={handleColDrop}
                onColDragLeave={handleColDragLeave}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Phase ─────────────────────────────────────────────────────────────────────

function PhaseGroup({ phase, assignmentMap, onUpdateTask, onAddComment, onRunAgent, onSkipAgent, onViewAgents, onMilestoneComplete, projectStage }) {
  const [collapsed, setCollapsed] = useState(false)
  const milestones = phase.milestones ?? []
  const allTasks   = milestones.flatMap(m => m.tasks ?? [])
  const done       = allTasks.filter(t => t.status === 'done').length

  return (
    <div className="kphase">
      <button className="kphase__header" onClick={() => setCollapsed(v => !v)}>
        <span className="kphase__toggle">{collapsed ? '▸' : '▾'}</span>
        <span className="kphase__badge">Phase</span>
        <span className="kphase__title">{phase.title}</span>
        {phase.goal && <span className="kphase__goal">— {phase.goal}</span>}
        <span className="kphase__tally">{done}/{allTasks.length} done</span>
      </button>

      {!collapsed && (
        <div className="kphase__body">
          {milestones.length === 0
            ? <div style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text-3)' }}>No milestones yet</div>
            : milestones.map(m => (
                <MilestoneBoard
                  key={m.id ?? m.milestone_key}
                  milestone={m}
                  assignmentMap={assignmentMap}
                  onUpdateTask={onUpdateTask}
                  onAddComment={onAddComment}
                  onRunAgent={onRunAgent}
                  onSkipAgent={onSkipAgent}
                  onViewAgents={onViewAgents}
                  onComplete={onMilestoneComplete}
                  projectStage={projectStage}
                />
              ))
          }
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function KanbanBoard({ phases, projectStage, assignmentMap, onUpdateTask, onAddComment, onRunAgent, onSkipAgent, onViewAgents, onMilestoneComplete, onOpenChat }) {
  if (!phases?.length) {
    const emptyState = (!projectStage || projectStage === 'intake')
      ? { step: 'Step 1 of 3', title: 'Brief the Intake Agent', sub: 'Describe your project idea in plain English. The agent will draft a complete brief and ask at most one clarifying question.', cta: 'Chat with Intake Agent →' }
      : projectStage === 'planning'
      ? { step: 'Step 2 of 3', title: 'Planning Agent is building your plan', sub: 'Review and refine the plan with the Planning Agent. Once ready, you\'ll be asked to approve it before the board unlocks.', cta: 'Chat with Planning Agent →' }
      : projectStage === 'awaiting_approval'
      ? { step: 'Step 3 of 3', title: 'Review and approve your plan', sub: 'Your plan is ready. Review the Brief tab, then approve to start execution and unlock this board.', cta: 'Review plan →' }
      : { step: null, title: 'No execution plan yet', sub: 'Once the Planning Agent builds your plan and you approve it, tasks appear here organised by milestone.', cta: 'Chat with Planning Agent →' }

    return (
      <div className="kanban-empty">
        <div className="kanban-empty__icon">▦</div>
        {emptyState.step && <div className="kanban-empty__step">{emptyState.step}</div>}
        <div className="kanban-empty__title">{emptyState.title}</div>
        <div className="kanban-empty__sub">{emptyState.sub}</div>
        {onOpenChat && (
          <button className="kanban-empty__action" onClick={onOpenChat}>
            {emptyState.cta}
          </button>
        )}
      </div>
    )
  }

  const allTasks = phases.flatMap(p => (p.milestones ?? []).flatMap(m => m.tasks ?? []))
  const counts   = COLUMNS.reduce((a, c) => {
    a[c.id] = allTasks.filter(t => t.status === c.id).length
    return a
  }, {})

  return (
    <div className="kanban">
      {/* Summary bar */}
      <div className="kanban__summary">
        <div className="k-stat">
          <span className="k-stat__num" style={{ color: 'var(--text-3)' }}>{counts.todo}</span>
          <span className="k-stat__label" style={{ color: 'var(--text-3)' }}>TODO</span>
        </div>
        <div className="k-stat k-stat--active">
          <span className="k-stat__num">{counts.in_progress}</span>
          <span className="k-stat__label">IN PROGRESS</span>
        </div>
        <div className="k-stat k-stat--done">
          <span className="k-stat__num">{counts.done}</span>
          <span className="k-stat__label">DONE</span>
        </div>
        {counts.blocked > 0 && (
          <div className="k-stat k-stat--blocked">
            <span className="k-stat__num">{counts.blocked}</span>
            <span className="k-stat__label">BLOCKED</span>
          </div>
        )}
        <span className="kanban__hint">drag to move · click status pill to cycle · ✎ to log hours</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {phases.map(phase => (
          <PhaseGroup
            key={phase.id ?? phase.phase_key}
            phase={phase}
            assignmentMap={assignmentMap}
            onUpdateTask={onUpdateTask}
            onAddComment={onAddComment}
            onRunAgent={onRunAgent}
            onSkipAgent={onSkipAgent}
            onViewAgents={onViewAgents}
            onMilestoneComplete={onMilestoneComplete}
            projectStage={projectStage}
          />
        ))}
      </div>
    </div>
  )
}
