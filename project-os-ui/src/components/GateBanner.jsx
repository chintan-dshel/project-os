/**
 * GateBanner.jsx — v0.4
 * Approval gate and gate error banners.
 */
import { useState } from 'react'

const GATE_MESSAGES = {
  GATE_LOW_CONFIDENCE: {
    icon: '◎',
    title: 'Brief needs more clarity',
    hint: 'The confidence score is below 70. Keep chatting with the Intake Agent to refine the brief.',
  },
  GATE_PLAN_NOT_APPROVED: {
    icon: '◎',
    title: 'Plan not yet approved',
    hint: 'Review the execution plan above and approve it to begin execution.',
  },
  GATE_RETRO_REQUIRED: {
    icon: '◫',
    title: 'Milestone retro required',
    hint: 'Complete the milestone retrospective before starting the next milestone.',
  },
  GATE_INVALID_STAGE: {
    icon: '⊘',
    title: 'Action not available at this stage',
    hint: 'This action is not valid for the current project stage.',
  },
}

export function ApprovalGate({ project, onApprove, approving }) {
  const [confirmed, setConfirmed] = useState(false)
  const [notes,     setNotes]     = useState('')
  const [previewed, setPreviewed] = useState(false)

  async function handleApprove() {
    await onApprove(true, notes)
  }

  return (
    <div className="gate-banner gate-banner--approval">
      <div className="gate-banner__header">
        <span className="gate-banner__icon" style={{ color: 'var(--amber)' }}>◎</span>
        <div>
          <div className="gate-banner__title">Execution Plan Ready for Approval</div>
          <div className="gate-banner__sub">
            Review the plan details below, add any notes, then approve to begin execution.
          </div>
        </div>
      </div>

      {/* Plan stats */}
      {(project?.methodology || project?.total_estimated_hours || project?.planned_weeks) && (
        <div className="gate-banner__stats">
          {project.methodology && (
            <div className="gate-stat">
              <span className="gate-stat__label">Methodology</span>
              <span className="gate-stat__value">{project.methodology}</span>
            </div>
          )}
          {project.total_estimated_hours && (
            <div className="gate-stat">
              <span className="gate-stat__label">Total Hours</span>
              <span className="gate-stat__value">{project.total_estimated_hours}h</span>
            </div>
          )}
          {project.planned_weeks && (
            <div className="gate-stat">
              <span className="gate-stat__label">Planned Weeks</span>
              <span className="gate-stat__value">{project.planned_weeks}w</span>
            </div>
          )}
          {project.hours_per_week && (
            <div className="gate-stat">
              <span className="gate-stat__label">Hrs / Week</span>
              <span className="gate-stat__value">{project.hours_per_week}h</span>
            </div>
          )}
        </div>
      )}

      {/* Scope warning */}
      {project?.scope_warning && (
        <div className="gate-banner__scope-warn">{project.scope_warning}</div>
      )}

      {/* Notes textarea */}
      <textarea
        className="gate-banner__notes-input"
        rows={2}
        placeholder="Add approval notes (optional)…"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      <div className="gate-banner__actions">
        <button
          className="gate-btn gate-btn--primary"
          onClick={handleApprove}
          disabled={approving}
        >
          {approving ? 'Approving…' : '✓ Approve & Start Execution'}
        </button>
        <button
          className="gate-btn gate-btn--secondary"
          onClick={() => {}}
          style={{ cursor: 'default' }}
        >
          or chat with Planning Agent to revise ↓
        </button>
      </div>
    </div>
  )
}

export function GateErrorBanner({ gateError, onDismiss }) {
  if (!gateError) return null
  const cfg = GATE_MESSAGES[gateError.code] ?? {
    icon: '⚠',
    title: 'Action blocked',
    hint: gateError.message,
  }

  return (
    <div className="gate-banner gate-banner--error">
      <div className="gate-banner__header">
        <span className="gate-banner__icon" style={{ color: 'var(--red)' }}>{cfg.icon}</span>
        <div>
          <div className="gate-banner__title">{cfg.title}</div>
          <div className="gate-banner__sub">{cfg.hint}</div>
        </div>
        <button className="gate-banner__dismiss" onClick={onDismiss}>✕</button>
      </div>
      {gateError.context && Object.keys(gateError.context).length > 0 && (
        <div className="gate-banner__stats">
          {Object.entries(gateError.context).map(([k, v]) => (
            <div key={k} className="gate-stat">
              <span className="gate-stat__label">{k.replace(/_/g, ' ')}</span>
              <span className="gate-stat__value">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {gateError.redirect && (
        <div className="gate-banner__redirect">
          Return to <strong>{gateError.redirect.replace(/_/g, ' ')}</strong>
        </div>
      )}
    </div>
  )
}
