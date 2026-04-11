// SideNav — stage-aware sidebar navigation
// Structure: NOW (stage-contextual) → PROJECT (persistent) → ANALYTICS → SETTINGS

const PROJECT_ITEMS = [
  { id: 'brief',       icon: '□',  label: 'Brief' },
  { id: 'dashboard',   icon: '▦',  label: 'Kanban' },
  { id: 'workspace',   icon: '◫',  label: 'Workspace' },
  { id: 'raid',        icon: '△',  label: 'RAID Log' },
  { id: 'specialists', icon: '🤖', label: 'Agents' },
  { id: 'docs',        icon: '◻',  label: 'Documents' },
]

const ANALYTICS_ITEMS = [
  { id: 'analytics',  icon: '◑', label: 'EVM Analytics' },
  { id: 'knowledge',  icon: '◈', label: 'Knowledge Hub' },
]

const SETTINGS_ITEMS = [
  { id: 'marketplace', icon: '★', label: 'Marketplace' },
]

function getNowItems(project, state) {
  const stage = project?.stage
  if (!stage) return []

  const allTasks = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const doneTasks = allTasks.filter(t => t.status === 'done').length
  const totalTasks = allTasks.length
  const pendingAssignments = state?.pending_assignments ?? 0

  if (stage === 'intake') return [
    { id: 'chat', icon: '◎', label: 'Chat with Intake Agent', color: 'var(--blue)', highlight: true },
  ]
  if (stage === 'planning') return [
    { id: 'chat', icon: '◎', label: 'Review Plan', color: 'var(--purple)', highlight: true },
  ]
  if (stage === 'awaiting_approval') return [
    { id: 'chat', icon: '◎', label: 'Approve Plan', color: 'var(--amber)', highlight: true },
  ]
  if (stage === 'execution') {
    const items = []
    if (!project?.last_checkin_at) {
      items.push({ id: 'chat', icon: '◎', label: 'Start first check-in', color: 'var(--blue)', highlight: true })
    } else {
      const hoursAgo = Math.floor((Date.now() - new Date(project.last_checkin_at)) / 3600000)
      if (hoursAgo >= 20) {
        items.push({ id: 'chat', icon: '◷', label: `Check in (${hoursAgo < 24 ? hoursAgo + 'h ago' : Math.floor(hoursAgo / 24) + 'd ago'})`, color: 'var(--amber)', highlight: true })
      } else {
        items.push({ id: 'chat', icon: '◎', label: 'Quick check-in', color: 'var(--text-2)', highlight: false })
      }
    }
    if (pendingAssignments > 0) {
      items.push({ id: 'specialists', icon: '★', label: `${pendingAssignments} task${pendingAssignments > 1 ? 's' : ''} ready to assign`, color: 'var(--amber)', highlight: true })
    }
    if (totalTasks > 0 && doneTasks === totalTasks) {
      items.push({ id: 'retro', icon: '◫', label: 'All tasks done — run retro', color: 'var(--green)', highlight: true })
    }
    return items
  }
  if (stage === 'milestone_retro') return [
    { id: 'chat', icon: '◫', label: 'Continue milestone retro', color: 'var(--amber)', highlight: true },
  ]
  if (stage === 'ship_retro') return [
    { id: 'chat', icon: '🚀', label: 'Continue ship retro', color: 'var(--amber)', highlight: true },
  ]
  if (stage === 'complete') return [
    { id: 'docs', icon: '📄', label: 'View close report', color: 'var(--green)', highlight: false },
  ]
  return []
}

export default function SideNav({ view, setView, project, state, onOpenChat, onNewProject, badges = {} }) {
  const nowItems = getNowItems(project, state)

  function handleNavClick(item) {
    if (item.id === 'chat') {
      onOpenChat?.()
    } else {
      setView(item.id)
    }
  }

  function NavGroup({ label, items }) {
    return (
      <div className="sidenav__group">
        <div className="sidenav__group-label">{label}</div>
        {items.map(item => (
          <button
            key={item.id + (item.label)}
            className={`sidenav__item${view === item.id ? ' sidenav__item--active' : ''}${item.highlight ? ' sidenav__item--highlight' : ''}`}
            style={item.highlight ? { '--item-accent': item.color } : {}}
            onClick={() => handleNavClick(item)}
          >
            <span className="sidenav__icon" style={item.highlight ? { color: item.color } : {}}>{item.icon}</span>
            <span className="sidenav__label">{item.label}</span>
            {badges[item.id] && <span className="sidenav__badge" />}
          </button>
        ))}
      </div>
    )
  }

  return (
    <nav className="sidenav">
      <div className="sidenav__logo">
        <span className="sidenav__logo-text">Project OS</span>
      </div>

      {project && (
        <div className="sidenav__project-card">
          <div className="sidenav__project-title">{project.title}</div>
          <div className="sidenav__project-stage">{(project.stage ?? 'intake').replace(/_/g, ' ')}</div>
          {project.momentum_score != null && (
            <div className="sidenav__momentum">
              <div className="sidenav__momentum-bar">
                <div
                  className="sidenav__momentum-fill"
                  style={{
                    width: `${project.momentum_score}%`,
                    background: project.momentum_score >= 60 ? 'var(--green)' : project.momentum_score >= 30 ? 'var(--amber)' : 'var(--red)',
                  }}
                />
              </div>
              <span className="sidenav__momentum-label">{project.momentum_score} momentum</span>
            </div>
          )}
        </div>
      )}

      <div className="sidenav__scroll">
        {nowItems.length > 0 && <NavGroup label="NOW" items={nowItems} />}
        <NavGroup label="PROJECT" items={PROJECT_ITEMS} />
        <NavGroup label="ANALYTICS" items={ANALYTICS_ITEMS} />
        <NavGroup label="SETTINGS" items={SETTINGS_ITEMS} />
      </div>

      <div className="sidenav__footer">
        <button className="sidenav__new-btn" onClick={onNewProject}>+ New project</button>
      </div>
    </nav>
  )
}
