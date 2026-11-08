import { useEffect, useState } from 'react'
import { getFleetAdvisor } from '../api'
import './FleetAdvisor.css'

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const ACTION_LABELS = { add: 'Add', retire: 'Retire', hold: 'Hold' }
const PILL_CLASS = { add: 'buy', retire: 'outside', hold: 'muted' }
const SEGMENTS = 20

export default function FleetAdvisor() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getFleetAdvisor().then((response) => {
      if (!cancelled) { setData(response); setError('') }
    }).catch((err) => {
      if (!cancelled) setError(err.message)
    })
    return () => { cancelled = true }
  }, [])

  const items = data?.items ?? []
  const counts = items.reduce((total, item) => {
    total[item.action] = (total[item.action] ?? 0) + 1
    return total
  }, {})
  const totalImpact = data?.total_annual_impact
    ?? items.reduce((sum, item) => sum + (item.annual_impact ?? 0), 0)

  return <section className="fleet-view">
    <div className="fleet-heading">
      <div className="section-kicker">Northgate Group · forward fleet</div>
      <h1>Fleet advisor</h1>
      <p>What the group's next 12 months imply for its fleet, counting every company's units and leaving out units on outside hire. Every call shows its rule and its net of owning cost.</p>
    </div>
    {error && <p className="fleet-error" role="alert">Couldn't load the fleet advice ({error}). Check that the backend is running.</p>}
    {!data && !error && <p className="fleet-loading">Reading the pipeline…</p>}
    {data && <>
      <div className="fleet-kpis">
        <article className="card fleet-kpi fleet-kpi-impact">
          <span>Net annual impact</span>
          <strong className="num">{money.format(totalImpact)}</strong>
          <small>as of {data.as_of} · next {data.horizon_months} months</small>
        </article>
        <article className="card fleet-kpi fleet-kpi-add"><span>Add</span><strong className="num">{counts.add ?? 0}</strong><small>classes where another unit pays for itself</small></article>
        <article className="card fleet-kpi fleet-kpi-retire"><span>Retire</span><strong className="num">{counts.retire ?? 0}</strong><small>classes with an idle surplus unit</small></article>
        <article className="card fleet-kpi fleet-kpi-hold"><span>Hold</span><strong className="num">{counts.hold ?? 0}</strong><small>no change pays</small></article>
      </div>
      <div className="legend fleet-legend">
        <span className="legend-item"><span className="pill buy">Add</span> buy capacity</span>
        <span className="legend-item"><span className="pill outside">Retire</span> shed surplus</span>
        <span className="legend-item"><span className="pill muted">Hold</span> no change</span>
        <span className="legend-item"><span className="legend-swatch fleet-swatch-on" /> fleet-days in use</span>
        <span className="legend-item"><span className="legend-swatch fleet-swatch-off" /> idle</span>
      </div>
      <div className="fleet-list">
        {items.map((item) => {
          const hasUtil = item.utilization_pct !== null && item.utilization_pct !== undefined
          const pct = hasUtil ? Math.max(0, Math.min(100, item.utilization_pct)) : 0
          const nextUnit = item.next_unit
          const filled = Math.round((pct / 100) * SEGMENTS)
          return <article className={`card fleet-card fleet-${item.action}`} key={item.class}>
            <div className="fleet-card-head">
              <div>
                <h2>{item.label}</h2>
                <span>{item.owned} in group · {item.supply ?? item.owned} usable{item.on_outside_hire ? ` (${item.on_outside_hire} on outside hire)` : ''} · peak {item.peak_units} · {item.pipeline_days} pipeline days</span>
              </div>
              <span className={`pill ${PILL_CLASS[item.action] ?? 'muted'}`}>
                {item.action === 'hold' ? ACTION_LABELS.hold : `${ACTION_LABELS[item.action]} ${item.quantity}`}
              </span>
            </div>
            <div className="fleet-util">
              <div className="fleet-bar" aria-hidden="true">
                {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < filled ? 'on' : ''} />)}
              </div>
              <span className="num fleet-util-pct">{hasUtil ? `${item.utilization_pct}%` : '—'}<small> {hasUtil ? 'utilized' : 'none usable'}</small></span>
            </div>
            <p className="fleet-reason">{item.reason}</p>
            <div className="fleet-meta">
              {item.action !== 'hold' && <div>
                <span>Net annual impact</span>
                <b className="num fleet-impact">{money.format(item.annual_impact)}/yr</b>
              </div>}
              {item.action === 'add' && <div>
                <span>Break-even</span>
                <b className="num">{item.breakeven_month ? `${item.breakeven_month} months` : "Doesn't pay back"}</b>
              </div>}
              {item.action === 'hold' && nextUnit && <>
                <div>
                  <span>Next unit, net annual impact</span>
                  <b className={`num ${nextUnit.net_annual_impact > 0 ? 'fleet-impact' : 'fleet-loss'}`}>{money.format(nextUnit.net_annual_impact)}/yr</b>
                </div>
                <div>
                  <span>Break-even</span>
                  <b className="num">{nextUnit.breakeven_month ? `${nextUnit.breakeven_month} months` : "Doesn't pay back"}</b>
                </div>
              </>}
            </div>
          </article>
        })}
      </div>
      <details className="fleet-rules">
        <summary>How the advisor decides</summary>
        <ul>{data.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </details>
      <p className="fleet-footnote">Synthetic pipeline data. Not a forecast of actual demand.</p>
    </>}
  </section>
}
