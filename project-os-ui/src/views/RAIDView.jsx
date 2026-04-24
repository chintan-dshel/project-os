import { useState } from 'react'
import { updateRisk, materialiseRisk, createDecisionFromIssue, createRisk, createDecision } from '../lib/api.js'

const RAID_TABS = [
  { id: 'risks',       label: 'Risks',       icon: '⚑',  desc: 'Future threats' },
  { id: 'assumptions', label: 'Assumptions', icon: '~',   desc: 'Believed true' },
  { id: 'issues',      label: 'Issues',      icon: '⊘',  desc: 'Risks materialised' },
  { id: 'decisions',   label: 'Decisions',   icon: '◉',  desc: 'Choices made' },
]

const SEV = s => s >= 7 ? { label: 'HIGH',   color: 'var(--red)',   bg: 'rgba(240,80,80,.08)' }
               : s >= 4 ? { label: 'MED',    color: 'var(--amber)', bg: 'rgba(240,160,48,.08)' }
               :           { label: 'LOW',    color: 'var(--text-3)', bg: 'transparent' }

const RISK_STATUSES = ['open', 'mitigated', 'accepted', 'closed']
const STATUS_CFG = {
  open:         { color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  mitigated:    { color: 'var(--green)',  bg: 'var(--green-bg)' },
  accepted:     { color: 'var(--text-2)', bg: 'var(--bg-4)' },
  closed:       { color: 'var(--text-3)', bg: 'var(--bg-4)' },
  materialised: { color: 'var(--red)',    bg: 'var(--red-bg)' },
}

function StatusDropdown({ status, onSelect, disabled, isIssue }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.open
  const options = isIssue ? ['materialised', 'closed'] : RISK_STATUSES
  return (
    <select
      className="raid-status-select"
      style={{ color: cfg.color, background: cfg.bg }}
      value={status}
      disabled={disabled}
      onChange={e => onSelect(e.target.value)}
      onClick={e => e.stopPropagation()}
    >
      {options.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

function RiskDetailPanel({ risk, projectId, onDone }) {
  const [mitigation,   setMitigation]   = useState(risk.mitigation ?? '')
  const [contingency,  setContingency]  = useState(risk.contingency ?? '')
  const [issueDesc,    setIssueDesc]    = useState('')
  const [decisionText, setDecisionText] = useState('')
  const [rationale,    setRationale]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [savingMit,    setSavingMit]    = useState(false)
  const [err,          setErr]          = useState(null)
  const isIssue = risk.status === 'materialised'

  async function saveMitigation() {
    setSavingMit(true); setErr(null)
    try { await updateRisk(projectId, risk.id, { mitigation: mitigation.trim() || null, contingency: contingency.trim() || null }); onDone() }
    catch (e) { setErr(e.message) } finally { setSavingMit(false) }
  }
  async function handleMaterialise() {
    if (!issueDesc.trim()) return
    setSaving(true); setErr(null)
    try { await materialiseRisk(projectId, risk.id, issueDesc); onDone() }
    catch (e) { setErr(e.message) } finally { setSaving(false) }
  }
  async function handleDecide() {
    if (!decisionText.trim()) return
    setSaving(true); setErr(null)
    try { await createDecisionFromIssue(projectId, risk.id, { decision: decisionText, rationale }); onDone() }
    catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <tr className="raid-detail-row"><td colSpan={6}>
      <div className="raid-detail">
        {!isIssue && (
          <div className="raid-detail__section">
            <div className="raid-detail__label">Mitigation plan</div>
            <textarea className="raid-input raid-textarea" placeholder="How will you prevent or reduce this risk?…" value={mitigation} onChange={e => setMitigation(e.target.value)} rows={2} />
            <div className="raid-detail__label" style={{ marginTop: 6 }}>Contingency plan</div>
            <textarea className="raid-input raid-textarea" placeholder="If the risk occurs, what will you do?…" value={contingency} onChange={e => setContingency(e.target.value)} rows={2} />
            <button className="raid-btn raid-btn--primary" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={saveMitigation} disabled={savingMit}>{savingMit ? '…' : 'Save plans'}</button>
          </div>
        )}
        {isIssue && risk.issue_description && (
          <div className="raid-detail__section">
            <div className="raid-detail__label">What actually happened</div>
            <div className="raid-detail__text" style={{ color: 'var(--red)' }}>{risk.issue_description}</div>
          </div>
        )}
        {!isIssue && risk.status === 'open' && (
          <div className="raid-detail__section">
            <div className="raid-detail__label">⊘ This risk has materialised — describe what happened</div>
            <div className="raid-detail__row">
              <input className="raid-input" placeholder="What actually went wrong…" value={issueDesc} onChange={e => setIssueDesc(e.target.value)} />
              <button className="raid-btn raid-btn--danger" onClick={handleMaterialise} disabled={!issueDesc.trim() || saving}>{saving ? '…' : 'Materialise →'}</button>
            </div>
          </div>
        )}
        {isIssue && (
          <div className="raid-detail__section">
            <div className="raid-detail__label">◉ Log a decision to resolve this issue</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input className="raid-input" placeholder="Decision made…" value={decisionText} onChange={e => setDecisionText(e.target.value)} />
              <input className="raid-input" placeholder="Rationale (optional)…" value={rationale} onChange={e => setRationale(e.target.value)} />
              <button className="raid-btn raid-btn--primary" onClick={handleDecide} disabled={!decisionText.trim() || saving} style={{ alignSelf: 'flex-start' }}>{saving ? '…' : 'Log decision'}</button>
            </div>
          </div>
        )}
        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      </div>
    </td></tr>
  )
}

function AddEntryForm({ projectId, entryType, onDone }) {
  const [desc,       setDesc]       = useState('')
  const [likelihood, setLikelihood] = useState('medium')
  const [impact,     setImpact]     = useState('medium')
  const [mitigation, setMitigation] = useState('')
  const [decision,   setDecision]   = useState('')
  const [rationale,  setRationale]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState(null)

  async function submit() {
    setSaving(true); setErr(null)
    try {
      if (entryType === 'decisions') {
        if (!decision.trim()) return
        await createDecision(projectId, { decision, rationale })
      } else {
        if (!desc.trim()) return
        await createRisk(projectId, { entry_type: entryType === 'assumptions' ? 'assumption' : 'risk', description: desc, likelihood, impact, mitigation: mitigation || undefined })
      }
      setDesc(''); setDecision(''); setRationale(''); setMitigation(''); setErr(null)
      onDone()
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const isDecision   = entryType === 'decisions'
  const isAssumption = entryType === 'assumptions'
  return (
    <div className="raid-add-form">
      <div className="raid-add-form__title">Add {isDecision ? 'Decision' : isAssumption ? 'Assumption' : 'Risk'}</div>
      {isDecision ? (
        <>
          <input className="raid-input" placeholder="Decision made…" value={decision} onChange={e => setDecision(e.target.value)} />
          <input className="raid-input" placeholder="Rationale (optional)…" value={rationale} onChange={e => setRationale(e.target.value)} />
        </>
      ) : (
        <>
          <input className="raid-input" placeholder={isAssumption ? 'We assume that…' : 'Risk description…'} value={desc} onChange={e => setDesc(e.target.value)} />
          {!isAssumption && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="raid-select" value={likelihood} onChange={e => setLikelihood(e.target.value)}>
                <option value="low">Low likelihood</option>
                <option value="medium">Medium likelihood</option>
                <option value="high">High likelihood</option>
              </select>
              <select className="raid-select" value={impact} onChange={e => setImpact(e.target.value)}>
                <option value="low">Low impact</option>
                <option value="medium">Medium impact</option>
                <option value="high">High impact</option>
              </select>
            </div>
          )}
          <input className="raid-input" placeholder="Mitigation plan (optional)" value={mitigation} onChange={e => setMitigation(e.target.value)} />
        </>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="raid-btn raid-btn--primary" onClick={submit} disabled={(!desc.trim() && !decision.trim()) || saving}>{saving ? '…' : 'Add'}</button>
        {err && <span style={{ color: 'var(--red)', fontSize: 12 }}>{err}</span>}
      </div>
    </div>
  )
}

export default function RAIDView({ projectId, state, refresh }) {
  const [tab,        setTab]        = useState('risks')
  const [expandedId, setExpandedId] = useState(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [updating,   setUpdating]   = useState(null)

  const allRisks  = state?.risk_register ?? []
  const risks     = allRisks.filter(r => (r.entry_type === 'risk' || (!r.entry_type && !r.description?.startsWith('ASSUMPTION:'))) && r.status !== 'materialised')
  const assumptions = allRisks.filter(r => r.entry_type === 'assumption' || r.description?.startsWith('ASSUMPTION:'))
  const issues    = allRisks.filter(r => r.status === 'materialised')
  const decisions = (state?.decision_log ?? []).filter(d => !['Project archived and closed', 'Project archived'].includes(d.decision))
  const DATA = { risks, assumptions, issues, decisions }
  const current = DATA[tab] ?? []

  async function changeStatus(riskId, newStatus) {
    setUpdating(riskId)
    try { await updateRisk(projectId, riskId, { status: newStatus }); await refresh() }
    catch (e) { console.error(e) } finally { setUpdating(null) }
  }

  const isRiskTab = tab === 'risks' || tab === 'assumptions' || tab === 'issues'

  return (
    <div className="view view--pad">
      <div className="tabs" style={{ marginBottom: 16 }}>
        {RAID_TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' tab--active' : ''}`}
            onClick={() => { setTab(t.id); setExpandedId(null); setShowAdd(false) }}>
            {t.label}
            {DATA[t.id]?.length > 0 && <span className="tab__n">{DATA[t.id].length}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn--dark btn--small"
          onClick={() => { setShowAdd(s => !s); setExpandedId(null) }}>
          {showAdd ? '✕ Cancel' : `+ Add ${tab === 'decisions' ? 'Decision' : tab === 'assumptions' ? 'Assumption' : 'Risk'}`}
        </button>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--mut)', marginBottom: 12 }}>
          {tab === 'risks'       && 'Future events that could harm the project. Score = likelihood × impact. Expand a row to materialise when it becomes real.'}
          {tab === 'assumptions' && 'Things believed to be true that have not been verified. If disproved, convert to an issue.'}
          {tab === 'issues'      && 'Risks that have become real problems. Expand to log the decision made.'}
          {tab === 'decisions'   && 'All project decisions with rationale and outcome.'}
        </div>
        {showAdd && <AddEntryForm projectId={projectId} entryType={tab} onDone={() => { setShowAdd(false); refresh() }} />}
        {current.length === 0 && !showAdd ? (
          <div className="fv-empty">
            {tab === 'risks'       && 'No risks logged yet. Add one above, or risks appear automatically from planning and execution agents.'}
            {tab === 'assumptions' && 'No assumptions logged. Add things you believe to be true so you can validate or disprove them.'}
            {tab === 'issues'      && 'No issues yet. Open a risk and materialise it when it becomes a real problem.'}
            {tab === 'decisions'   && 'No decisions logged yet. Decisions appear when agents make choices, or add them manually.'}
          </div>
        ) : current.length > 0 && (
          <table className="risk-table">
            <thead><tr>
              {isRiskTab && tab !== 'assumptions' && <><th>Score</th><th>Sev</th></>}
              <th>{tab === 'decisions' ? 'Date' : 'Description'}</th>
              <th>{tab === 'decisions' ? 'Decision' : 'Status'}</th>
              <th>{tab === 'decisions' ? 'Rationale' : tab === 'risks' || tab === 'issues' ? 'Mitigation' : 'Notes'}</th>
              <th style={{ width: 40 }}></th>
            </tr></thead>
            <tbody>
              {current.map(item => {
                const sev  = isRiskTab ? SEV(item.risk_score ?? 0) : null
                const desc = (item.description ?? '').replace(/^ASSUMPTION:\s*/i, '')
                const isExp = expandedId === item.id
                return [
                  <tr key={item.id} className={`raid-row${isExp ? ' raid-row--expanded' : ''}`} style={sev ? { background: sev.bg } : {}}>
                    {isRiskTab && tab !== 'assumptions' && <>
                      <td className="risk-table__score" style={{ color: sev.color }}>{item.risk_score}/9</td>
                      <td><span className="risk-table__sev" style={{ color: sev.color }}>{sev.label}</span></td>
                    </>}
                    <td className="risk-table__desc">
                      {tab === 'decisions'
                        ? <span className="decision-table__date">{new Date(item.decided_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        : desc}
                      {tab === 'issues' && item.issue_description && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>↳ {item.issue_description}</div>}
                    </td>
                    <td>
                      {tab === 'decisions'
                        ? <strong style={{ color: 'var(--text)', fontSize: 13 }}>{item.decision}</strong>
                        : <StatusDropdown status={item.status} isIssue={tab === 'issues'} disabled={updating === item.id} onSelect={s => changeStatus(item.id, s)} />
                      }
                    </td>
                    <td className="risk-table__mit">{tab === 'decisions' ? (item.rationale ?? '—') : (item.mitigation ?? '—')}</td>
                    <td>
                      {isRiskTab && <button className="raid-expand-btn" onClick={() => setExpandedId(p => p === item.id ? null : item.id)}>{isExp ? '▴' : '▾'}</button>}
                    </td>
                  </tr>,
                  isExp && isRiskTab && <RiskDetailPanel key={`d-${item.id}`} risk={item} projectId={projectId} onDone={() => { setExpandedId(null); refresh() }} />
                ]
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
