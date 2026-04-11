import { useState, useEffect } from 'react'
import { listRegistry, updateRegistryAgent, createRegistryAgent } from '../lib/api.js'

function AgentCard({ agent, onToggle, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [prompt,   setPrompt]   = useState(agent.system_prompt_template)
  const [saving,   setSaving]   = useState(false)

  async function savePrompt() {
    setSaving(true)
    try { await onEdit(agent.id, { system_prompt_template: prompt }); setExpanded(false) }
    catch (e) { console.error(e) } finally { setSaving(false) }
  }

  return (
    <div className={`agent-card${!agent.is_active ? ' agent-card--inactive' : ''}`}>
      <div className="agent-card__header">
        <span className="agent-card__icon">{agent.icon ?? '★'}</span>
        <div className="agent-card__meta">
          <div className="agent-card__name">{agent.name}</div>
          <div className="agent-card__desc">{agent.description}</div>
        </div>
        <div className="agent-card__actions">
          <button
            className={`agent-card__toggle${agent.is_active ? ' agent-card__toggle--on' : ''}`}
            onClick={() => onToggle(agent.id, !agent.is_active)}
          >
            {agent.is_active ? 'Active' : 'Inactive'}
          </button>
          <button className="agent-card__edit" onClick={() => setExpanded(e => !e)}>
            {expanded ? '▴ Collapse' : '✎ Edit prompt'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="agent-card__prompt-section">
          <div className="agent-card__prompt-label">System prompt template</div>
          <div className="agent-card__prompt-hint">
            Use <code>{'{{task_title}}'}</code>, <code>{'{{task_description}}'}</code>, <code>{'{{project_brief}}'}</code> as variables.
          </div>
          <textarea
            className="agent-card__prompt-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={10}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="raid-btn raid-btn--primary" onClick={savePrompt} disabled={saving}>{saving ? '…' : 'Save prompt'}</button>
            <button className="raid-btn" onClick={() => { setExpanded(false); setPrompt(agent.system_prompt_template) }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddAgentForm({ onAdd }) {
  const [name,   setName]   = useState('')
  const [slug,   setSlug]   = useState('')
  const [desc,   setDesc]   = useState('')
  const [icon,   setIcon]   = useState('')
  const [format, setFormat] = useState('markdown')
  const [prompt, setPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  async function submit() {
    if (!name.trim() || !slug.trim() || !prompt.trim()) return
    setSaving(true); setErr(null)
    try {
      await onAdd({ name, slug, description: desc, icon, output_format: format, system_prompt_template: prompt })
      setName(''); setSlug(''); setDesc(''); setIcon(''); setPrompt('')
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="add-agent-form">
      <div className="add-agent-form__title">Add custom agent</div>
      <div className="add-agent-form__row">
        <div style={{ flex: 1 }}>
          <label className="add-agent-form__label">Name</label>
          <input className="raid-input" placeholder="e.g. SEO Agent" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="add-agent-form__label">Slug (unique id)</label>
          <input className="raid-input" placeholder="e.g. seo" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
        </div>
        <div style={{ width: 80 }}>
          <label className="add-agent-form__label">Icon</label>
          <input className="raid-input" placeholder="🔍" value={icon} onChange={e => setIcon(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <label className="add-agent-form__label">Description</label>
      <input className="raid-input" placeholder="What does this agent do?" value={desc} onChange={e => setDesc(e.target.value)} />
      <label className="add-agent-form__label">Output format</label>
      <select className="raid-select" value={format} onChange={e => setFormat(e.target.value)}>
        <option value="markdown">Markdown</option>
        <option value="code">Code</option>
        <option value="json">JSON</option>
      </select>
      <label className="add-agent-form__label">System prompt template</label>
      <div className="add-agent-form__hint">Use {'{{task_title}}'}, {'{{task_description}}'}, {'{{project_brief}}'} as variables.</div>
      <textarea className="agent-card__prompt-textarea" rows={8} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="You are an expert... Your job is to..." />
      {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
      <button className="raid-btn raid-btn--primary" onClick={submit} disabled={!name.trim() || !slug.trim() || !prompt.trim() || saving} style={{ marginTop: 8 }}>
        {saving ? '…' : 'Add agent'}
      </button>
    </div>
  )
}

export default function MarketplaceView() {
  const [agents,   setAgents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  async function load() {
    setLoading(true)
    try { const d = await listRegistry(); setAgents(d.agents ?? []) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(id, isActive) {
    await updateRegistryAgent(id, { is_active: isActive })
    await load()
  }

  async function handleEdit(id, updates) {
    await updateRegistryAgent(id, updates)
    await load()
  }

  async function handleAdd(payload) {
    await createRegistryAgent(payload)
    setShowAdd(false)
    await load()
  }

  if (loading) return (
    <div className="loading-screen">
      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
    </div>
  )

  return (
    <div className="full-view">
      <div className="full-view__header">
        <div className="full-view__title">Agent Marketplace</div>
        <div className="fv-stats">
          <span className="fv-stat">{agents.filter(a => a.is_active).length} active</span>
          <span className="fv-stat">{agents.length} total</span>
        </div>
        <button className="raid-btn raid-btn--primary" style={{ marginLeft: 'auto' }} onClick={() => setShowAdd(s => !s)}>
          {showAdd ? '✕ Cancel' : '+ Add custom agent'}
        </button>
      </div>
      <div className="full-view__body">
        <div className="marketplace-desc">
          Manage the specialist agents available for task delegation. Toggle agents on/off, edit their system prompts, or add your own custom agents. Use template variables to inject task context automatically.
        </div>
        {showAdd && <AddAgentForm onAdd={handleAdd} />}
        <div className="agent-list">
          {agents.map(a => (
            <AgentCard key={a.id} agent={a} onToggle={handleToggle} onEdit={handleEdit} />
          ))}
        </div>
      </div>
    </div>
  )
}
