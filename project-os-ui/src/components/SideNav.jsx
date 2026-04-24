const NAV_GROUPS = [
  {
    group: 'PROJECT',
    items: [
      { id: 'brief',        label: 'Brief',           icon: '◫' },
      { id: 'dashboard',    label: 'Kanban',          icon: '▦' },
      { id: 'workroom',     label: 'Workroom',        icon: '◉' },
      { id: 'raid',         label: 'RAID Log',        icon: '△' },
      { id: 'docs',         label: 'Documents',       icon: '▤' },
    ],
  },
  {
    group: 'AGENTS',
    items: [
      { id: 'specialists',  label: 'Agents',          icon: '◆' },
      { id: 'telemetry',    label: 'Cost & Latency',  icon: '∿' },
      { id: 'marketplace',  label: 'Marketplace',     icon: '⊞' },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { id: 'analytics',    label: 'EVM',             icon: '$' },
      { id: 'knowledge',    label: 'Knowledge Hub',   icon: '✦' },
      { id: 'integrations', label: 'Integrations',    icon: '⬡' },
      { id: 'ab',           label: 'A/B Experiments', icon: '⚖' },
    ],
  },
]

const STAGE_LABEL = {
  intake:            'INTAKE',
  planning:          'PLAN',
  awaiting_approval: 'PLAN',
  execution:         'EXECUTE',
  milestone_retro:   'EXECUTE',
  ship_retro:        'CLOSEOUT',
  complete:          'CLOSEOUT',
}

export default function SideNav({ view, setView, project, onOpenChat, onNewProject, onOpenCommandPalette, badges = {} }) {
  const stageLabel = project?.stage ? (STAGE_LABEL[project.stage] ?? project.stage.toUpperCase()) : null

  return (
    <aside className="sb">
      <div className="sb__brand">
        <div className="sb__logo">P</div>
        <div className="sb__brand-name">ProjectOS</div>
        <button className="sb__org-switch" onClick={onNewProject} title="Switch project">⌄</button>
      </div>

      <button className="sb__cmd" onClick={onOpenCommandPalette}>
        <span>⌕</span>
        <span className="sb__cmd-text">Jump to…</span>
        <span className="kbd">⌘K</span>
      </button>

      {project && (
        <div className="sb__project-switch">
          <button className="sb__project-row" onClick={onNewProject}>
            <div className="sb__project-color" style={{ background: 'var(--teal)' }} />
            <div className="sb__project-name">{project.title}</div>
            <span className="sb__project-caret">⌄</span>
          </button>
          <div className="sb__project-sub">
            {stageLabel && <span>{stageLabel}</span>}
          </div>
        </div>
      )}

      <div className="sb__scroll">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group} className="sb__group">
            <div className="sb__group-label">{group}</div>
            {items.map(item => (
              <button
                key={item.id}
                className={`sb__item${view === item.id ? ' sb__item--active' : ''}`}
                onClick={() => setView(item.id)}
              >
                <span className="sb__icon mono">{item.icon}</span>
                <span className="sb__label">{item.label}</span>
                {badges[item.id] && <span className="sb__count">!</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sb__footer">
        <div className="sb__presence">
          {['MK', 'JD'].map((k, i) => (
            <div
              key={k}
              className="sb__presence-avatar"
              style={{ background: i === 0 ? 'var(--teal)' : 'var(--amber)' }}
            >
              {k}
            </div>
          ))}
        </div>
        <div className="sb__user-name">2 online</div>
      </div>
    </aside>
  )
}
