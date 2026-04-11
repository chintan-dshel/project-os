import { useEffect, useRef } from 'react'
import Chat from '../components/Chat.jsx'
import { ApprovalGate, GateErrorBanner } from '../components/GateBanner.jsx'

// ── Chat Vitals sidebar ───────────────────────────────────────────────────────

function ChatVitals({ project, state }) {
  const allTasks     = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const done         = allTasks.filter(t => t.status === 'done').length
  const total        = allTasks.length
  const highRisks    = (state?.risk_register ?? []).filter(r => r.risk_score >= 7 && r.status === 'open' && !r.description?.startsWith('ASSUMPTION:'))
  const openBlockers = (state?.blockers ?? []).filter(b => !b.resolved)

  const stage = project?.stage
  const AGENT_INFO = {
    intake:            { name: 'Intake Agent',    color: 'var(--blue)',   hint: 'Building your project brief. Answer questions naturally — it will infer what it can.' },
    planning:          { name: 'Planning Agent',  color: 'var(--purple)', hint: 'Generating your execution plan from the brief. Review and confirm when asked.' },
    awaiting_approval: { name: 'Planning Agent',  color: 'var(--amber)',  hint: 'Plan is ready. Review the approval banner above, then approve to start execution.' },
    execution:         { name: 'Execution Agent', color: 'var(--green)',  hint: 'Your daily partner. Tell it what you worked on — it updates the board automatically.' },
    milestone_retro:   { name: 'Retro Agent',     color: 'var(--amber)',  hint: 'Three questions, one at a time. Answer honestly — it will capture the learnings.' },
    ship_retro:        { name: 'Retro Agent',     color: 'var(--amber)',  hint: 'Final debrief. Five questions about what you built, learned, and what goes in v2.' },
    complete:          { name: 'Retro Agent',     color: 'var(--green)',  hint: 'Project is closed. Review your documents in the Docs tab.' },
  }
  const agent = AGENT_INFO[stage] ?? { name: 'Agent', color: 'var(--text-3)', hint: '' }

  return (
    <div className="chat-vitals">
      <div className="chat-vitals__agent" style={{ borderLeftColor: agent.color }}>
        <div className="chat-vitals__agent-name" style={{ color: agent.color }}>{agent.name}</div>
        <div className="chat-vitals__agent-hint">{agent.hint}</div>
      </div>
      <div className="chat-vitals__title">{project?.title ?? 'Project OS'}</div>

      {total > 0 && (
        <div className="cv-section">
          <div className="cv-label">PROGRESS</div>
          <div className="cv-big">{done}/{total}</div>
          <div className="cv-bar">
            <div className="cv-bar-fill" style={{
              width: `${Math.round(done / total * 100)}%`,
              background: done === total ? 'var(--green)' : 'var(--amber)'
            }} />
          </div>
        </div>
      )}

      {project?.momentum_score != null && (
        <div className="cv-section">
          <div className="cv-label">MOMENTUM</div>
          <div className="cv-big" style={{
            color: project.momentum_score >= 60 ? 'var(--green)' : project.momentum_score >= 30 ? 'var(--amber)' : 'var(--red)'
          }}>{project.momentum_score}</div>
        </div>
      )}

      {highRisks.length > 0 && (
        <div className="cv-section">
          <div className="cv-label cv-label--danger">HIGH RISKS</div>
          {highRisks.map(r => (
            <div key={r.id} className="cv-risk">
              <span className="cv-risk__score">{r.risk_score}/9</span>
              <span className="cv-risk__desc">{r.description}</span>
            </div>
          ))}
        </div>
      )}

      {openBlockers.length > 0 && (
        <div className="cv-section">
          <div className="cv-label cv-label--danger">BLOCKERS</div>
          {openBlockers.map(b => (
            <div key={b.id} className="cv-blocker">⊘ {b.description}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chat View — can render as slide-in panel or full view ─────────────────────

export default function ChatView({
  project, state, conversation, sending,
  onSend, chatDisabled, isAwaiting,
  approve, approving, gateError, clearGateError,
  error, isPanel, onClose,
}) {
  const panelRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    if (!isPanel) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPanel, onClose])

  if (isPanel) {
    return (
      <>
        <div className="chat-panel-backdrop" onClick={onClose} />
        <div className="chat-panel" ref={panelRef}>
          <div className="chat-panel__header">
            <div className="chat-panel__title">
              {project?.stage === 'intake' ? 'Intake Agent' :
               project?.stage === 'planning' || project?.stage === 'awaiting_approval' ? 'Planning Agent' :
               project?.stage === 'execution' ? 'Execution Agent' :
               'Retro Agent'}
            </div>
            <button className="chat-panel__close" onClick={onClose}>✕</button>
          </div>
          {isAwaiting && <ApprovalGate project={project} onApprove={approve} approving={approving} />}
          {gateError  && <GateErrorBanner gateError={gateError} onDismiss={clearGateError} />}
          {error      && <div className="error-bar">{error}</div>}
          <div className="chat-panel__body">
            <Chat conversation={conversation} sending={sending} onSend={onSend} disabled={chatDisabled} />
          </div>
        </div>
      </>
    )
  }

  // Full-page fallback (used when navigating to 'chat' view directly)
  return (
    <div className="chat-view">
      <div className="chat-col">
        {isAwaiting && <ApprovalGate project={project} onApprove={approve} approving={approving} />}
        {gateError  && <GateErrorBanner gateError={gateError} onDismiss={clearGateError} />}
        {error      && <div className="error-bar">{error}</div>}
        <Chat conversation={conversation} sending={sending} onSend={onSend} disabled={chatDisabled} />
      </div>
      <div className="chat-right">
        <ChatVitals project={project} state={state} />
      </div>
    </div>
  )
}
