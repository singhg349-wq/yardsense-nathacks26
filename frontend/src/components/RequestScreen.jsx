import { useEffect, useState } from 'react'
import { getClasses, getProjects, recommend } from '../api'
import './RequestScreen.css'

const demoItems = [
  { id: 1, class: 'SCISSOR_19', qty: 2, start: '2026-11-23', finish: '2027-01-31' },
  { id: 2, class: 'TELEHANDLER', qty: 1, start: '2026-11-23', finish: '2027-01-31' },
  { id: 3, class: 'GEN_45KW', qty: 1, start: '2026-11-23', finish: '2027-01-31' },
]
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
const names = {
  move_ours: 'Move ours', rent_sister: 'Rent from Northgate Rentals',
  rent_outside: 'Rent outside', buy: 'Buy through Northgate Rentals',
}
const payloadItem = (item) => ({ class: item.class, qty: Number(item.qty),
  start: item.start, finish: item.finish })

function Option({ option, first, accepted, onAccept }) {
  return <article className={`option ${first ? 'option-first' : ''} ${!option.available ? 'option-unavailable' : ''}`}>
    <div className="option-main">
      <div>
        <div className="option-title">
          <strong>{names[option.option] ?? option.option}</strong>
          {first && <span className="recommendation-tag">Recommended</span>}
          {!option.available && <span className="unavailable-tag">Unavailable</span>}
        </div>
        <p>{option.reason}</p>
      </div>
      {option.available && <div className="option-costs">
        <div><span>Group cost</span><strong>{money.format(option.group_cost)}</strong></div>
        <div><span>Project cost</span><strong>{money.format(option.project_cost)}</strong></div>
      </div>}
    </div>
    {first && option.available && <div className="option-action">
      <span>{money.format(option.kept_in_group)} kept in the group versus outside rental</span>
      <button type="button" onClick={onAccept} disabled={accepted}>
        {accepted ? 'Accepted' : 'Accept recommendation'}
      </button>
    </div>}
  </article>
}

export default function RequestScreen({ onAccept, onResults }) {
  const [projects, setProjects] = useState([])
  const [classes, setClasses] = useState([])
  const [projectId, setProjectId] = useState('PRJ-RIV')
  const [items, setItems] = useState(demoItems)
  const [results, setResults] = useState(null)
  const [accepted, setAccepted] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getProjects(), getClasses(), recommend({
      project_id: 'PRJ-RIV', items: demoItems.map(payloadItem),
    })]).then(([loadedProjects, loadedClasses, initialResults]) => {
      if (cancelled) return
      setProjects(loadedProjects)
      setClasses(loadedClasses)
      setResults(initialResults)
      onResults?.(initialResults)
      setBusy(false)
    }).catch((err) => {
      if (!cancelled) { setError(err.message); setBusy(false) }
    })
    return () => { cancelled = true }
  }, [onResults])

  function updateItem(id, field, value) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  async function submit(event) {
    event.preventDefault()
    if (items.some((item) => !item.start || !item.finish || item.finish < item.start || Number(item.qty) < 1)) {
      setError('Check each date range and quantity before requesting a recommendation.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await recommend({ project_id: projectId, items: items.map(payloadItem) })
      setResults(data)
      setAccepted([])
      onResults?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function accept(index, item, option) {
    setAccepted((current) => [...current, index])
    onAccept?.({ project_id: results.project_id, item, option })
  }

  return <div className="request-layout">
    <section className="request-form-panel">
      <div className="section-kicker">New request</div>
      <h1>Find the best way to fill an equipment need.</h1>
      <p className="section-intro">Compare what the project pays with what actually leaves Northgate Group.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="project">Project</label>
        <select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={busy || !projects.length}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <div className="item-list-heading"><span>Equipment</span><span>{items.length} item{items.length !== 1 ? 's' : ''}</span></div>
        {items.map((item, index) => <div className="request-item" key={item.id}>
          <div className="request-item-heading"><strong>Item {index + 1}</strong>
            {items.length > 1 && <button type="button" className="text-button" onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))}>Remove</button>}
          </div>
          <div className="item-fields">
            <label>Type<select value={item.class} onChange={(event) => updateItem(item.id, 'class', event.target.value)} disabled={busy || !classes.length}>
              {classes.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
            </select></label>
            <label>Qty<input type="number" min="1" step="1" value={item.qty} onChange={(event) => updateItem(item.id, 'qty', event.target.value)} /></label>
            <label>From<input type="date" value={item.start} onChange={(event) => updateItem(item.id, 'start', event.target.value)} /></label>
            <label>To<input type="date" value={item.finish} onChange={(event) => updateItem(item.id, 'finish', event.target.value)} /></label>
          </div>
        </div>)}
        <button type="button" className="add-button" onClick={() => setItems((current) => [
          ...current, { ...current[current.length - 1], id: Math.max(...current.map((row) => row.id)) + 1, qty: 1 },
        ])} disabled={busy || !classes.length}>+ Add equipment</button>
        {error && <p className="request-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={busy || !projects.length}>
          {busy ? 'Calculating…' : 'Get recommendations'}
        </button>
      </form>
    </section>
    <section className="results-panel" aria-live="polite">
      <div className="results-heading"><div><div className="section-kicker">Group recommendation</div><h2>Ranked options</h2></div>
        {results && <span className="result-count">{results.items.length} equipment need{results.items.length !== 1 ? 's' : ''}</span>}
      </div>
      {!results && <p className="results-empty">Submit a request to see the best choice for the whole group.</p>}
      {results?.items.map((item, index) => <div className="result-group" key={`${item.class}-${index}`}>
        <div className="result-group-heading"><span className="result-number">{String(index + 1).padStart(2, '0')}</span>
          <h3>{item.qty} × {classes.find((entry) => entry.code === item.class)?.label ?? item.class}</h3></div>
        <div className="option-list">{item.options.map((option, rank) => <Option key={option.option}
          option={option} first={rank === 0 && option.available} accepted={accepted.includes(index)}
          onAccept={() => accept(index, item, option)} />)}</div>
      </div>)}
    </section>
  </div>
}
