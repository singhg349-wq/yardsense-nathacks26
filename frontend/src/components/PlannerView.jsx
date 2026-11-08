import { useEffect, useState } from 'react'
import { getPlan, postPlan } from '../api'
import Timeline from './Timeline'
import ReplanCard from './ReplanCard'
import './PlannerView.css'

const DAY_MS = 24 * 60 * 60 * 1000
const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const optionNames = {
  move_ours: 'Move ours', rent_sister: 'Rent from sister',
  rent_outside: 'Rent outside', buy: 'Buy',
}

function dayDifference(after, before) {
  return Math.round((Date.parse(`${after}T00:00:00Z`) - Date.parse(`${before}T00:00:00Z`)) / DAY_MS)
}

export default function PlannerView({ shifts, onSetShift }) {
  const [baseline, setBaseline] = useState(null)
  const [shifted, setShifted] = useState(null)
  const [error, setError] = useState('')
  const shiftKey = JSON.stringify(shifts)
  const plan = shifts.length === 0 ? baseline : shifted?.key === shiftKey ? shifted.plan : null
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
  const optionCounts = (plan?.allocations ?? []).reduce((counts, row) => {
    counts[row.option] = (counts[row.option] ?? 0) + 1
    return counts
  }, {})

  return <section className="planner-view">
    <div className="planner-heading">
      <div><div className="section-kicker">Forward plan · what-if</div><h1>Group timeline</h1>
        <p>Drag a project bar or edit its start date to see how the group plan changes. This is a what-if; it does not edit the Procore schedule.</p></div>
      <button className="demo-slip-button" type="button" onClick={() => onSetShift('PRJ-KNG', kingswayDays === 42 ? 0 : 42)}>
        {kingswayDays === 42 ? 'Reset Kingsway date' : 'Slip Kingsway 6 weeks'}
      </button>
    </div>
    {error && <p className="planner-error" role="alert">{error}</p>}
    {plan && <>
      <div className="planner-summary">
        <div className="planner-summary-main">
          <div className="section-kicker">Plan snapshot</div>
          <strong>{money.format(plan.totals?.group_cost ?? 0)}</strong>
          <span>group cost · {money.format(plan.totals?.kept_in_group ?? 0)} kept in group versus outside rental</span>
        </div>
        <div className="planner-summary-mix">
          {[['move_ours', 'Move ours'], ['rent_sister', 'Sister'], ['rent_outside', 'Outside'], ['buy', 'Buy']]
            .map(([key, label]) => <span key={key}>{label} <b>{optionCounts[key] ?? 0}</b></span>)}
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
            {names[change.project_id]} · {change.class}: {optionNames[change.from_option]} → <b>{optionNames[change.to_option]}</b>
          </li>)}</ul>
        </> : <span>Move a project to see how recommendations change.</span>}
      </div>
      <div className={`planner-chart ${busy ? 'planner-chart-busy' : ''}`}>
        <Timeline projects={plan.projects} allocations={plan.allocations}
          changedIds={changedIds} onShiftProject={shiftBy} />
      </div>
    </>}
    {!plan && busy && <p className="planner-loading">Loading the group plan…</p>}
    <ReplanCard shifts={shifts} />
  </section>
}
