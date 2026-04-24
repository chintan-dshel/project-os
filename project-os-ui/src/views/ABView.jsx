import { useState, useEffect } from 'react'
import { listVariants, toggleVariant, fetchExperimentResults } from '../lib/api.js'

const AGENTS = ['intake', 'planning', 'execution', 'retro']

function VariantRow({ v, onToggle }) {
  return (
    <tr className="ab__row">
      <td className="ab__cell">{v.experiment_key}</td>
      <td className="ab__cell">{v.variant_name}</td>
      <td className="ab__cell">{v.agent}</td>
      <td className="ab__cell ab__mono">{v.model.replace('claude-', '').replace('-20250514','').replace('-20251001','').replace('-20251101','')}</td>
      <td className="ab__cell ab__center">{v.traffic_weight}%</td>
      <td className="ab__cell ab__center">
        <button
          className={`ab__toggle ${v.active ? 'ab__toggle--on' : 'ab__toggle--off'}`}
          onClick={() => onToggle(v.id, !v.active)}
        >
          {v.active ? 'Active' : 'Off'}
        </button>
      </td>
    </tr>
  )
}

function ResultsPanel({ experimentKey, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExperimentResults(experimentKey)
      .then(setData)
      .catch(err => setData({ error: err.message }))
      .finally(() => setLoading(false))
  }, [experimentKey])

  return (
    <div className="ab__results-panel">
      <div className="ab__results-header">
        <span className="ab__results-key">{experimentKey}</span>
        <button className="ab__close-btn" onClick={onClose}>✕</button>
      </div>

      {loading && <p className="ab__loading">Loading…</p>}
      {data?.error && <p className="ab__error">{data.error}</p>}
      {data?.sample_size_warning && (
        <div className="ab__warning">
          Results are preliminary — fewer than {data.min_sample} samples per variant.
          Don't draw conclusions yet.
        </div>
      )}
      {data?.results && (
        <table className="ab__results-table">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Model</th>
              <th>n</th>
              <th>Avg Judge</th>
              <th>Avg Latency</th>
              <th>Cost</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map(r => (
              <tr key={r.variant_name}>
                <td>{r.variant_name}</td>
                <td className="ab__mono">{r.model.replace('claude-','')}</td>
                <td>{r.sample_size}</td>
                <td>{r.avg_judge_score?.toFixed(2) ?? '—'}</td>
                <td>{r.avg_latency_ms ? `${r.avg_latency_ms}ms` : '—'}</td>
                <td>${r.total_cost_usd?.toFixed(4) ?? '0.0000'}</td>
                <td className={r.error_count > 0 ? 'ab__cell--red' : ''}>{r.error_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function ABView() {
  const [variants, setVariants]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [viewing, setViewing]     = useState(null)
  const [agentFilter, setAgent]   = useState('all')

  useEffect(() => {
    listVariants()
      .then(setVariants)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(id, active) {
    await toggleVariant(id, active)
    setVariants(vs => vs.map(v => v.id === id ? { ...v, active } : v))
  }

  const shown = agentFilter === 'all' ? variants : variants.filter(v => v.agent === agentFilter)
  const experiments = [...new Set(shown.map(v => v.experiment_key))]

  return (
    <div className="view view--pad">
      <div className="view__header">
        <h2 className="view__title">A/B Experiments</h2>
        <div className="ab__filters">
          {['all', ...AGENTS].map(a => (
            <button
              key={a}
              className={`ab__filter-btn ${agentFilter === a ? 'ab__filter-btn--active' : ''}`}
              onClick={() => setAgent(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="view__empty">Loading variants…</p>}

      {!loading && !variants.length && (
        <p className="view__empty">No A/B variants configured. Use the API to create experiments.</p>
      )}

      {!loading && !!variants.length && (
        <table className="ab__table">
          <thead>
            <tr>
              <th>Experiment</th>
              <th>Variant</th>
              <th>Agent</th>
              <th>Model</th>
              <th>Weight</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(v => <VariantRow key={v.id} v={v} onToggle={handleToggle} />)}
          </tbody>
        </table>
      )}

      <div className="ab__exp-list">
        <h3 className="ab__section-title">Experiment Results</h3>
        {!experiments.length
          ? <p className="view__empty">No experiments to show.</p>
          : experiments.map(key => (
            <button key={key} className="ab__exp-btn" onClick={() => setViewing(key)}>
              {key}
            </button>
          ))
        }
      </div>

      {viewing && (
        <ResultsPanel experimentKey={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
