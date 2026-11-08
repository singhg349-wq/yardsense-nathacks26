import { useEffect, useState } from 'react'
import { getBacktest, getMincost, postDashboard } from '../api'
import './Dashboard.css'

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const optionColors = {
  move_ours: 'var(--opt-move)', rent_sister: 'var(--opt-sister)',
  rent_outside: 'var(--opt-outside)', buy: 'var(--opt-buy)',
}
const optionNames = {
  move_ours: 'Move ours', rent_sister: 'Rent from sister',
  rent_outside: 'Rent outside', buy: 'Buy',
}

// Donut drawn with stroked circles; segments are [{key, name, value, color}].
function Donut({ segments, centre, sub, label }) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0)
  const radius = 42
  const circ = 2 * Math.PI * radius
  const drawn = segments.filter((seg) => seg.value > 0).map((seg, index, all) => ({
    ...seg,
    len: seg.value / total * circ,
    offset: all.slice(0, index).reduce((sum, prev) => sum + prev.value, 0) / total * circ,
  }))
  return <svg className="donut" viewBox="0 0 120 120" role="img" aria-label={label}>
    <circle cx="60" cy="60" r={radius} className="donut-bg" />
    {total > 0 && drawn.map((seg) => <circle key={seg.key} cx="60" cy="60" r={radius} className="donut-seg"
      stroke={seg.color} strokeDasharray={`${seg.len} ${circ - seg.len}`} strokeDashoffset={-seg.offset}
      transform="rotate(-90 60 60)"><title>{`${seg.name}: ${seg.value}`}</title></circle>)}
    <text x="60" y="60" textAnchor="middle" className="donut-centre num">{centre}</text>
    <text x="60" y="75" textAnchor="middle" className="donut-sub">{sub}</text>
  </svg>
}

function Kpi({ tone, glyph, value, label, sub }) {
  return <article className={`kpi card kpi-${tone}`}>
    <span className="kpi-icon" aria-hidden="true">{glyph}</span>
    <div className="kpi-body">
      <strong className="num">{value}</strong>
      <span className="kpi-label">{label}</span>
      <small>{sub}</small>
    </div>
  </article>
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
  const maxOutside = Math.max(1, ...(backtest?.by_class ?? []).map((row) => row.outside_spend))
  const acceptedMix = accepted.reduce((counts, entry) => {
    counts[entry.option.option] = (counts[entry.option.option] ?? 0) + 1
    return counts
  }, {})
  const useAccepted = accepted.length > 0
  const mix = useAccepted ? acceptedMix : (backtest?.option_mix?.recommended ?? {})
  const mixSegments = Object.keys(optionNames).map((key) => ({
    key, name: optionNames[key], value: mix[key] ?? 0, color: optionColors[key] }))
  const mixTotal = mixSegments.reduce((sum, seg) => sum + seg.value, 0)
  const stillOutside = backtest ? Math.max(0, backtest.outside_spend_actual - backtest.outside_spend_avoided) : 0
  const gMax = mincost ? Math.max(mincost.greedy_static.group_cost, mincost.mincost.group_cost, 1) : 1

  return <section className="dashboard-view">
    <div className="dashboard-heading">
      <div><div className="section-kicker">Group impact</div>
        <h1>Equipment dashboard</h1>
        <p>Accepted decisions and the projected use of the current fleet.</p></div>
      <span className="pill muted">Synthetic data</span>
    </div>
    <div className="kpi-row">
      <Kpi tone="orange" glyph="$" value={money.format(kept)} label="Kept in the group"
        sub={`${accepted.length} accepted recommendation${accepted.length !== 1 ? 's' : ''}`} />
      <Kpi tone="green" glyph="↓" value={backtest ? money.format(backtest.outside_spend_avoided) : '—'}
        label="Backtest spend avoided"
        sub={backtest ? `of ${money.format(backtest.outside_spend_actual)} · ${backtest.kept_pct}% (synthetic)` : 'Replaying last year…'} />
      <Kpi tone="red" glyph="!" value={backtest ? backtest.leaks : '—'} label="Rental leaks"
        sub={backtest ? `${backtest.changed_decisions} of ${backtest.requests} decisions would change` : 'Replaying last year…'} />
      <Kpi tone="blue" glyph="%" value={metrics ? `${metrics.utilization_pct}%` : '—'} label="Fleet utilization"
        sub={metrics ? `${metrics.idle_days.toLocaleString()} idle days · ${metrics.fleet_assets} units · ${metrics.horizon_start} to ${metrics.horizon_finish}` : 'Loading fleet plan…'} />
    </div>
    {error && <p className="dashboard-error" role="alert">{error}</p>}

    <div className="dash-grid">
      <article className="card dash-card dashboard-backtest">
        <header className="dash-head">
          <div><div className="section-kicker">Synthetic replay · last 12 months</div>
            <h2>Last year, with YardSense</h2></div>
        </header>
        {backtest ? <>
          <p className="backtest-headline">Of <strong>{money.format(backtest.outside_spend_actual)}</strong> spent outside the group, YardSense would have avoided <strong>{money.format(backtest.outside_spend_avoided)}</strong><span className="backtest-pct"> ({backtest.kept_pct}%)</span>.</p>
          <div className="seg-bar" role="img" aria-label="Avoided versus still-outside spend">
            <div className="seg seg-avoided" style={{ flexGrow: backtest.outside_spend_avoided }} />
            <div className="seg seg-outside" style={{ flexGrow: stillOutside }} />
          </div>
          <div className="legend">
            <span className="legend-item"><i className="legend-swatch" style={{ background: 'var(--green-600)' }} />Avoided</span>
            <span className="legend-item"><i className="legend-swatch" style={{ background: 'var(--red-600)' }} />Still outside {money.format(stillOutside)}</span>
          </div>
          <p className="backtest-sub">{backtest.requests} synthetic requests · {backtest.leaks} rental leaks · {backtest.changed_decisions} decisions would change. Replay, not actual performance.</p>
          <div className="backtest-grid">
            <div className="backtest-table" aria-label="Outside spend avoided by equipment class">
              <div className="backtest-row backtest-head"><span>Class</span><span>Outside spend</span><span>Avoided</span><span>Leaks</span></div>
              {backtest.by_class.slice(0, 5).map((row) => <div className="backtest-row" key={row.class}>
                <span>{row.label}</span>
                <span className="bar-cell"><i style={{ width: `${row.outside_spend / maxOutside * 100}%` }}><u style={{ width: `${row.outside_spend ? row.avoided / row.outside_spend * 100 : 0}%` }} /></i><em className="num">{money.format(row.outside_spend)}</em></span>
                <b className="num">{money.format(row.avoided)}</b>
                <span className="num">{row.leaks}</span>
              </div>)}
            </div>
            <div className="backtest-leaks" aria-label="Largest rental leaks">
              <h3>Largest leaks</h3>
              {backtest.top_leaks.slice(0, 3).map((row) => <div className="backtest-leak" key={row.request_id}>
                <div><strong>{row.project_name}</strong><span>{row.label} · {optionNames[row.actual]} → {optionNames[row.recommended]}</span></div>
                <b className="num">{money.format(row.saved)}</b>
              </div>)}
            </div>
          </div>
          <details className="backtest-assumptions">
            <summary>How this is calculated</summary>
            <ul>{backtest.assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
          </details>
        </> : !backtestError && <p>Replaying last year…</p>}
        {backtestError && <p className="dashboard-error" role="alert">Backtest unavailable: {backtestError}</p>}
      </article>

      <article className="card dash-card dashboard-mincost">
        <header className="dash-head"><div><div className="section-kicker">Optimizer comparison · static snapshot</div>
          <h2>Greedy vs min-cost</h2></div></header>
        {mincost ? <>
          <p className="mincost-headline">Min-cost saves <strong>{money.format(mincost.delta.group_cost)}</strong> on the same {mincost.requests}-request snapshot.</p>
          <div className="cmp">
            <div className="cmp-row"><span>Greedy</span>
              <div className="cmp-track"><div className="cmp-fill cmp-greedy" style={{ width: `${mincost.greedy_static.group_cost / gMax * 100}%` }} /></div>
              <b className="num">{money.format(mincost.greedy_static.group_cost)}</b></div>
            <div className="cmp-row"><span>Min-cost</span>
              <div className="cmp-track"><div className="cmp-fill cmp-min" style={{ width: `${mincost.mincost.group_cost / gMax * 100}%` }} /></div>
              <b className="num">{money.format(mincost.mincost.group_cost)}</b></div>
          </div>
          <div className="cmp-gap"><span>Gap</span><b className="num">{money.format(mincost.delta.group_cost)} ({mincost.delta.pct}%)</b>
            <small>solved in {mincost.runtime_ms} ms</small></div>
          <p className="mincost-note">Live plan stays greedy for explainability.</p>
          <p className="mincost-note">PuLP / CBC exact assignment on a like-for-like static comparison.</p>
          <details className="mincost-assumptions">
            <summary>Assumptions</summary>
            <ul>{mincost.assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
          </details>
        </> : !mincostError && <p>Solving the static assignment…</p>}
        {mincostError && <p className="dashboard-error" role="alert">Min-cost comparison unavailable: {mincostError}</p>}
      </article>

      <article className="card dash-card">
        <header className="dash-head"><div><div className="section-kicker">{useAccepted ? 'Accepted decisions' : 'Backtest recommendations'}</div>
          <h2>Option mix</h2></div></header>
        {mixTotal === 0 ? <p className="dashboard-empty">Accept a recommendation on the Requests tab to see the option mix.</p>
          : <div className="donut-wrap">
            <Donut segments={mixSegments} centre={mixTotal} sub={useAccepted ? 'accepted' : 'requests'}
              label="Option mix" />
            <div className="legend legend-col">{mixSegments.map((seg) => <span className="legend-item" key={seg.key}>
              <i className="legend-swatch" style={{ background: seg.color }} />{seg.name}
              <b className="num">{seg.value}</b></span>)}</div>
          </div>}
      </article>

      <article className="card dash-card">
        <header className="dash-head"><h2>Accepted decisions</h2></header>
        {accepted.length === 0 ? <p className="dashboard-empty">Accept a recommendation on the Requests tab to start measuring group savings.</p>
          : <div className="accepted-list">{accepted.map((entry) => <div className="accepted-row" key={entry.key}>
            <div><strong>{entry.item.qty} × {entry.item.class}</strong><span>{entry.project_name} · {optionNames[entry.option.option]}</span></div>
            <b className="num">{money.format(entry.option.kept_in_group)}</b>
          </div>)}</div>}
      </article>

      <article className="card dash-card">
        <header className="dash-head"><h2>Idle days by equipment class</h2></header>
        {!metrics && <p className="dashboard-empty">Calculating the next 12 weeks…</p>}
        {metrics && <div className="idle-list">{metrics.idle_by_class.map((entry) => <div className="idle-row" key={entry.class}>
          <div><span>{entry.label}</span><strong className="num">{entry.idle_days}</strong></div>
          <div className="idle-track"><div style={{ width: `${entry.idle_days / maxIdle * 100}%` }} /></div>
        </div>)}</div>}
      </article>
    </div>
  </section>
}
