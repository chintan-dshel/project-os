function timePct(d, t) { return Math.min(d / Math.max(t, 1), 1) }

function EVMLineChart({ phases, totalEst, daysIn, totalDays, hasHours }) {
  const allTasks = phases.flatMap(p => (p.milestones ?? []).flatMap(m => m.tasks ?? []))
  const weeks    = Math.max(Math.ceil(totalDays / 7), 1)
  const W = 560, H = 180, padL = 42, padB = 22, padT = 12, padR = 16
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const maxVal = Math.max(totalEst * 1.15, 1)

  const pvPoints = Array.from({ length: weeks + 1 }, (_, i) => {
    const x = padL + (i / weeks) * chartW
    const y = padT + chartH - (Math.min(i / weeks, 1)) * totalEst / maxVal * chartH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const doneEV  = allTasks.filter(t => t.status === 'done').reduce((s, t) => s + (parseFloat(t.estimated_hours) || 0), 0)
  const curWeek = Math.min(Math.ceil(daysIn / 7), weeks)
  const evPoints = Array.from({ length: curWeek + 1 }, (_, i) => {
    const x = padL + (i / weeks) * chartW
    const v = i === 0 ? 0 : (doneEV * (i / Math.max(curWeek, 1)))
    const y = padT + chartH - (v / maxVal) * chartH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const totalAC  = allTasks.reduce((s, t) => s + (parseFloat(t.actual_hours) || 0), 0)
  const acPoints = hasHours && Array.from({ length: curWeek + 1 }, (_, i) => {
    const x = padL + (i / weeks) * chartW
    const v = i === 0 ? 0 : (totalAC * (i / Math.max(curWeek, 1)))
    const y = padT + chartH - (v / maxVal) * chartH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const nowX    = padL + (curWeek / weeks) * chartW
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => ({ val: (maxVal * pct).toFixed(0) + 'h', y: padT + chartH * (1 - pct) }))
  const xLabels = Array.from({ length: Math.min(weeks + 1, 7) }, (_, i) => {
    const wi = Math.round(i * (weeks / Math.min(weeks, 6)))
    return { label: `W${wi}`, x: padL + (wi / weeks) * chartW }
  })

  return (
    <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 12 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <rect width={W} height={H} fill="var(--bg-2)" />
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={padL} y1={l.y} x2={W - padR} y2={l.y} stroke="var(--border)" strokeWidth={i === yLabels.length - 1 ? 1 : .5} strokeDasharray={i > 0 ? '3,3' : undefined} />
            <text x={padL - 4} y={l.y} fontSize={8} fill="var(--text-3)" textAnchor="end" dominantBaseline="central">{l.val}</text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 6} fontSize={8} fill="var(--text-3)" textAnchor="middle">{l.label}</text>
        ))}
        <polyline points={pvPoints} fill="none" stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="5,3" opacity={.7} />
        {evPoints && <polyline points={evPoints} fill="none" stroke="var(--green)" strokeWidth={2} />}
        {acPoints && <polyline points={acPoints} fill="none" stroke="var(--amber)" strokeWidth={2} />}
        {curWeek > 0 && curWeek < weeks && (
          <>
            <line x1={nowX} y1={padT} x2={nowX} y2={padT + chartH} stroke="var(--amber)" strokeWidth={.5} strokeDasharray="2,2" opacity={.6} />
            <text x={nowX + 3} y={padT + 10} fontSize={8} fill="var(--amber)">Now</text>
          </>
        )}
        {evPoints && (() => { const pts = evPoints.split(' '); const last = pts[pts.length - 1]?.split(','); return last ? <circle cx={last[0]} cy={last[1]} r={3} fill="var(--green)" /> : null })()}
        {acPoints && (() => { const pts = acPoints.split(' '); const last = pts[pts.length - 1]?.split(','); return last ? <circle cx={last[0]} cy={last[1]} r={3} fill="var(--amber)" /> : null })()}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-2)', padding: '6px 14px 10px' }}>
        <div><span style={{ display: 'inline-block', width: 18, height: 2, background: 'var(--green)', verticalAlign: 'middle', marginRight: 4 }} /> Earned Value (EV)</div>
        <div><span style={{ display: 'inline-block', width: 18, height: 2, background: 'var(--amber)', verticalAlign: 'middle', marginRight: 4 }} /> Actual Cost (AC)</div>
        <div><span style={{ display: 'inline-block', width: 18, height: 2, background: 'var(--blue)', verticalAlign: 'middle', marginRight: 4, borderTop: '1px dashed var(--blue)' }} /> Planned Value (PV)</div>
      </div>
    </div>
  )
}

function EVMGauge({ label, value }) {
  const locked  = value == null
  const safeVal = locked ? 0 : (isNaN(value) || !isFinite(value) ? 0 : value)
  const color   = locked ? 'var(--text-3)' : safeVal >= 1 ? 'var(--green)' : safeVal >= 0.8 ? 'var(--amber)' : 'var(--red)'
  const r = 36, circ = 2 * Math.PI * r, pct = Math.min(safeVal / 2, 1), dash = pct * circ
  return (
    <div className="evm-gauge">
      <svg viewBox="0 0 90 90" style={{ width: 90, height: 90 }}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--bg-4)" strokeWidth="7" strokeLinecap="round" />
        {!locked && <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4} />}
        <text x="45" y="42" textAnchor="middle" dominantBaseline="central" fill={color} style={{ fontFamily: 'var(--mono)', fontSize: locked ? 20 : 16 }}>{locked ? '—' : safeVal.toFixed(2)}</text>
        <text x="45" y="57" textAnchor="middle" fill="var(--text-3)" style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '.06em' }}>{label}</text>
      </svg>
    </div>
  )
}

export default function EVMView({ project, state }) {
  const tasks      = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const hasPlanned = tasks.length > 0
  const stage      = project?.stage

  if (!hasPlanned) {
    return (
      <div className="evm-empty-state">
        <div className="evm-empty__icon">📊</div>
        <div className="evm-empty__title">EVM Analytics</div>
        <div className="evm-empty__what">Earned Value Management tells you in real numbers whether your project is on schedule and on budget. It unlocks once you have an approved execution plan.</div>
        <div className="evm-empty__steps">
          {[
            { n: 1, done: !['intake', 'planning', 'awaiting_approval'].includes(stage), title: 'Approve an execution plan', sub: 'Tasks need estimated hours to calculate Planned Value' },
            { n: 2, done: false, title: 'Move tasks to Done on the board', sub: 'Drag cards or click the status pill — SPI updates immediately' },
            { n: 3, done: false, title: 'Log how long each task took', sub: 'Click the ✎ hours chip on any card — CPI tracks actual cost' },
          ].map(s => (
            <div key={s.n} className={`evm-step${s.done ? ' evm-step--done' : ' evm-step--active'}`}>
              <span className="evm-step__num">{s.done ? '✓' : s.n}</span>
              <div><div className="evm-step__title">{s.title}</div><div className="evm-step__sub">{s.sub}</div></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totalEst  = tasks.reduce((s, t) => s + (parseFloat(t.estimated_hours) || 0), 0)
  const doneTasks = tasks.filter(t => t.status === 'done')
  const EV        = doneTasks.reduce((s, t) => s + (parseFloat(t.estimated_hours) || 0), 0)
  const AC        = tasks.reduce((s, t) => s + (parseFloat(t.actual_hours) || 0), 0)
  const daysIn    = project?.created_at ? Math.floor((Date.now() - new Date(project.created_at)) / 86400000) : 0
  const totalDays = (project?.planned_weeks ?? 8) * 7
  const PV        = totalEst * Math.min(daysIn / Math.max(totalDays, 1), 1)
  const SPI       = PV > 0.01 ? EV / PV : (EV > 0 ? 1.0 : 0)
  const CPI       = AC > 0.01 ? EV / AC : (EV > 0 ? 1.0 : 0)
  const SV        = EV - PV
  const CV        = EV - AC
  const EAC       = CPI > 0.01 ? totalEst / CPI : totalEst
  const VAC       = totalEst - EAC
  const pctEarned = totalEst > 0 ? Math.round(EV / totalEst * 100) : 0
  const hasHours  = AC > 0
  const phases    = state?.phases ?? []

  return (
    <div className="view view--pad">
      <div className="full-view__header" style={{ marginBottom: 20, paddingLeft: 0, paddingRight: 0, paddingTop: 0, background: 'none', borderBottom: '1px solid var(--line)' }}>
        <div className="full-view__title">EVM Analytics</div>
        <div className="fv-stats">
          <span className="fv-stat">Day {daysIn + 1} of {totalDays}</span>
          <span className="fv-stat">{pctEarned}% earned</span>
          <span className="fv-stat">{doneTasks.length}/{tasks.length} tasks done</span>
          {hasHours ? (
            <span className="fv-stat" style={{ color: CV < 0 ? 'var(--red)' : 'var(--green)' }}>
              {CV >= 0 ? '▼' : '▲'} {Math.abs(CV).toFixed(1)}h cost variance
            </span>
          ) : (
            <span className="fv-stat evm-hint">💡 Log actual hours on cards to unlock CPI</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="evm-gauges">
          <div className="evm-gauge-block">
            <EVMGauge label="SPI" value={SPI} />
            <div className="evm-gauge-block__sub">{SPI >= 1 ? 'Ahead of schedule' : SPI >= 0.8 ? 'Slightly behind' : 'Behind schedule'}</div>
          </div>
          <div className="evm-gauge-block">
            <EVMGauge label="CPI" value={hasHours ? CPI : null} />
            <div className="evm-gauge-block__sub">{!hasHours ? 'Log hours to unlock' : CPI >= 1 ? 'Under budget' : CPI >= 0.8 ? 'Slightly over' : 'Over budget'}</div>
          </div>
          {[
            { label: 'PLANNED VALUE',  value: PV.toFixed(1) + 'h',                       color: 'var(--blue)',   sub: `${Math.round(timePct(daysIn, totalDays) * 100)}% through timeline` },
            { label: 'EARNED VALUE',   value: EV.toFixed(1) + 'h',                       color: 'var(--green)',  sub: `${pctEarned}% of ${totalEst.toFixed(0)}h budget` },
            { label: 'ACTUAL COST',    value: hasHours ? AC.toFixed(1) + 'h' : '—',      color: hasHours ? (AC > EV ? 'var(--red)' : 'var(--text-2)') : 'var(--text-3)', sub: hasHours ? 'Hours logged on cards' : 'No hours logged yet' },
          ].map(m => (
            <div key={m.label} className="evm-metric-box">
              <div className="evm-metric-box__label">{m.label}</div>
              <div className="evm-metric-box__value" style={{ color: m.color }}>{m.value}</div>
              <div className="evm-metric-box__sub">{m.sub}</div>
            </div>
          ))}
        </div>
        <div className="evm-variances">
          {[
            { label: 'SCHEDULE VARIANCE',       value: SV,              unit: 'h', bad: SV < 0,        desc: SV >= 0 ? 'Ahead of plan' : 'Behind plan' },
            { label: 'COST VARIANCE',           value: hasHours ? CV : null, unit: 'h', bad: CV < 0,   desc: !hasHours ? 'Log hours to calculate' : CV >= 0 ? 'Under budget' : 'Over budget' },
            { label: 'ESTIMATE AT COMPLETION',  value: hasHours ? EAC : null, unit: 'h', raw: true, bad: EAC > totalEst, desc: hasHours ? `Budget: ${totalEst.toFixed(1)}h` : 'Log hours to calculate' },
            { label: 'VARIANCE AT COMPLETION',  value: hasHours ? VAC : null, unit: 'h', bad: VAC < 0, desc: !hasHours ? 'Log hours to calculate' : VAC >= 0 ? 'Under budget' : 'Over budget' },
          ].map(m => (
            <div key={m.label} className={`evm-variance${m.value == null ? ' evm-variance--locked' : m.bad ? ' evm-variance--bad' : ' evm-variance--good'}`}>
              <div className="evm-variance__label">{m.label}</div>
              <div className="evm-variance__value">
                {m.value == null ? '—' : m.raw ? `${m.value.toFixed(1)}${m.unit}` : m.value >= 0 ? `+${m.value.toFixed(1)}${m.unit}` : `${m.value.toFixed(1)}${m.unit}`}
              </div>
              <div className="evm-variance__desc">{m.desc}</div>
            </div>
          ))}
        </div>
        <div className="fv-section">
          <div className="fv-section__label">EV vs AC vs PV — Project trend</div>
          <EVMLineChart phases={phases} totalEst={totalEst} daysIn={daysIn} totalDays={totalDays} hasHours={hasHours} />
        </div>
        <div className="fv-section">
          <div className="fv-section__label">Milestone breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Milestone', 'PV', 'EV', 'AC', 'Variance'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.flatMap(ph => (ph.milestones ?? []).map(ms => {
                const mt  = ms.tasks ?? []
                const est = mt.reduce((s, t) => s + (parseFloat(t.estimated_hours) || 0), 0)
                const ev  = mt.filter(t => t.status === 'done').reduce((s, t) => s + (parseFloat(t.estimated_hours) || 0), 0)
                const ac  = mt.reduce((s, t) => s + (parseFloat(t.actual_hours) || 0), 0)
                const cv  = ev - ac
                return (
                  <tr key={ms.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text)' }}>{ms.title}{ms.completed_at && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--green)' }}>✓</span>}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--blue)', fontFamily: 'monospace' }}>{est.toFixed(1)}h</td>
                    <td style={{ padding: '8px 10px', color: 'var(--green)', fontFamily: 'monospace' }}>{ev.toFixed(1)}h</td>
                    <td style={{ padding: '8px 10px', color: !hasHours ? 'var(--text-3)' : ac > ev ? 'var(--red)' : 'var(--text-2)', fontFamily: 'monospace' }}>{hasHours ? ac.toFixed(1) + 'h' : '—'}</td>
                    <td style={{ padding: '8px 10px', color: !hasHours ? 'var(--text-3)' : cv < 0 ? 'var(--red)' : 'var(--green)', fontFamily: 'monospace', fontWeight: 500 }}>{hasHours ? (cv >= 0 ? '+' : '') + cv.toFixed(1) + 'h' : '—'}</td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
        <div className="evm-guide">
          <div className="evm-guide__title">Reading the metrics</div>
          <div className="evm-guide__grid">
            <div><strong>SPI &gt; 1.0</strong> — ahead of schedule. Below 1.0 means behind.</div>
            <div><strong>CPI &gt; 1.0</strong> — under budget. Below 1.0 means over cost.</div>
            <div><strong>EAC</strong> — if current CPI holds, projected final hours cost.</div>
            <div><strong>VAC</strong> — positive = finish under budget; negative = over.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
