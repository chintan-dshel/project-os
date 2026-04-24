import { useState, useEffect, useRef } from 'react'

export default function CommandPalette({ onClose, onNavigate }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const groups = [
    {
      group: 'NAVIGATE',
      items: [
        { icon: '◫', label: 'Go to Brief',           action: () => onNavigate('brief') },
        { icon: '▦', label: 'Go to Kanban',           action: () => onNavigate('dashboard') },
        { icon: '◉', label: 'Go to Workroom',         action: () => onNavigate('workspace') },
        { icon: '△', label: 'Go to RAID Log',         action: () => onNavigate('raid') },
        { icon: '◆', label: 'Go to Agents',           action: () => onNavigate('specialists') },
        { icon: '$', label: 'Go to EVM',              action: () => onNavigate('analytics') },
        { icon: '∿', label: 'Go to Cost & Latency',   action: () => onNavigate('telemetry') },
        { icon: '✦', label: 'Go to Knowledge Hub',    action: () => onNavigate('knowledge') },
      ],
    },
    {
      group: 'CREATE',
      items: [
        { icon: '+', label: 'New card…',     hint: 'C', action: onClose },
        { icon: '+', label: 'New RAID item…', hint: 'R', action: onClose },
        { icon: '+', label: 'New doc…',       hint: 'D', action: onClose },
      ],
    },
    {
      group: 'AGENTS',
      items: [
        { icon: '▶', label: 'Ask Planner a question', action: () => onNavigate('workspace') },
        { icon: '⏻', label: 'Pause all agents',       action: onClose },
        { icon: '✎', label: 'Edit agent budgets…',    action: () => onNavigate('specialists') },
      ],
    },
  ]

  const filtered = groups
    .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())) }))
    .filter(g => g.items.length > 0)

  const flat = filtered.flatMap(g => g.items)

  function onKey(e) {
    if (e.key === 'ArrowDown') { setIdx(i => Math.min(flat.length - 1, i + 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')   { setIdx(i => Math.max(0, i - 1)); e.preventDefault() }
    if (e.key === 'Enter' && flat[idx]) { flat[idx].action(); onClose() }
    if (e.key === 'Escape') onClose()
  }

  let cursor = 0
  return (
    <div className="cp-scrim" onClick={onClose}>
      <div className="cp" onClick={e => e.stopPropagation()}>
        <div className="cp__input-wrap">
          <span className="cp__icon">⌘</span>
          <input
            ref={inputRef}
            className="cp__input"
            placeholder="Jump to anything — views, cards, agents, actions…"
            value={q}
            onChange={e => { setQ(e.target.value); setIdx(0) }}
            onKeyDown={onKey}
          />
          <span className="cp__esc">ESC</span>
        </div>
        <div className="cp__list">
          {filtered.map(g => (
            <div key={g.group}>
              <div className="cp__group-label">{g.group}</div>
              {g.items.map(item => {
                const active = cursor === idx
                cursor++
                return (
                  <button
                    key={item.label}
                    className={`cp__item${active ? ' cp__item--active' : ''}`}
                    onClick={() => { item.action(); onClose() }}
                  >
                    <span className="cp__item-icon">{item.icon}</span>
                    <span className="cp__item-label">{item.label}</span>
                    {item.hint && <span className="cp__item-hint">{item.hint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--mut)', fontSize: '12px' }}>
              No results for "{q}"
            </div>
          )}
        </div>
        <div className="cp__footer">
          <span>↑↓ NAVIGATE</span>
          <span>↵ SELECT</span>
          <span>ESC CLOSE</span>
        </div>
      </div>
    </div>
  )
}
