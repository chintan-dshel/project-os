const STAGE_STEPS = [
  { id: 'intake',            label: 'Intake' },
  { id: 'planning',          label: 'Planning' },
  { id: 'awaiting_approval', label: 'Approval' },
  { id: 'execution',         label: 'Execution' },
  { id: 'milestone_retro',   label: 'Retro' },
  { id: 'ship_retro',        label: 'Ship' },
  { id: 'complete',          label: 'Done' },
]

export default function StageTimeline({ stage }) {
  const cur = STAGE_STEPS.findIndex(s => s.id === stage)
  return (
    <div className="stage-timeline">
      {STAGE_STEPS.map((step, i) => {
        const done   = i < cur
        const active = i === cur
        return (
          <div key={step.id} className={`st-step${active ? ' st-step--active' : done ? ' st-step--done' : ''}`}>
            <div className="st-node">
              <div className="st-dot">
                {done   && <span className="st-dot__check">✓</span>}
                {active && <span className="st-dot__pulse" />}
              </div>
              <span className="st-label">{step.label}</span>
            </div>
            {i < STAGE_STEPS.length - 1 && (
              <div className={`st-line${done ? ' st-line--done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
