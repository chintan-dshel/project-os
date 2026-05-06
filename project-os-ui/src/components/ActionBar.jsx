import { Fragment } from 'react'

const STAGES = [
  { id: 'intake',   label: 'Intake',   backendStages: ['intake'] },
  { id: 'plan',     label: 'Plan',     backendStages: ['planning', 'awaiting_approval'] },
  { id: 'execute',  label: 'Execute',  backendStages: ['execution', 'milestone_retro'] },
  { id: 'closeout', label: 'Closeout', backendStages: ['ship_retro', 'complete'] },
]

const VIEW_TITLES = {
  brief: 'Brief', dashboard: 'Kanban', workspace: 'Workroom', raid: 'RAID Log',
  docs: 'Documents', specialists: 'Agents', telemetry: 'Cost & Latency',
  marketplace: 'Marketplace', analytics: 'EVM', knowledge: 'Knowledge Hub',
}

function getActiveStageIdx(backendStage) {
  if (!backendStage) return -1
  return STAGES.findIndex(s => s.backendStages.includes(backendStage))
}

export default function ActionBar({ view, project }) {
  const activeIdx = getActiveStageIdx(project?.stage)

  return (
    <div className="ab">
      <div className="ab__stages">
        {STAGES.map((s, i) => {
          const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending'
          return (
            <Fragment key={s.id}>
              <button className={`ab__stage ab__stage--${state}`}>
                <span className="ab__stage-dot" />
                {s.label}
              </button>
              {i < STAGES.length - 1 && <span className="ab__stage-arrow">›</span>}
            </Fragment>
          )
        })}
      </div>

      <div className="ab__view">{VIEW_TITLES[view] ?? view}</div>
    </div>
  )
}
