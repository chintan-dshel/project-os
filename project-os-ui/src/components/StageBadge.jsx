/**
 * components/StageBadge.jsx
 * Visual indicator for the current project stage.
 * Each stage has a color, label, and short description.
 */

const STAGE_CONFIG = {
  intake: {
    label:   'INTAKE',
    desc:    'Defining the project brief',
    color:   'var(--amber)',
    pulse:   true,
  },
  planning: {
    label:   'PLANNING',
    desc:    'Generating execution plan',
    color:   'var(--blue)',
    pulse:   true,
  },
  awaiting_approval: {
    label:   'AWAITING APPROVAL',
    desc:    'Plan ready — founder review required',
    color:   'var(--orange)',
    pulse:   false,
  },
  execution: {
    label:   'EXECUTION',
    desc:    'Active development',
    color:   'var(--green)',
    pulse:   true,
  },
  milestone_retro: {
    label:   'MILESTONE RETRO',
    desc:    'Debrief before next milestone',
    color:   'var(--purple)',
    pulse:   false,
  },
  ship_retro: {
    label:   'SHIP RETRO',
    desc:    'Final project retrospective',
    color:   'var(--purple)',
    pulse:   false,
  },
  complete: {
    label:   'COMPLETE',
    desc:    'Project shipped',
    color:   'var(--green)',
    pulse:   false,
  },
}

export default function StageBadge({ stage }) {
  const cfg = STAGE_CONFIG[stage] ?? {
    label: stage?.toUpperCase() ?? 'UNKNOWN',
    desc:  'Unknown stage',
    color: 'var(--muted)',
    pulse: false,
  }

  return (
    <div className="stage-badge">
      <div className="stage-badge__dot-wrap">
        <span
          className={`stage-badge__dot${cfg.pulse ? ' stage-badge__dot--pulse' : ''}`}
          style={{ background: cfg.color }}
        />
      </div>
      <div className="stage-badge__text">
        <span className="stage-badge__label" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span className="stage-badge__desc">{cfg.desc}</span>
      </div>
    </div>
  )
}
