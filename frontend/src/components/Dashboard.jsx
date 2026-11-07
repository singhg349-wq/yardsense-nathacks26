import { useEffect, useState } from 'react'
import { postDashboard } from '../api'
import './Dashboard.css'

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const optionNames = {
  move_ours: 'Move ours', rent_sister: 'Rent from sister',
  rent_outside: 'Rent outside', buy: 'Buy',
}

export default function Dashboard({ shifts, accepted }) {
  const [response, setResponse] = useState(null)
  const shiftKey = JSON.stringify(shifts)
  const metrics = response?.key === shiftKey ? response.data : null
  const error = response?.key === shiftKey ? response.error : ''
  const kept = accepted.reduce((total, entry) => total + entry.option.kept_in_group, 0)

  useEffect(() => {
    let cancelled = false
    postDashboard(shifts).then((data) => {
      if (!cancelled) setResponse({ key: shiftKey, data, error: '' })
    }).catch((err) => {
      if (!cancelled) setResponse({ key: shiftKey, data: null, error: err.message })
    })
    return () => { cancelled = true }
  }, [shifts, shiftKey])

  const maxIdle = Math.max(1, ...(metrics?.idle_by_class ?? []).map((entry) => entry.idle_days))

  return <section className="dashboard-view">
    <div className="dashboard-heading"><div className="section-kicker">Group impact</div>
      <h1>Equipment dashboard</h1>
      <p>Accepted decisions and the projected use of the current fleet.</p>
    </div>
    <div className="dashboard-stat-grid">
      <article className="dashboard-stat dashboard-stat-primary"><span>Kept in the group</span>
        <strong>{money.format(kept)}</strong><small>From {accepted.length} accepted recommendation{accepted.length !== 1 ? 's' : ''}</small></article>
      <article className="dashboard-stat"><span>Projected idle days</span>
        <strong>{metrics ? metrics.idle_days.toLocaleString() : '—'}</strong>
        <small>Current fleet · next 12 weeks</small></article>
      <article className="dashboard-stat"><span>Fleet utilization</span>
        <strong>{metrics ? `${metrics.utilization_pct}%` : '—'}</strong>
        <small>{metrics ? `${metrics.fleet_assets} units · ${metrics.horizon_start} to ${metrics.horizon_finish}` : 'Loading fleet plan…'}</small></article>
    </div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}
    <div className="dashboard-details">
      <article className="dashboard-panel">
        <h2>Accepted decisions</h2>
        {accepted.length === 0 ? <p className="dashboard-empty">Accept a recommendation on the Requests tab to start measuring group savings.</p>
          : <div className="accepted-list">{accepted.map((entry) => <div className="accepted-row" key={entry.key}>
            <div><strong>{entry.item.qty} × {entry.item.class}</strong><span>{entry.project_name} · {optionNames[entry.option.option]}</span></div>
            <b>{money.format(entry.option.kept_in_group)}</b>
          </div>)}</div>}
      </article>
      <article className="dashboard-panel">
        <h2>Idle days by equipment class</h2>
        {!metrics && <p className="dashboard-empty">Calculating the next 12 weeks…</p>}
        {metrics && <div className="idle-list">{metrics.idle_by_class.map((entry) => <div className="idle-row" key={entry.class}>
          <div><span>{entry.label}</span><strong>{entry.idle_days}</strong></div>
          <div className="idle-track"><div style={{ width: `${entry.idle_days / maxIdle * 100}%` }} /></div>
        </div>)}</div>}
      </article>
    </div>
    <article className="dashboard-panel dashboard-backtest">
      <div><div className="section-kicker">Historical comparison</div><h2>Last year, with YardSense</h2>
        <p>Past requests and decisions will appear here when the backtest is ready.</p></div>
      <div className="backtest-placeholder">Backtest result pending</div>
    </article>
  </section>
}
