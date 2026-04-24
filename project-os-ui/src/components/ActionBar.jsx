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

export default function ActionBar({ view, project, onNewCard }) {
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
      <div className="ab__spacer" />

      {view === 'dashboard' && (
        <>
          <button className="btn btn--ghost btn--small">Group · milestone</button>
          <button className="btn btn--ghost btn--small">Filter</button>
          <button className="btn btn--dark btn--small" onClick={onNewCard}>+ Card</button>
        </>
      )}
      {view === 'workspace' && (
        <>
          <button className="btn btn--ghost btn--small">Today</button>
          <button className="btn btn--dark btn--small">+ Check-in</button>
        </>
      )}
      {view === 'brief' && (
        <>
          <button className="btn btn--ghost btn--small">History</button>
          <button className="btn btn--ghost btn--small">Export</button>
        </>
      )}
      {view === 'specialists' && (
        <button className="btn btn--ghost btn--small">Logs</button>
      )}
      {view === 'raid' && (
        <button className="btn btn--dark btn--small">+ Item</button>
      )}
      {view === 'docs' && (
        <button className="btn btn--dark btn--small">+ Doc</button>
      )}
    </div>
  )
}
