import { useEffect, useState } from 'react'
import { getClasses, getProjects, recommend } from '../api'
import { acceptKey } from '../acceptKey'
import { countSources } from './optionParts'
import './RequestScreen.css'

const demoItems = [
  { id: 1, class: 'SCISSOR_19', qty: 2, start: '2026-11-23', finish: '2027-01-31' },
  { id: 2, class: 'TELEHANDLER', qty: 1, start: '2026-11-23', finish: '2027-01-31' },
  { id: 3, class: 'GEN_45KW', qty: 1, start: '2026-11-23', finish: '2027-01-31' },
]
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const noShifts = []
const payloadItem = (item) => ({ class: item.class, qty: Number(item.qty),
  start: item.start, finish: item.finish })

const pillClass = { move_ours: 'move', rent_sister: 'sister', rent_outside: 'outside', buy: 'buy' }
const shortNames = { move_ours: 'Move ours', rent_sister: 'Rent from sister', rent_outside: 'Rent outside', buy: 'Buy' }

const classLabels = { SCISSOR_19: '19 ft scissor lifts', TELEHANDLER: 'telehandlers', GEN_45KW: '45 kW generators' }

// Friendlier wording for the "Only 0 idle ..." reason; other reasons pass through.
function friendlyReason(reason, item) {
  if (typeof reason !== 'string') return reason
  const shown = reason.replace(/NB01\/NE01|NB01|NE01/g, 'Northgate')
  if (!shown.startsWith('Only 0 idle')) return shown
  const need = shown.match(/need (\d+)/)?.[1] ?? item?.qty
  const noun = classLabels[item?.class] ?? shown.match(/^Only 0 idle (.+?) unit\(s\)/)?.[1]
  if (!noun || !need) return shown
  return `No idle ${noun} in the group (need ${need})`
}

function Option({ option: rawOption, item, best, maxCost, accepted, onAccept }) {
  const option = { ...rawOption, reason: friendlyReason(rawOption.reason, item) }
  const kind = pillClass[option.option] ?? 'muted'
  const width = maxCost > 0 ? Math.max(3, (option.group_cost / maxCost) * 100) : 0
  return <article className={`option ${best ? 'option-first' : ''} ${!option.available ? 'option-unavailable' : ''}`}>
    <div className="option-row">
      <div className="option-name">
        {option.units?.length
          ? <span className="split-parts" aria-label="Split">{option.units.map((part, index) => <span key={part.option}>
            {index > 0 && <span className="split-plus">+</span>}
            <span className={`pill ${pillClass[part.option] ?? 'muted'}`}>{part.qty} × {shortNames[part.option] ?? part.option}</span>
          </span>)}</span>
          : <span className={`pill ${kind}`}>{shortNames[option.option] ?? option.option}</span>}
        {best && <span className="best-mark">&#9733; Best</span>}
      </div>
      {option.available
        ? <div className="bar-track">{option.units?.length
          ? <div className="bar-split" style={{ width: `${width}%` }}>{option.units.map((part) => <div key={part.option}
            className={`bar-fill bar-${pillClass[part.option] ?? 'muted'}`} style={{ flexGrow: Math.max(part.group_cost, 1) }} />)}</div>
          : <div className={`bar-fill bar-${kind}`} style={{ width: `${width}%` }} />}</div>
        : <div className="bar-track bar-hatch"><span>{option.reason}</span></div>}
      {option.available && <div className="option-costs">
        <strong className="num">{money.format(option.group_cost)}</strong>
        <span className="num">project {money.format(option.project_cost)}</span>
      </div>}
    </div>
    {option.available && <div className="option-detail">
      <p>{option.reason}</p>
      {(option.breakdown?.length > 0 || option.group_breakdown?.length > 0) && <details className="option-why">
        <summary>Why this?</summary>
        <div className="why-columns">
          <div><h4>Project pays <b className="num">{money.format(option.project_cost)}</b></h4>
            <ul>{option.breakdown.map((row) => <li key={row.label}>
              <span>{row.label}</span><b className="num">{money.format(row.amount)}</b>
            </li>)}</ul></div>
          {option.group_breakdown?.length > 0 && <div><h4>Group pays <b className="num">{money.format(option.group_cost)}</b></h4>
            <ul>{option.group_breakdown.map((row) => <li key={row.label}>
              <span>{row.label}</span><b className="num">{money.format(row.amount)}</b>
            </li>)}</ul></div>}
        </div>
        <p>Group cost is what leaves Northgate Group. Project cost is what the project is charged.</p>
      </details>}
    </div>}
    {best && <div className="option-action">
      <span>{money.format(option.kept_in_group)} kept in the group versus outside rental</span>
      <button type="button" onClick={onAccept} disabled={accepted}>
        {accepted ? 'Accepted' : 'Accept recommendation'}
      </button>
    </div>}
  </article>
}

function Summary({ items, acceptedEntries }) {
  const picks = items.map((item) => item.options.find((option) => option.available)).filter(Boolean)
  const sum = (key) => picks.reduce((total, option) => total + (option[key] ?? 0), 0)
  const mix = countSources(picks)
  return <div className="kpi-strip">
    <div className="kpi kpi-hero"><span>Recommended</span><strong className="num">{money.format(sum('kept_in_group'))} kept</strong>
      <span className="kpi-accepted">Accepted: <b className="num">{money.format(acceptedEntries.reduce((total, entry) => total + entry.option.kept_in_group, 0))} kept</b> ({acceptedEntries.length} of {items.length})</span></div>
    <div className="kpi"><span>Group cost</span><strong className="num">{money.format(sum('group_cost'))}</strong></div>
    <div className="kpi"><span>Project cost</span><strong className="num">{money.format(sum('project_cost'))}</strong></div>
    <div className="kpi"><span>Option mix</span><div className="kpi-mix">
      {Object.entries(mix).map(([key, count]) => <span key={key} className={`pill ${pillClass[key] ?? 'muted'}`}>{count} {shortNames[key] ?? key}</span>)}
    </div></div>
  </div>
}

export default function RequestScreen({ shifts = noShifts, accepted: acceptedProp = noShifts, onAccept, onResults }) {
  const [projects, setProjects] = useState([])
  const [classes, setClasses] = useState([])
  const [projectId, setProjectId] = useState('PRJ-RIV')
  const [items, setItems] = useState(demoItems)
  const [submitted, setSubmitted] = useState({
    project_id: 'PRJ-RIV', items: demoItems.map(payloadItem),
  })
  const [results, setResults] = useState(null)
  const [resolvedKey, setResolvedKey] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const requestKey = JSON.stringify({ submitted, shifts })
  const pending = resolvedKey !== requestKey
  const currentResults = pending ? null : results
  const acceptedEntries = currentResults
    ? currentResults.items.map((_, index) => {
      const request = submitted.items[index]
      return request && acceptedProp.find((entry) => !entry.stale && entry.key === acceptKey(currentResults.project_id, request))
    })
    : []

  useEffect(() => {
    let cancelled = false
    Promise.all([getProjects(), getClasses()]).then(([loadedProjects, loadedClasses]) => {
      if (cancelled) return
      setProjects(loadedProjects)
      setClasses(loadedClasses)
    }).catch((err) => {
      if (!cancelled) setLoadError(err.message)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    recommend({ ...submitted, shifts }).then((data) => {
      if (cancelled) return
      setResults(data)
      setResolvedKey(requestKey)
      setError('')
      onResults?.(data)
      setBusy(false)
    }).catch((err) => {
      if (!cancelled) {
        setResults(null)
        setResolvedKey(requestKey)
        setError(err.message)
        setBusy(false)
      }
    })
    return () => { cancelled = true }
  }, [submitted, shifts, onResults, requestKey])

  function updateItem(id, field, value) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  function submit(event) {
    event.preventDefault()
    if (items.some((item) => !item.start || !item.finish || item.finish < item.start || Number(item.qty) < 1)) {
      setError('Check each date range and quantity before requesting a recommendation.')
      return
    }
    setBusy(true)
    setError('')
    setSubmitted({ project_id: projectId, items: items.map(payloadItem) })
  }

  function accept(index, item, option) {
    onAccept?.({ project_id: currentResults.project_id,
      project_name: projects.find((project) => project.id === currentResults.project_id)?.name ?? currentResults.project_id,
      item,
      request: submitted.items[index], option })
  }

  return <div className="request-layout">
    <section className="request-form-panel">
      <div className="section-kicker">New request</div>
      <h1>Find the best way to fill an equipment need.</h1>
      <p className="section-intro">Compare what the project pays with what actually leaves Northgate Group.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="project">Project</label>
        <select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={busy || pending || !projects.length}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <div className="item-list-heading"><span>Equipment</span><span>{items.length} item{items.length !== 1 ? 's' : ''}</span></div>
        {items.map((item, index) => <div className="request-item" key={item.id}>
          <div className="request-item-heading"><strong>Item {index + 1}</strong>
            {items.length > 1 && <button type="button" className="text-button" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>Remove</button>}
          </div>
          <div className="item-fields">
            <label>Type<select value={item.class} onChange={(event) => updateItem(item.id, 'class', event.target.value)} disabled={busy || pending || !classes.length}>
              {classes.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
            </select></label>
            <label>Qty<input type="number" min="1" step="1" value={item.qty} onChange={(event) => updateItem(item.id, 'qty', event.target.value)} /></label>
            <label>From<input type="date" value={item.start} onChange={(event) => updateItem(item.id, 'start', event.target.value)} /></label>
            <label>To<input type="date" value={item.finish} onChange={(event) => updateItem(item.id, 'finish', event.target.value)} /></label>
          </div>
        </div>)}
        <button type="button" className="add-button" onClick={() => setItems((current) => [
          ...current, { ...current[current.length - 1], id: Math.max(...current.map((row) => row.id)) + 1, qty: 1 },
        ])} disabled={busy || pending || !classes.length}>+ Add equipment</button>
        {(loadError || (error && !pending)) && <p className="request-error" role="alert">{loadError || error}</p>}
        <button className="submit-button" type="submit" disabled={busy || pending || !projects.length}>
          {busy || pending ? 'Calculating…' : 'Get recommendations'}
        </button>
      </form>
    </section>
    <section className="results-panel" aria-live="polite">
      <div className="results-heading"><div><div className="section-kicker">Group recommendation</div><h2>Ranked options</h2></div>
        {currentResults && <span className="result-count">{currentResults.items.length} equipment need{currentResults.items.length !== 1 ? 's' : ''}</span>}
      </div>
      {!currentResults && <p className="results-empty">{pending ? 'Updating recommendations…' : 'Submit a request to see the best choice for the whole group.'}</p>}
      {currentResults && <Summary items={currentResults.items} acceptedEntries={acceptedEntries.filter(Boolean)} />}
      {currentResults && <div className="legend">
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--opt-move)' }} />Move ours</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--opt-sister)' }} />Rent from sister</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--opt-outside)' }} />Rent outside</span>
        <span className="legend-item"><span className="legend-swatch" style={{ background: 'var(--opt-buy)' }} />Buy</span>
        <span className="legend-note">Bar length = group cost</span>
      </div>}
      {currentResults?.items.map((item, index) => {
        const maxCost = Math.max(0, ...item.options.filter((option) => option.available).map((option) => option.group_cost))
        const top = item.options.find((option) => option.available)
        return <div className="result-group" key={`${item.class}-${index}`}>
          <div className="result-group-heading"><span className="result-number">{String(index + 1).padStart(2, '0')}</span>
            <h3>{item.qty} × {classes.find((entry) => entry.code === item.class)?.label ?? item.class}</h3>
            {top && <div className="kept"><span>Kept in group</span><strong className="num">{money.format(top.kept_in_group)}</strong></div>}</div>
          <div className="option-list">{item.options.map((option, rank) => <Option key={option.option}
            option={option} item={item} best={rank === 0 && option.available} maxCost={maxCost} accepted={Boolean(acceptedEntries[index])}
            onAccept={() => accept(index, item, option)} />)}</div>
        </div>
      })}
    </section>
  </div>
}
