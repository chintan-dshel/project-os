import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  fetchTelemetrySummary,
  fetchTelemetryByAgent,
  fetchTelemetryTimeseries,
  fetchTelemetryLatency,
} from '../lib/api.js'

// ── Date range helpers ────────────────────────────────────────────────────────

const PRESETS = [
  { label: '24h',  hours: 24 },
  { label: '7d',   hours: 24 * 7 },
  { label: '30d',  hours: 24 * 30 },
]

function rangeFromHours(hours) {
  const to   = new Date()
  const from = new Date(to.getTime() - hours * 3600_000)
  return { from: from.toISOString(), to: to.toISOString() }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ label, value, sub }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--r)', padding: '16px 20px', flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      {[140, 260, 140].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 'var(--r)', background: 'var(--bg-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  )
}

function WarningBanner({ message }) {
  return (
    <div style={{
      margin: '0 24px 16px', padding: '10px 14px', borderRadius: 'var(--r)',
      background: 'rgba(251,191,36,.1)', border: '0.5px solid var(--amber)',
      color: 'var(--amber)', fontSize: 13,
    }}>
      {message}
    </div>
  )
}

function tooltipStyle() {
  return {
    contentStyle: { background: 'var(--bg-3, #1e1e1e)', border: '0.5px solid var(--border)', borderRadius: 6, fontSize: 12 },
    labelStyle:   { color: 'var(--text-2)' },
    itemStyle:    { color: 'var(--text-1)' },
  }
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function TelemetryView({ projectId }) {
  const [preset,      setPreset]      = useState(1)   // index into PRESETS (default 7d)
  const [summary,     setSummary]     = useState(null)
  const [byAgent,     setByAgent]     = useState([])
  const [timeseries,  setTimeseries]  = useState([])
  const [latency,     setLatency]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [warning,     setWarning]     = useState(null)

  const load = useCallback(async (presetIdx) => {
    setLoading(true)
    setWarning(null)
    const { from, to } = rangeFromHours(PRESETS[presetIdx].hours)
    const params = { from, to, ...(projectId ? { projectId } : {}) }

    try {
      const [s, a, ts, lat] = await Promise.all([
        fetchTelemetrySummary(params),
        fetchTelemetryByAgent(params),
        fetchTelemetryTimeseries({ ...params, granularity: PRESETS[presetIdx].hours <= 24 ? 'hour' : 'day' }),
        fetchTelemetryLatency(params),
      ])

      if (s.warning)   setWarning(s.warning)
      setSummary(s.data   ?? null)
      setByAgent(a.data   ?? [])
      setTimeseries(ts.data ?? [])
      setLatency(lat.data ?? null)
    } catch (err) {
      setWarning(err.message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load(preset) }, [load, preset])

  // Format timeseries bucket label
  function bucketLabel(bucket) {
    const d = new Date(bucket)
    if (PRESETS[preset].hours <= 24) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const tsFmt = timeseries.map(r => ({
    ...r,
    label:    bucketLabel(r.bucket),
    cost_usd: parseFloat(r.cost_usd ?? 0),
  }))

  const empty = !loading && summary?.total_calls === 0 && byAgent.length === 0

  return (
    <div className="view view--pad">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 12px' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>Cost &amp; Latency</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => { setPreset(i); load(i) }}
              style={{
                padding: '4px 12px', borderRadius: 'var(--r)', border: '0.5px solid var(--border)',
                background: preset === i ? 'var(--green)' : 'var(--bg-2)',
                color: preset === i ? '#fff' : 'var(--text-2)',
                fontSize: 12, cursor: 'pointer', fontWeight: preset === i ? 600 : 400,
              }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {warning && <WarningBanner message={warning} />}

      {loading && <Skeleton />}

      {!loading && empty && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-3)', fontSize: 14 }}>
          No agent calls recorded yet. Start a conversation to see telemetry.
        </div>
      )}

      {!loading && !empty && summary && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0 24px 20px' }}>
            <Card
              label="Total Cost"
              value={`$${parseFloat(summary.total_cost_usd ?? 0).toFixed(4)}`}
              sub={`${PRESETS[preset].label} window`}
            />
            <Card label="Calls" value={(summary.total_calls ?? 0).toLocaleString()} />
            <Card label="Tokens" value={((summary.total_tokens ?? 0) / 1000).toFixed(1) + 'K'} />
            <Card
              label="Error Rate"
              value={summary.total_calls > 0
                ? ((summary.error_count / summary.total_calls) * 100).toFixed(1) + '%'
                : '—'
              }
            />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 24px 20px' }}>
            {/* Cost timeseries */}
            <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Cost over time</div>
              {tsFmt.length === 0
                ? <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>No data</div>
                : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={tsFmt}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `$${v.toFixed(3)}`} width={52} />
                      <Tooltip {...tooltipStyle()} formatter={v => [`$${parseFloat(v).toFixed(5)}`, 'Cost']} />
                      <Line type="monotone" dataKey="cost_usd" stroke="var(--green)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              }
            </div>

            {/* Calls by agent */}
            <div style={{ background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Calls by agent</div>
              {byAgent.length === 0
                ? <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12 }}>No data</div>
                : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={byAgent}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="agent" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle()} />
                      <Bar dataKey="calls" fill="var(--blue)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Latency table */}
          {latency && (
            <div style={{ margin: '0 24px', background: 'var(--bg-2)', border: '0.5px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Response latency (success calls)
              </div>
              <div style={{ display: 'flex' }}>
                {[['P50', latency.p50], ['P95', latency.p95], ['P99', latency.p99]].map(([pct, val]) => (
                  <div key={pct} style={{ flex: 1, padding: '14px 20px', borderRight: '0.5px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{pct}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
                      {val != null ? `${val.toLocaleString()}ms` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
