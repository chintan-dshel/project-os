import { useState, useEffect } from 'react'
import {
  delegateTask, approveOutput, rejectOutput, reviseOutput, listSpecialistOutputs,
  listAssignments, updateAssignment, runAssignment, analyzeAssignments,
  listRegistry,
} from '../lib/api.js'

const SP_STATUS = {
  pending:  { label: 'Running…',        color: 'var(--text-3)', bg: 'var(--bg-4)' },
  complete: { label: 'Awaiting review', color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  approved: { label: 'Approved',        color: 'var(--green)',  bg: 'var(--green-bg)' },
  rejected: { label: 'Rejected',        color: 'var(--red)',    bg: 'var(--red-bg)' },
  revised:  { label: 'Revised',         color: 'var(--purple)', bg: 'rgba(155,114,232,.1)' },
}

const ASSIGN_STATUS = {
  pending_review:   { label: 'Needs review', color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  approved:         { label: 'Approved',     color: 'var(--blue)',   bg: 'var(--blue-bg)' },
  running:          { label: 'Running…',     color: 'var(--text-3)', bg: 'var(--bg-4)' },
  completed:        { label: 'Done',         color: 'var(--green)',  bg: 'var(--green-bg)' },
  rejected:         { label: 'Rejected',     color: 'var(--red)',    bg: 'var(--red-bg)' },
  assigned_to_user: { label: 'Your task',    color: 'var(--text-2)', bg: 'var(--bg-4)' },
}

function renderMd(md) {
  if (!md) return null
  return md.split('\n').map((line, i) => {
    if (line.startsWith('# '))   return <h1 key={i} className="doc-h1">{line.slice(2)}</h1>
    if (line.startsWith('## '))  return <h2 key={i} className="doc-h2">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="doc-h3">{line.slice(4)}</h3>
    if (line.startsWith('> '))   return <blockquote key={i} className="doc-quote">{line.slice(2)}</blockquote>
    if (line.startsWith('- '))   return <li key={i} className="doc-li">{line.slice(2)}</li>
    if (line.startsWith('---'))  return <hr key={i} className="doc-hr" />
    if (line.trim() === '')      return <div key={i} style={{ height: 6 }} />
    const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, "<code style='font-family:var(--mono);background:var(--bg-4);padding:1px 5px;border-radius:3px;font-size:12px'>$1</code>")
    return <p key={i} className="doc-p" dangerouslySetInnerHTML={{ __html: html }} />
  })
}

function CodeOutput({ content, language }) {
  const [copied, setCopied] = useState(false)
  const parts  = content.split(/(```\w*\n?)/g)
  const blocks = []
  let inCode = false, lang = language || 'code'
  parts.forEach(p => {
    if (p.startsWith('```') && !inCode) { inCode = true; lang = p.slice(3).trim() || language || 'code'; return }
    if (p.startsWith('```') &&  inCode) { inCode = false; return }
    if (inCode)  blocks.push({ type: 'code', lang, text: p })
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

// ── Pending Assignment Card ───────────────────────────────────────────────────

function AssignmentCard({ assignment, registryAgents, projectId, onDone }) {
  const [prompt,   setPrompt]   = useState(assignment.user_edited_prompt ?? assignment.suggested_prompt ?? '')
  const [running,  setRunning]  = useState(false)
  const [err,      setErr]      = useState(null)

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
  async function reject() {
    try { await updateAssignment(projectId, assignment.id, { status: 'rejected' }); onDone() }
    catch (e) { setErr(e.message) }
  }

  return (
    <div className="assignment-card">
      <div className="assignment-card__header">
        <span className="assignment-card__icon">{agent?.icon ?? '★'}</span>
        <div className="assignment-card__meta">
          <div className="assignment-card__task">{assignment.task_key}</div>
          <div className="assignment-card__agent">{agent?.name ?? 'Agent'}</div>
        </div>
        <span className="sp-status-badge" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      </div>
      {assignment.analysis_reason && (
        <div className="assignment-card__reason">{assignment.analysis_reason}</div>
      )}
      {assignment.status === 'pending_review' && (
        <>
          <div className="assignment-card__prompt-label">Review & edit the agent brief before running:</div>
          <textarea
            className="assignment-card__prompt"
            rows={4}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          <div className="assignment-card__actions">
            <button className="sp-act sp-act--approve" onClick={approve} disabled={running || !prompt.trim()}>
              {running ? <><span className="sp-spinner" />Running…</> : `→ Run ${agent?.name ?? 'Agent'}`}
            </button>
            <button className="sp-act sp-act--reject" onClick={reject} disabled={running}>✕ Skip</button>
            {err && <span className="sp-error">{err}</span>}
          </div>
        </>
      )}
      {assignment.status === 'assigned_to_user' && (
        <div className="assignment-card__user-note">
          No agent is suitable for this task — it needs your direct attention.
        </div>
      )}
    </div>
  )
}

// ── Delegate Form (manual) ────────────────────────────────────────────────────

function DelegateForm({ projectId, state, registryAgents, onDone }) {
  const [selAgent, setSelAgent] = useState(null)
  const [selTask,  setSelTask]  = useState('')
  const [brief,    setBrief]    = useState('')
  const [running,  setRunning]  = useState(false)
  const [err,      setErr]      = useState(null)

  const allTasks = (state?.phases ?? []).flatMap(p => (p.milestones ?? []).flatMap(m => (m.tasks ?? []).map(t => ({ ...t, milestone: m.title }))))
  const activeAgents = registryAgents.filter(a => a.is_active)

  async function submit() {
    if (!selAgent || !selTask || !brief.trim()) return
    setRunning(true); setErr(null)
    try { await delegateTask(projectId, selTask, selAgent, brief.trim()); onDone() }
    catch (e) { setErr(e.message) } finally { setRunning(false) }
  }

  const selectedInfo = activeAgents.find(a => a.slug === selAgent)

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
          {allTasks.map(t => <option key={t.task_key} value={t.task_key}>{t.title} · {t.milestone} ({t.status})</option>)}
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

// ── Output Viewer ─────────────────────────────────────────────────────────────

function OutputViewer({ output, projectId, registryAgents, onAction }) {
  const [feedback,  setFeedback]  = useState('')
  const [revision,  setRevision]  = useState('')
  const [mode,      setMode]      = useState(null)
  const [acting,    setActing]    = useState(false)
  const [err,       setErr]       = useState(null)

  const cfg      = SP_STATUS[output.status] ?? SP_STATUS.pending
  const typeInfo = registryAgents.find(a => a.slug === (output.registry_agent_slug ?? output.specialist_type)) ?? { name: output.specialist_type, icon: '★' }
  const isCode   = output.output_format === 'code'
  const canAct   = output.status === 'complete'

  async function doApprove() { setActing(true); setErr(null); try { await approveOutput(projectId, output.id); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }
  async function doReject()  { if (!feedback.trim()) return; setActing(true); setErr(null); try { await rejectOutput(projectId, output.id, feedback); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }
  async function doRevise()  { if (!revision.trim()) return; setActing(true); setErr(null); try { await reviseOutput(projectId, output.id, revision); onAction() } catch (e) { setErr(e.message) } finally { setActing(false) } }

  return (
    <div className="sp-output-viewer">
      <div className="sp-ov-header">
        <span style={{ fontSize: 22 }}>{typeInfo.icon ?? '★'}</span>
        <div className="sp-ov-header__meta">
          <div className="sp-ov-header__name">{typeInfo.name}</div>
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
          <div className="sp-ov-label">OUTPUT</div>
          {isCode ? <CodeOutput content={output.output} language={output.language} /> : <div className="sp-ov-prose">{renderMd(output.output)}</div>}
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

// ── Specialists View (main) ───────────────────────────────────────────────────

export default function SpecialistsView({ projectId, project, state, refresh }) {
  const [outputs,       setOutputs]       = useState([])
  const [assignments,   setAssignments]   = useState([])
  const [registryAgents,setRegistryAgents]= useState([])
  const [loading,       setLoading]       = useState(true)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [selected,      setSelected]      = useState(null)
  const [showDelegate,  setShowDelegate]  = useState(false)
  const [filter,        setFilter]        = useState('all')
  const [err,           setErr]           = useState(null)

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
        setErr('Analysis ran but all tasks were assigned to you (no suitable agents found). Check the Marketplace to add more specialist agents.')
      }
    }
    catch (e) { setErr(e.message) } finally { setAnalyzing(false) }
  }

  const hasTasks  = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? []).length > 0
  const pending   = assignments.filter(a => a.status === 'pending_review' || a.status === 'assigned_to_user')
  const filtered  = filter === 'all' ? outputs : outputs.filter(o => o.status === filter)
  const selOutput = outputs.find(o => o.id === selected)
  const counts    = { all: outputs.length, complete: outputs.filter(o => o.status === 'complete').length, approved: outputs.filter(o => o.status === 'approved').length, rejected: outputs.filter(o => o.status === 'rejected').length }

  if (!hasTasks) return (
    <div className="view-empty">
      <div className="view-empty__icon">🤖</div>
      <div className="view-empty__title">Specialist Agents</div>
      <div className="view-empty__sub">Specialist agents are available once your execution plan is approved.</div>
    </div>
  )

  return (
    <div className="sp-view">
      <div className="sp-list-col">
        <div className="sp-list-header">
          <div className="sp-list-title">
            Agent Tasks
            {pending.length > 0 && <span className="sp-assignments-badge" style={{ marginLeft: 8 }}>{pending.length}</span>}
          </div>
          <button className="sp-new-btn" onClick={handleAnalyze} disabled={analyzing} title="Analyse tasks and auto-suggest agents">
            {analyzing ? '⟳ Analysing…' : '⟳ Auto-assign'}
          </button>
          <button className="sp-new-btn" onClick={() => { setShowDelegate(true); setSelected(null) }}>+ Delegate</button>
        </div>

        {err && <div className="sp-error" style={{ margin: '6px 12px' }}>{err}</div>}

        {loading
          ? <div className="sp-list-empty">Loading…</div>
          : (
            <div className="sp-list">
              {/* ── Pending assignments (review + run) ── */}
              {pending.length > 0 && (
                <>
                  <div className="sp-section-label">NEEDS REVIEW</div>
                  {pending.map(a => (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      registryAgents={registryAgents}
                      projectId={projectId}
                      onDone={() => { load(); refresh() }}
                    />
                  ))}
                  {outputs.length > 0 && <div className="sp-section-label" style={{ marginTop: 8 }}>PAST DELEGATIONS</div>}
                </>
              )}

              {/* ── Past delegation outputs ── */}
              {outputs.length === 0 && pending.length === 0 && (
                <div className="sp-list-empty">
                  No agent work yet. Click "⟳ Auto-assign" to analyse your task list, or "+ Delegate" to assign a task manually.
                </div>
              )}
              {filtered.map(o => {
                const cfg      = SP_STATUS[o.status] ?? SP_STATUS.pending
                const agentInfo = registryAgents.find(a => a.slug === (o.registry_agent_slug ?? o.specialist_type)) ?? { name: o.specialist_type, icon: '★' }
                return (
                  <button key={o.id} className={`sp-list-item${selected === o.id ? ' sp-list-item--active' : ''}`}
                    onClick={() => { setSelected(o.id); setShowDelegate(false) }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{agentInfo.icon}</span>
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

      <div className="sp-content-col">
        {showDelegate && <DelegateForm projectId={projectId} state={state} registryAgents={registryAgents} onDone={() => { setShowDelegate(false); load(); refresh() }} />}
        {!showDelegate && selOutput && <OutputViewer output={selOutput} projectId={projectId} registryAgents={registryAgents} onAction={() => { load(); refresh() }} />}
        {!showDelegate && !selOutput && (
          <div className="view-empty">
            <div className="view-empty__icon">🤖</div>
            <div className="view-empty__title">Agents</div>
            <div className="view-empty__sub">
              {pending.length > 0
                ? `${pending.length} task${pending.length > 1 ? 's' : ''} waiting for your review. Select one on the left to edit the brief and run the agent.`
                : outputs.length > 0
                  ? 'Select a past delegation to review its output.'
                  : 'Click "⟳ Auto-assign" to analyse your task list — the system will suggest which agents can handle which tasks. You approve every brief before anything runs.'}
            </div>
            {pending.length === 0 && outputs.length === 0 && (
              <button className="guided-card__btn" style={{ marginTop: 16 }} onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? 'Analysing…' : '⟳ Auto-assign tasks →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
