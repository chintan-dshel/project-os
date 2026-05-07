import { useState, useEffect } from 'react'
import {
  delegateTask, approveOutput, rejectOutput, reviseOutput, listSpecialistOutputs,
  listAssignments, updateAssignment, runAssignment, analyzeAssignments,
  listRegistry, fetchBudgets, upsertBudget, pauseAgents, resumeAgents,
} from '../lib/api.js'
import { renderMd } from '../lib/renderMd.jsx'

// ── Budget strip ──────────────────────────────────────────────────────────────

function BudgetStrip({ projectId }) {
  const [data, setData]       = useState(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    fetchBudgets(projectId).then(setData).catch(() => {})
  }, [projectId])

  if (!data) return null

  async function toggleKill() {
    setWorking(true)
    try {
      await (data.paused ? resumeAgents(projectId) : pauseAgents(projectId, 'Manual pause from Agents view'))
      setData(await fetchBudgets(projectId))
    } catch (e) { console.error(e) }
    finally { setWorking(false) }
  }

  return (
    <div className="ag-budget">
      <div className="ag-budget__row">
        <span className="ag-budget__label">Agent Spend</span>
        <div style={{ flex: 1 }} />
        <button
          className={`ag-budget__kill${data.paused ? ' ag-budget__kill--paused' : ''}`}
          onClick={toggleKill} disabled={working}
        >
          {working ? '…' : data.paused ? '▶ Resume agents' : '⏸ Pause all'}
        </button>
      </div>
      {data.paused && (
        <div className="ag-budget__paused-banner">All agents are paused. No new calls will be made until you resume.</div>
      )}
      {data.budgets.length > 0 && (
        <div className="ag-budget__items">
          {data.budgets.map(b => {
            const pct = b.monthly_limit_usd
              ? Math.min(100, (parseFloat(b.spent_month_usd) / parseFloat(b.monthly_limit_usd)) * 100)
              : null
            return (
              <div key={b.id} className="ag-budget__item">
                <span className="ag-budget__slug">{b.agent_slug}</span>
                <span className="ag-budget__spent">${parseFloat(b.spent_month_usd).toFixed(3)}</span>
                {b.monthly_limit_usd && (
                  <>
                    <div className="ag-budget__bar">
                      <div className="ag-budget__bar-fill" style={{
                        width: `${pct}%`,
                        background: pct > 80 ? 'var(--red)' : pct > 50 ? 'var(--amber)' : 'var(--teal)',
                      }} />
                    </div>
                    <span className="ag-budget__limit">${parseFloat(b.monthly_limit_usd).toFixed(0)}/mo</span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Status config ─────────────────────────────────────────────────────────────

const SP_STATUS = {
  pending:        { label: 'Running…',      color: 'var(--text-3)', bg: 'var(--bg-4)' },
  complete:       { label: 'Needs review',  color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  approved:       { label: 'Approved',      color: 'var(--green)',  bg: 'var(--green-bg)' },
  rejected:       { label: 'Rejected',      color: 'var(--red)',    bg: 'var(--red-bg)' },
  revised:        { label: 'Revised',       color: 'var(--blue)',   bg: 'var(--blue-bg)' },
}

const ASSIGN_STATUS = {
  pending_review:   { label: 'Needs review', color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  approved:         { label: 'Approved',     color: 'var(--blue)',   bg: 'var(--blue-bg)' },
  running:          { label: 'Running…',     color: 'var(--text-3)', bg: 'var(--bg-4)' },
  completed:        { label: 'Done',         color: 'var(--green)',  bg: 'var(--green-bg)' },
  rejected:         { label: 'Rejected',     color: 'var(--red)',    bg: 'var(--red-bg)' },
  assigned_to_user: { label: 'Your task',    color: 'var(--text-2)', bg: 'var(--bg-4)' },
}

// ── Code block renderer ───────────────────────────────────────────────────────

function CodeOutput({ content, language }) {
  const [copied, setCopied] = useState(false)
  const parts  = content.split(/(```\w*\n?)/g)
  const blocks = []
  let inCode = false, lang = language || 'code'
  parts.forEach(p => {
    if (p.startsWith('```') && !inCode) { inCode = true; lang = p.slice(3).trim() || language || 'code'; return }
    if (p.startsWith('```') &&  inCode) { inCode = false; return }
    if (inCode)      blocks.push({ type: 'code',  lang, text: p })
    else if (p.trim()) blocks.push({ type: 'prose', text: p })
  })
  function copyAll() {
    const code = blocks.filter(b => b.type === 'code').map(b => b.text).join('\n\n')
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="sp-code-output">
      <div className="sp-code-output__toolbar">
        <span className="sp-code-output__lang">{lang}</span>
        <button className="sp-code-output__copy" onClick={copyAll}>{copied ? '✓ Copied' : '⎘ Copy all'}</button>
      </div>
      {blocks.map((b, i) => b.type === 'code'
        ? <pre key={i} className="sp-code-pre"><code>{b.text.replace(/\n$/, '')}</code></pre>
        : <div key={i} className="sp-code-prose">{renderMd(b.text)}</div>
      )}
    </div>
  )
}

// ── Assignment review panel (right-side detail for pending items) ─────────────

function AssignmentPanel({ assignment, registryAgents, projectId, onDone }) {
  const [prompt,  setPrompt]  = useState(assignment.user_edited_prompt ?? assignment.suggested_prompt ?? '')
  const [running, setRunning] = useState(false)
  const [err,     setErr]     = useState(null)

  const agent = registryAgents.find(a => a.id === assignment.registry_agent_id)
  const cfg   = ASSIGN_STATUS[assignment.status] ?? ASSIGN_STATUS.pending_review

  async function approve() {
    setRunning(true); setErr(null)
    try {
      await updateAssignment(projectId, assignment.id, { status: 'approved', user_edited_prompt: prompt })
      await runAssignment(projectId, assignment.id)
      onDone()
    } catch (e) { setErr(e.message) } finally { setRunning(false) }
  }
  async function skip() {
    try { await updateAssignment(projectId, assignment.id, { status: 'rejected' }); onDone() }
    catch (e) { setErr(e.message) }
  }

  return (
    <div className="sp-assign-panel">
      <div className="sp-assign-panel__head">
        <div className="sp-assign-panel__agent">
          <span className="sp-assign-panel__icon">{agent?.icon ?? '★'}</span>
          <div>
            <div className="sp-assign-panel__agent-name">{agent?.name ?? 'Agent'}</div>
            <div className="sp-assign-panel__task">{assignment.task_key}</div>
          </div>
        </div>
        <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      </div>

      {assignment.analysis_reason && (
        <div className="sp-assign-panel__reason">
          <span className="sp-ov-label">WHY THIS AGENT</span>
          <p>{assignment.analysis_reason}</p>
        </div>
      )}

      {assignment.status === 'assigned_to_user' ? (
        <div className="sp-assign-panel__user-note">
          No agent is suitable for this task — it needs your direct attention.
        </div>
      ) : (
        <>
          <div className="sp-assign-panel__brief-section">
            <div className="sp-ov-label">AGENT BRIEF — review and edit before running</div>
            <textarea
              className="sp-assign-panel__textarea"
              rows={6}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
          <div className="sp-assign-panel__actions">
            <button className="sp-act sp-act--approve" onClick={approve} disabled={running || !prompt.trim()}>
              {running ? <><span className="sp-spinner" />Running…</> : `→ Run ${agent?.name ?? 'Agent'}`}
            </button>
            <button className="sp-act sp-act--reject" onClick={skip} disabled={running}>✕ Skip task</button>
            {err && <span className="sp-error">{err}</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Output viewer (right-side detail for past outputs) ────────────────────────

function OutputViewer({ output, projectId, registryAgents, onAction }) {
  const [feedback, setFeedback] = useState('')
  const [revision, setRevision] = useState('')
  const [mode,     setMode]     = useState(null)
  const [acting,   setActing]   = useState(false)
  const [err,      setErr]      = useState(null)

  const cfg      = SP_STATUS[output.status] ?? SP_STATUS.pending
  const agentInfo = registryAgents.find(a => a.slug === (output.registry_agent_slug ?? output.specialist_type)) ?? { name: output.specialist_type, icon: '★' }
  const isCode   = output.output_format === 'code'
  const canAct   = output.status === 'complete'
  const [copied, setCopied] = useState(false)

  function copyOutput() {
    if (!output.output) return
    navigator.clipboard.writeText(output.output).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  async function doApprove() { setActing(true); setErr(null); try { await approveOutput(projectId, output.id); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }
  async function doReject()  { if (!feedback.trim()) return; setActing(true); setErr(null); try { await rejectOutput(projectId, output.id, feedback); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }
  async function doRevise()  { if (!revision.trim()) return; setActing(true); setErr(null); try { await reviseOutput(projectId, output.id, revision); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }

  return (
    <div className="sp-output-viewer">
      <div className="sp-ov-header">
        <span style={{ fontSize: 22 }}>{agentInfo.icon ?? '★'}</span>
        <div className="sp-ov-header__meta">
          <div className="sp-ov-header__name">{agentInfo.name}</div>
          <div className="sp-ov-header__task">{output.task_title ?? output.task_key}</div>
        </div>
        <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      </div>

      <div className="sp-ov-section">
        <div className="sp-ov-label">BRIEF</div>
        <div className="sp-ov-brief">{output.brief}</div>
      </div>

      {output.output && (
        <div className="sp-ov-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="sp-ov-label" style={{ flex: 1 }}>OUTPUT</div>
            {!isCode && (
              <button className="sp-ov-copy" onClick={copyOutput}>
                {copied ? '✓ Copied' : '⎘ Copy'}
              </button>
            )}
          </div>
          {isCode
            ? <CodeOutput content={output.output} language={output.language} />
            : <div className="sp-ov-prose">{renderMd(output.output)}</div>}
        </div>
      )}

      {canAct && (
        <div className="sp-ov-section">
          <div className="sp-ov-label">REVIEW</div>
          {!mode && (
            <div className="sp-review-btns">
              <button className="sp-act sp-act--approve" onClick={doApprove} disabled={acting}>✓ Approve</button>
              <button className="sp-act sp-act--revise"  onClick={() => setMode('revise')} disabled={acting}>↺ Request revision</button>
              <button className="sp-act sp-act--reject"  onClick={() => setMode('reject')} disabled={acting}>✕ Reject</button>
            </div>
          )}
          {mode === 'revise' && (
            <div className="sp-feedback-block">
              <div className="sp-ov-label">What needs to change?</div>
              <textarea className="sp-feedback-input" rows={3} value={revision} onChange={e => setRevision(e.target.value)} placeholder="e.g. Add error handling for network timeouts." />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="sp-act sp-act--approve" onClick={doRevise} disabled={!revision.trim() || acting}>↺ Run revision</button>
                <button className="sp-act" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </div>
          )}
          {mode === 'reject' && (
            <div className="sp-feedback-block">
              <div className="sp-ov-label">Why is this being rejected?</div>
              <textarea className="sp-feedback-input" rows={2} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Brief reason…" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="sp-act sp-act--reject" onClick={doReject} disabled={!feedback.trim() || acting}>✕ Confirm rejection</button>
                <button className="sp-act" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </div>
          )}
          {err && <div className="sp-error" style={{ marginTop: 8 }}>{err}</div>}
        </div>
      )}
    </div>
  )
}

// ── Delegate form ─────────────────────────────────────────────────────────────

function DelegateForm({ projectId, state, registryAgents, onDone }) {
  const [selAgent, setSelAgent] = useState(null)
  const [selTask,  setSelTask]  = useState('')
  const [brief,    setBrief]    = useState('')
  const [running,  setRunning]  = useState(false)
  const [err,      setErr]      = useState(null)

  const allTasks    = (state?.phases ?? []).flatMap(p => (p.milestones ?? []).flatMap(m => (m.tasks ?? []).map(t => ({ ...t, milestone: m.title }))))
  const activeAgents = registryAgents.filter(a => a.is_active)
  const selectedInfo = activeAgents.find(a => a.slug === selAgent)

  async function submit() {
    if (!selAgent || !selTask || !brief.trim()) return
    setRunning(true); setErr(null)
    try { await delegateTask(projectId, selTask, selAgent, brief.trim()); onDone() }
    catch (e) { setErr(e.message) } finally { setRunning(false) }
  }

  return (
    <div className="sp-delegate-form">
      <div className="sp-form-title">Delegate a task to a specialist agent</div>

      <div className="sp-form-step">
        <div className="sp-form-step__label">1 — Choose the specialist</div>
        <div className="sp-type-grid">
          {activeAgents.map(a => (
            <button key={a.slug} className={`sp-type-card${selAgent === a.slug ? ' sp-type-card--sel' : ''}`}
              onClick={() => setSelAgent(a.slug)}>
              <span style={{ fontSize: 20 }}>{a.icon ?? '★'}</span>
              <span className="sp-type-card__name">{a.name}</span>
              <span className="sp-type-card__desc">{a.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sp-form-step">
        <div className="sp-form-step__label">2 — Which task?</div>
        <select className="sp-select" value={selTask} onChange={e => setSelTask(e.target.value)}>
          <option value="">Select a task…</option>
          {allTasks.map(t => (
            <option key={t.task_key} value={t.task_key}>{t.title} · {t.milestone} ({t.status})</option>
          ))}
        </select>
      </div>

      <div className="sp-form-step">
        <div className="sp-form-step__label">3 — Brief the agent</div>
        <textarea className="sp-brief-input" rows={5} value={brief} onChange={e => setBrief(e.target.value)}
          placeholder="Describe exactly what you need the agent to produce — include tech stack, constraints, audience, or context." />
      </div>

      <div className="sp-form-step" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <button className="sp-run-btn" onClick={submit} disabled={!selAgent || !selTask || !brief.trim() || running}>
          {running ? <><span className="sp-spinner" />Running agent…</> : `→ Run ${selectedInfo?.name ?? 'Agent'}`}
        </button>
        {err && <span className="sp-error">{err}</span>}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function SpecialistsView({ projectId, project, state, refresh }) {
  const [outputs,        setOutputs]        = useState([])
  const [assignments,    setAssignments]     = useState([])
  const [registryAgents, setRegistryAgents] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [analyzing,      setAnalyzing]      = useState(false)
  const [selection,      setSelection]      = useState(null) // { type: 'assignment'|'output'|'delegate', id? }
  const [err,            setErr]            = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [outp, assigns, reg] = await Promise.all([
        listSpecialistOutputs(projectId),
        listAssignments(projectId).catch(() => ({ assignments: [] })),
        listRegistry(true).catch(() => ({ agents: [] })),
      ])
      setOutputs(outp.outputs ?? [])
      setAssignments(assigns.assignments ?? [])
      setRegistryAgents(reg.agents ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [projectId])

  async function handleAnalyze() {
    setAnalyzing(true); setErr(null)
    try {
      const result = await analyzeAssignments(projectId)
      await load(); refresh()
      if (result.reason === 'no_unassigned_tasks') {
        setErr('All tasks are already assigned or complete — nothing to analyze.')
      } else if (result.reason === 'no_active_agents') {
        setErr('No active agents in the registry. Add agents in the Marketplace first.')
      } else if (result.created?.length === 0 && !result.skipped) {
        setErr('Analysis ran but all tasks were assigned to you — no suitable agents found.')
      }
    }
    catch (e) { setErr(e.message) } finally { setAnalyzing(false) }
  }

  const hasTasks = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? []).length > 0
  const pending  = assignments.filter(a => a.status === 'pending_review' || a.status === 'assigned_to_user')

  const selAssignment = selection?.type === 'assignment' ? assignments.find(a => a.id === selection.id) : null
  const selOutput     = selection?.type === 'output'     ? outputs.find(o => o.id === selection.id)     : null
  const showDelegate  = selection?.type === 'delegate'

  if (!hasTasks) return (
    <div className="view-empty">
      <div className="view-empty__icon">◎</div>
      <div className="view-empty__title">Specialist Agents</div>
      <div className="view-empty__sub">Specialist agents are available once your execution plan is approved.</div>
    </div>
  )

  const reviewTitle = selAssignment
    ? (registryAgents.find(a => a.id === selAssignment.registry_agent_id)?.name ?? 'Agent') + ' — ' + selAssignment.task_key
    : selOutput
      ? (registryAgents.find(a => a.slug === (selOutput.registry_agent_slug ?? selOutput.specialist_type))?.name ?? selOutput.specialist_type) + ' — ' + (selOutput.task_title ?? selOutput.task_key)
      : ''

  return (
    <div className="sp-view">
      <BudgetStrip projectId={projectId} />

      {/* ── Full-width agent list ── */}
      <div className="sp-list-col sp-list-col--full">
        <div className="sp-list-header">
          <div className="sp-list-title">
            Agents
            {pending.length > 0 && <span className="sp-assignments-badge" style={{ marginLeft: 8 }}>{pending.length}</span>}
          </div>
          <button className="sp-new-btn sp-new-btn--secondary" onClick={handleAnalyze} disabled={analyzing} title="Analyse tasks and suggest agents">
            {analyzing ? '⟳ Analysing…' : '⟳ Auto-assign'}
          </button>
          <button className="sp-new-btn" onClick={() => setSelection({ type: 'delegate' })}>+ Delegate</button>
        </div>

        {err && <div className="sp-error" style={{ margin: '6px 12px 0' }}>{err}</div>}

        {loading
          ? <div className="sp-list-empty">Loading…</div>
          : (
            <div className="sp-list">
              {/* Pending review section */}
              {pending.length > 0 && (
                <>
                  <div className="sp-section-label">NEEDS REVIEW ({pending.length})</div>
                  {pending.map(a => {
                    const agent = registryAgents.find(r => r.id === a.registry_agent_id)
                    const cfg   = ASSIGN_STATUS[a.status] ?? ASSIGN_STATUS.pending_review
                    const isActive = selection?.type === 'assignment' && selection.id === a.id
                    return (
                      <button key={a.id} className={`sp-list-item${isActive ? ' sp-list-item--active' : ''}`}
                        onClick={() => setSelection({ type: 'assignment', id: a.id })}>
                        <span className="sp-list-item__icon">{agent?.icon ?? '★'}</span>
                        <div className="sp-list-item__body">
                          <div className="sp-list-item__task">{a.task_key}</div>
                          <div className="sp-list-item__type">{agent?.name ?? 'Agent'}</div>
                        </div>
                        <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg, fontSize: 9 }}>{cfg.label}</span>
                      </button>
                    )
                  })}
                  {outputs.length > 0 && <div className="sp-section-label" style={{ marginTop: 8 }}>PAST WORK</div>}
                </>
              )}

              {/* Past outputs */}
              {outputs.length === 0 && pending.length === 0 && (
                <div className="sp-list-empty">
                  No agent work yet. Click "⟳ Auto-assign" to analyse your task list, or "+ Delegate" to assign a task manually.
                </div>
              )}
              {outputs.map(o => {
                const cfg       = SP_STATUS[o.status] ?? SP_STATUS.pending
                const agentInfo = registryAgents.find(a => a.slug === (o.registry_agent_slug ?? o.specialist_type)) ?? { name: o.specialist_type, icon: '★' }
                const isActive  = selection?.type === 'output' && selection.id === o.id
                return (
                  <button key={o.id} className={`sp-list-item${isActive ? ' sp-list-item--active' : ''}`}
                    onClick={() => setSelection({ type: 'output', id: o.id })}>
                    <span className="sp-list-item__icon">{agentInfo.icon}</span>
                    <div className="sp-list-item__body">
                      <div className="sp-list-item__task">{o.task_title ?? o.task_key}</div>
                      <div className="sp-list-item__type">{agentInfo.name}</div>
                    </div>
                    <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg, fontSize: 9 }}>{cfg.label}</span>
                  </button>
                )
              })}
            </div>
          )
        }
      </div>

      {/* ── Delegate modal ── */}
      {showDelegate && (
        <div className="sp-review-modal" onClick={e => { if (e.target === e.currentTarget) setSelection(null) }}>
          <div className="sp-review-modal__inner">
            <div className="sp-review-modal__bar">
              <span className="sp-review-modal__title">Delegate a task to a specialist agent</span>
              <button className="sp-review-modal__close" onClick={() => setSelection(null)}>✕ Close</button>
            </div>
            <div className="sp-review-modal__body">
              <DelegateForm
                projectId={projectId}
                state={state}
                registryAgents={registryAgents}
                onDone={() => { setSelection(null); load(); refresh() }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Review modal ── */}
      {(selAssignment || selOutput) && (
        <div className="sp-review-modal" onClick={e => { if (e.target === e.currentTarget) setSelection(null) }}>
          <div className="sp-review-modal__inner">
            <div className="sp-review-modal__bar">
              <span className="sp-review-modal__title">{reviewTitle}</span>
              <button className="sp-review-modal__close" onClick={() => setSelection(null)}>✕ Close</button>
            </div>
            <div className="sp-review-modal__body">
              {selAssignment && (
                <AssignmentPanel
                  key={selAssignment.id}
                  assignment={selAssignment}
                  registryAgents={registryAgents}
                  projectId={projectId}
                  onDone={() => { setSelection(null); load(); refresh() }}
                />
              )}
              {selOutput && (
                <OutputViewer
                  key={selOutput.id}
                  output={selOutput}
                  projectId={projectId}
                  registryAgents={registryAgents}
                  onAction={() => { load(); refresh() }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
