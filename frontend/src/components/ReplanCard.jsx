import { useEffect, useState } from 'react'
import { postReplan } from '../api'
import './ReplanCard.css'

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })

const OPTIONS = {
  move_ours: ['Move ours', 'move'],
  rent_sister: ['Sister', 'sister'],
  rent_outside: ['Outside', 'outside'],
  buy: ['Buy', 'buy'],
}

function OptionPill({ option }) {
  const [label, tone] = OPTIONS[option] ?? [option, 'muted']
  return <span className={`pill ${tone}`}>{label}</span>
}

export default function ReplanCard({ shifts = [] }) {
  const shiftKey = JSON.stringify(shifts)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    postReplan(JSON.parse(shiftKey))
      .then((data) => { if (!cancelled) { setResult({ key: shiftKey, data }); setError(null) } })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [shiftKey])

  const data = result?.key === shiftKey ? result.data : null
  if (error) return <aside className="replan-card card"><p className="replan-muted" role="alert">Re-plan check unavailable: {error}</p></aside>
  if (!data) return <aside className="replan-card card"><p className="replan-muted">Checking for a cheaper re-plan…</p></aside>

  const gap = Math.max(0, data.greedy_cost - data.replan_cost)
  return <aside className="replan-card card" aria-label="Re-plan suggestion">
    {data.recommend ? <>
      <div className="replan-kicker">Re-plan open requests</div>
      <div className="replan-headline">saves <span className="num replan-big">{money.format(data.net_saving)}</span> net</div>
    </> : <>
      <div className="replan-kicker">Re-plan check</div>
      <div className="replan-headline">Current plan is already within <span className="num">{money.format(gap)}</span> of the best re-plan</div>
    </>}
    <div className="replan-stats">
      <span>Switching cost <b className="num">{money.format(data.switching_cost)}</b></span>
      <span><b className="num">{data.locked_count}</b> locked (already started)</span>
    </div>
    {data.recommend && data.changes.length > 0 && <ul className="replan-changes">
      {data.changes.map((change) => <li key={`${change.request_id}-${change.from_asset}-${change.to_asset}`}>
        <span className="replan-what">{change.project} · {change.class}</span>
        <span className="replan-pills"><OptionPill option={change.from_option} /> → <OptionPill option={change.to_option} /></span>
        <span className={`num replan-saving ${change.saving < 0 ? 'is-loss' : ''}`}>{change.saving < 0 ? '−' : '+'}{money.format(Math.abs(change.saving))}</span>
      </li>)}
    </ul>}
    <p className="replan-muted">Suggestion only — the live plan does not change until accepted.</p>
  </aside>
}
