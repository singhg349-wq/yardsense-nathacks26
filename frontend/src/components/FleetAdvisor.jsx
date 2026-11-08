import { useEffect, useState } from 'react'
import { getFleetAdvisor } from '../api'
import './FleetAdvisor.css'

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const ACTION_LABELS = { add: 'Add', retire: 'Retire', hold: 'Hold' }

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

  const counts = data ? data.items.reduce((total, item) => {
    total[item.action] = (total[item.action] ?? 0) + 1
    return total
  }, {}) : {}

  return <section className="fleet-view">
    <div className="fleet-heading">
      <div className="section-kicker">Northgate Rentals · forward fleet</div>
      <h1>Fleet advisor</h1>
      <p>What the group's next 12 months imply for the rental company's fleet. Every call shows its rule.</p>
    </div>
    {error && <p className="fleet-error" role="alert">Couldn't load the fleet advice ({error}). Check that the backend is running.</p>}
    {!data && !error && <p className="fleet-loading">Reading the pipeline…</p>}
    {data && <>
      <div className="fleet-kpis">
        <article className="fleet-kpi fleet-kpi-add"><span>Add</span><strong>{counts.add ?? 0}</strong><small>classes with a peak gap</small></article>
        <article className="fleet-kpi fleet-kpi-retire"><span>Retire</span><strong>{counts.retire ?? 0}</strong><small>classes with surplus capacity</small></article>
        <article className="fleet-kpi"><span>Hold</span><strong>{counts.hold ?? 0}</strong><small>fleet matches demand</small></article>
        <article className="fleet-kpi"><span>As of</span><strong>{data.as_of}</strong><small>next {data.horizon_months} months</small></article>
      </div>
      <div className="fleet-list">
        {data.items.map((item) => <article className={`fleet-card fleet-${item.action}`} key={item.class}>
          <div className="fleet-card-head">
            <div>
              <h2>{item.label}</h2>
              <span>{item.owned} owned · peak {item.peak_units} · {item.utilization_pct}% utilized</span>
            </div>
            <span className={`fleet-action fleet-${item.action}`}>
              {item.action === 'hold' ? ACTION_LABELS.hold : `${ACTION_LABELS[item.action]} ${item.quantity}`}
            </span>
          </div>
          <div className="fleet-bar" aria-hidden="true">
            <div style={{ width: `${Math.min(100, item.utilization_pct)}%` }} />
          </div>
          <p className="fleet-reason">{item.reason}</p>
          <div className="fleet-meta">
            {item.breakeven_month && <span>Break-even: month {item.breakeven_month}</span>}
            {item.annual_impact > 0 && <span>{item.action === 'retire' ? 'Carrying cost saved' : 'Outside rental avoided'}: <b>{money.format(item.annual_impact)}/yr</b></span>}
            <span>{item.pipeline_days} pipeline days</span>
          </div>
        </article>)}
      </div>
      <details className="fleet-rules">
        <summary>How the advisor decides</summary>
        <ul>{data.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </details>
      <p className="fleet-footnote">Synthetic pipeline data. Not a forecast of actual demand.</p>
    </>}
  </section>
}
