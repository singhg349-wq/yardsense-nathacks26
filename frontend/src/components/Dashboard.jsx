import { useEffect, useState } from 'react'
import { getBacktest, getMincost, postDashboard } from '../api'
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
  const [backtest, setBacktest] = useState(null)
  const [backtestError, setBacktestError] = useState('')
  const [mincost, setMincost] = useState(null)
  const [mincostError, setMincostError] = useState('')
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

  useEffect(() => {
    let cancelled = false
    getBacktest().then((data) => {
      if (!cancelled) { setBacktest(data); setBacktestError('') }
    }).catch((err) => {
      if (!cancelled) setBacktestError(err.message)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getMincost().then((data) => {
      if (!cancelled) { setMincost(data); setMincostError('') }
    }).catch((err) => {
      if (!cancelled) setMincostError(err.message)
    })
    return () => { cancelled = true }
  }, [])

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
      <div className="backtest-heading">
        <div className="section-kicker">Synthetic replay · last 12 months</div>
        <h2>Last year, with YardSense</h2>
        {backtest ? <>
          <p className="backtest-headline">Of <strong>{money.format(backtest.outside_spend_actual)}</strong> spent outside the group, YardSense would have avoided <strong>{money.format(backtest.outside_spend_avoided)}</strong><span className="backtest-pct"> ({backtest.kept_pct}%)</span>.</p>
          <p className="backtest-sub">{backtest.requests} synthetic requests · {backtest.leaks} rental leaks · {backtest.changed_decisions} decisions would change. Replay, not actual performance.</p>
        </> : !backtestError && <p>Replaying last year…</p>}
        {backtestError && <p className="dashboard-error" role="alert">Backtest unavailable: {backtestError}</p>}
      </div>
      {backtest && <div className="backtest-grid">
        <div className="backtest-table" aria-label="Outside spend avoided by equipment class">
          <div className="backtest-row backtest-head"><span>Class</span><span>Outside spend</span><span>Avoided</span><span>Leaks</span></div>
          {backtest.by_class.slice(0, 5).map((row) => <div className="backtest-row" key={row.class}>
            <span>{row.label}</span><span>{money.format(row.outside_spend)}</span>
            <b>{money.format(row.avoided)}</b><span>{row.leaks}</span>
          </div>)}
        </div>
        <div className="backtest-leaks" aria-label="Largest rental leaks">
          <h3>Largest leaks</h3>
          {backtest.top_leaks.slice(0, 3).map((row) => <div className="backtest-leak" key={row.request_id}>
            <div><strong>{row.project_name}</strong><span>{row.label} · {optionNames[row.actual]} → {optionNames[row.recommended]}</span></div>
            <b>{money.format(row.saved)}</b>
          </div>)}
        </div>
      </div>}
      {backtest && <details className="backtest-assumptions">
        <summary>How this is calculated</summary>
        <ul>{backtest.assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
      </details>}
    </article>
    <article className="dashboard-panel dashboard-mincost">
      <div className="mincost-heading">
        <div className="section-kicker">Optimizer comparison · static snapshot</div>
        <h2>Greedy vs min-cost</h2>
        {mincost ? <>
          <p className="mincost-headline">Min-cost saves <strong>{money.format(mincost.delta.group_cost)}</strong> ({mincost.delta.pct}%) on the same {mincost.requests}-request snapshot.</p>
          <div className="mincost-grid">
            <div><span>Greedy</span><strong>{money.format(mincost.greedy_static.group_cost)}</strong></div>
            <div><span>Min-cost</span><strong>{money.format(mincost.mincost.group_cost)}</strong></div>
            <div><span>Solved in</span><strong>{mincost.runtime_ms} ms</strong></div>
          </div>
          <p className="mincost-note">PuLP / CBC exact assignment. The live plan still uses the dynamic greedy engine; this is a like-for-like static comparison.</p>
          <details className="mincost-assumptions">
            <summary>Assumptions</summary>
            <ul>{mincost.assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
          </details>
        </> : !mincostError && <p>Solving the static assignment…</p>}
        {mincostError && <p className="dashboard-error" role="alert">Min-cost comparison unavailable: {mincostError}</p>}
      </div>
    </article>
  </section>
}
