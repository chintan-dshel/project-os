import { useState, useEffect } from 'react'
import { listIntegrations, updateIntegration, disconnectIntegration } from '../lib/api.js'

const STATUS_CFG = {
  connected: { label: 'Connected',   color: 'var(--teal)',   bg: 'var(--teal-bg)' },
  error:     { label: 'Error',       color: 'var(--red)',    bg: 'var(--red-bg)' },
  available: { label: 'Available',   color: 'var(--text-3)', bg: 'var(--bg-3)' },
}

function IntegrationCard({ integration, onUpdate }) {
  const [working, setWorking] = useState(false)
  const cfg = STATUS_CFG[integration.status] ?? STATUS_CFG.available

  async function connect() {
    setWorking(true)
    try {
      await updateIntegration(integration.key, {
        status:       'connected',
        display_name: `${integration.name} (demo)`,
      })
      onUpdate()
    } catch (e) { console.error(e) }
    finally { setWorking(false) }
  }

  async function disconnect() {
    setWorking(true)
    try {
      await disconnectIntegration(integration.key)
      onUpdate()
    } catch (e) { console.error(e) }
    finally { setWorking(false) }
  }

  return (
    <div className={`mkt__card${integration.status === 'connected' ? ' mkt__card--active' : ''}`}>
      <div className="mkt__card-head">
        <span className="mkt__card-icon">{integration.icon}</span>
        <div className="mkt__card-meta">
          <div className="mkt__card-name">{integration.name}</div>
          {integration.display_name && (
            <div className="mkt__card-sub">{integration.display_name}</div>
          )}
        </div>
        <span className="mkt__card-status" style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.label}
        </span>
      </div>
      <div className="mkt__card-desc">{integration.description}</div>
      {integration.last_error && integration.status === 'error' && (
        <div className="mkt__card-error">{integration.last_error}</div>
      )}
      <div className="mkt__card-actions">
        {integration.status === 'available' && (
          <button className="raid-btn raid-btn--primary" onClick={connect} disabled={working}>
            {working ? '…' : 'Connect'}
          </button>
        )}
        {integration.status === 'connected' && (
          <button className="raid-btn" onClick={disconnect} disabled={working}>
            {working ? '…' : 'Disconnect'}
          </button>
        )}
        {integration.status === 'error' && (
          <>
            <button className="raid-btn raid-btn--danger" onClick={connect} disabled={working}>
              {working ? '…' : 'Reconnect'}
            </button>
            <button className="raid-btn" onClick={disconnect} disabled={working}>Disconnect</button>
          </>
        )}
        {integration.last_sync_at && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
            Last sync {new Date(integration.last_sync_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsView() {
  const [integrations, setIntegrations] = useState([])
  const [loading,      setLoading]      = useState(true)

  async function load() {
    setLoading(true)
    try {
      const d = await listIntegrations()
      setIntegrations(d.integrations ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const connected = integrations.filter(i => i.status === 'connected').length

  if (loading) return (
    <div className="loading-screen">
      <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
    </div>
  )

  return (
    <div className="view view--pad">
      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className="full-view__title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginRight: 'auto' }}>
          Integrations
        </div>
        <span style={{ fontSize: 11, color: 'var(--mut)', fontFamily: 'var(--mono)' }}>
          {connected} connected · {integrations.length} available
        </span>
      </div>
      <div className="marketplace-desc" style={{ marginBottom: 16 }}>
        Connect ProjectOS to your existing tools. Each integration enriches your project briefs, syncs tasks, and lets agents pull live context from external systems.
      </div>
      <div className="mkt__grid">
        {integrations.map(i => (
          <IntegrationCard key={i.key} integration={i} onUpdate={load} />
        ))}
      </div>
    </div>
  )
}
