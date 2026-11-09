import { useEffect, useState } from 'react'
import { getPlan, postPlan } from '../api'
import Timeline from './Timeline'
import { className } from './classNames'
import ReplanCard from './ReplanCard'
import { countSources } from './optionParts'
import './PlannerView.css'

const DAY_MS = 24 * 60 * 60 * 1000
const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const optionNames = {
  move_ours: 'Move ours', rent_sister: 'Rent from sister',
  rent_outside: 'Rent outside', buy: 'Buy', split: 'Split',
}

function dayDifference(after, before) {
  return Math.round((Date.parse(`${after}T00:00:00Z`) - Date.parse(`${before}T00:00:00Z`)) / DAY_MS)
}

export default function PlannerView({ shifts, onSetShift }) {
  const [baseline, setBaseline] = useState(null)
  const [shifted, setShifted] = useState(null)
  const [error, setError] = useState('')
  const shiftKey = JSON.stringify(shifts)
  const fresh = shifts.length === 0 || shifted?.key === shiftKey
  // Keep the last plan on screen while a new one loads.
  const plan = shifts.length === 0 ? baseline : (shifted?.key === shiftKey ? shifted.plan : (shifted?.plan ?? baseline))
  const updating = plan !== null && !fresh && !error
  const busy = plan === null && !error

  useEffect(() => {
    let cancelled = false
    getPlan().then((data) => { if (!cancelled) setBaseline(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!baseline || shifts.length === 0) return
    let cancelled = false
    postPlan(shifts).then((data) => {
      if (cancelled) return
      setShifted({ key: shiftKey, plan: data })
      setError('')
    }).catch((err) => {
      if (!cancelled) setError(err.message)
    })
    return () => { cancelled = true }
  }, [baseline, shifts, shiftKey])

  function shiftBy(projectId, days) {
    const current = shifts.find((shift) => shift.project_id === projectId)?.days ?? 0
    onSetShift(projectId, current + days)
  }

  function changeStart(projectId, nextStart) {
    const original = baseline?.projects.find((project) => project.id === projectId)
    if (original && nextStart) onSetShift(projectId, dayDifference(nextStart, original.start_date))
  }

  const kingswayDays = shifts.find((shift) => shift.project_id === 'PRJ-KNG')?.days ?? 0
  const names = Object.fromEntries((plan?.projects ?? []).map((project) => [project.id, project.name]))
  const changedIds = new Set((plan?.changed ?? []).map((change) => change.request_id))
  // A split allocation counts once for each source it uses.
  const optionCounts = countSources(plan?.allocations ?? [])

  const mixOptions = [['move_ours', 'Move ours', 'move'], ['rent_sister', 'Sister', 'sister'],
    ['rent_outside', 'Outside', 'outside'], ['buy', 'Buy', 'buy']]
  const mixTotal = plan?.allocations?.length ?? 0

  return <section className="planner-view">
    <div className="planner-heading">
      <div><div className="section-kicker">Forward plan · what-if</div><h1>Group timeline</h1></div>
      <button className="demo-slip-button" type="button" onClick={() => onSetShift('PRJ-KNG', kingswayDays === 42 ? 0 : 42)}>
        {kingswayDays === 42 ? 'Reset Kingsway date' : 'Slip Kingsway 6 weeks'}
      </button>
    </div>
    {updating && <p className="planner-updating" role="status">updating…</p>}
    {error && <p className="planner-error" role="alert">{error}</p>}
    {plan && <>
      <div className="planner-cards">
        <div className="planner-tile card planner-tile-cost">
          <span className="planner-tile-label">Group cost</span>
          <strong className="num">{money.format(plan.totals?.group_cost ?? 0)}</strong>
          <small>what leaves the group for this plan</small>
        </div>
        <div className="planner-tile card planner-tile-kept">
          <span className="planner-tile-label">Kept in group</span>
          <strong className="num">{money.format(plan.totals?.kept_in_group ?? 0)}</strong>
          <small>versus renting everything outside</small>
        </div>
        <div className="planner-tile card planner-tile-mix">
          <span className="planner-tile-label">Option mix · {mixTotal} allocations</span>
          <div className="planner-mixbar" role="img" aria-label="Option mix">
            {mixOptions.map(([key, , cls]) => (optionCounts[key] ?? 0) > 0 &&
              <i key={key} className={`tl-opt-${cls}`} style={{ flexGrow: optionCounts[key] }} />)}
          </div>
          <div className="planner-mixlist">
            {mixOptions.map(([key, label, cls]) => <span key={key} className="legend-item">
              <i className={`legend-swatch tl-opt-${cls}`} />{label} <b className="num">{optionCounts[key] ?? 0}</b></span>)}
          </div>
        </div>
        <div className="planner-tile card">
          <span className="planner-tile-label">Changed by what-if</span>
          <strong className="num">{plan.changed.length}</strong>
          <small>{shifts.length ? `${shifts.length} project${shifts.length !== 1 ? 's' : ''} shifted` : 'no project shifted'}</small>
        </div>
      </div>
      <div className="planner-date-controls">
        {plan.projects.map((project) => <label key={project.id}>{project.name}
          <input type="date" value={project.start_date}
            onChange={(event) => changeStart(project.id, event.target.value)} />
        </label>)}
      </div>
      <div className={`planner-change-banner ${plan.changed.length ? 'has-changes' : ''}`} aria-live="polite">
        {plan.changed.length ? <>
          <strong>{plan.changed.length} recommendation{plan.changed.length !== 1 ? 's' : ''} changed</strong>
          <ul>{plan.changed.map((change) => <li key={change.request_id}>
            {names[change.project_id]} · {className(change.class)}: {optionNames[change.from_option]} → <b>{optionNames[change.to_option]}</b>
          </li>)}</ul>
        </> : <span>Move a project to see how recommendations change.</span>}
      </div>
      <div className={`planner-chart ${updating ? 'planner-chart-busy' : ''}`}>
        <Timeline projects={plan.projects} allocations={plan.allocations}
          changedIds={changedIds} onShiftProject={shiftBy} shifts={shifts} />
      </div>
    </>}
    {!plan && busy && <p className="planner-loading">Loading the group plan…</p>}
    <ReplanCard shifts={shifts} />
  </section>
}
