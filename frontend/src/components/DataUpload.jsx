import { useEffect, useState } from 'react'
import { API_URL, getSources, uploadCsv } from '../api'
import './DataUpload.css'

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const valueLabel = (value) => (typeof value === 'number' ? money.format(value) : value)

const sources = [
  { id: 'sap', name: 'SAP asset register', columns: 'ANLN1, TXT50, ANLKL, BUKRS, AKTIV, ANSWL',
    sample: 'sap', count: 'assets' },
  { id: 'procore', name: 'Procore schedule',
    columns: 'Project, site, task dates and equipment needs',
    sample: 'procore', count: 'projects' },
]

function UploadCard({ source, onUploaded, onViewRequests }) {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await uploadCsv(source.id, file)
      setResult(response)
      onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function loadSample() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`${API_URL}/samples/${source.sample}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const sampleFile = new File([blob], `${source.sample}_sample.csv`, { type: 'text/csv' })
      const result = await uploadCsv(source.id, sampleFile)
      setResult(result)
      onUploaded()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <article className="upload-card">
    <h2>{source.name}</h2>
    <p>Expected columns: {source.columns}.</p>
    <p className="upload-sample">Try the synthetic sample: <a href={`${API_URL}/samples/${source.sample}`} download>{source.id === 'sap' ? 'sap_assets.csv' : 'procore_schedule.csv'}</a></p>
    <button className="upload-demo-button" type="button" onClick={loadSample} disabled={busy}>
      {source.id === 'procore' ? 'Load slipped schedule demo' : 'Load sample asset register'}
    </button>
    <form onSubmit={submit}>
      <label htmlFor={`upload-${source.id}`}>Choose a CSV file</label>
      <input id={`upload-${source.id}`} type="file" accept=".csv,text/csv"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); setResult(null) }} />
      <button type="submit" disabled={!file || busy}>{busy ? 'Importing…' : `Import ${source.name}`}</button>
    </form>
    {error && <p className="upload-error" role="alert">{error}</p>}
    {result && <div className="upload-success" role="status">
      Imported {result.imported} {source.count}. Recommendations now use the updated data.
      <button type="button" onClick={onViewRequests}>View requests</button>
    </div>}
  </article>
}

function Provenance({ data }) {
  return <section className="provenance" aria-labelledby="provenance-title">
    <div className="provenance-head">
      <div>
        <div className="section-kicker">Data & assumptions</div>
        <h2 id="provenance-title">Where these numbers come from</h2>
        <p>The demo is synthetic. Rates marked sourced come from public market listings; everything else is a labelled placeholder or a stated assumption.</p>
      </div>
      <span className="provenance-badge">Synthetic demo data</span>
    </div>
    <div className="provenance-sources">
      {data.sources.map((source) => <article className="provenance-card" key={source.id}>
        <div className="provenance-card-head"><h3>{source.name}</h3>
          <span className={`provenance-mode provenance-mode-${source.mode}`}>{source.mode}</span></div>
        <p>{source.shape}</p>
        <small>{source.notes}</small>
      </article>)}
    </div>
    <div className="provenance-rates">
      <h3>Rates and confidence</h3>
      <div className="provenance-table">
        <div className="provenance-row provenance-row-head">
          <span>Class</span><span>Field</span><span>Value</span><span>Basis</span><span>Confidence</span><span>Source</span>
        </div>
        {data.rates.map((row, index) => <div className="provenance-row" key={`${row.class}-${row.field}-${index}`}>
          <span>{row.label ?? row.class}</span>
          <span>{row.field}</span>
          <span>{valueLabel(row.value)}</span>
          <span>{row.basis}</span>
          <span><span className={`provenance-confidence provenance-confidence-${row.confidence}`}>{row.confidence}</span></span>
          <span>{row.citation ? (row.source_url
            ? <a href={row.source_url} target="_blank" rel="noreferrer">{row.citation}</a>
            : row.citation) : '—'}</span>
        </div>)}
      </div>
    </div>
    <div className="provenance-assumptions">
      <h3>Assumptions</h3>
      <ul>{data.assumptions.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  </section>
}

export default function DataUpload({ onUploaded, onViewRequests }) {
  const [provenance, setProvenance] = useState(null)
  const [provenanceError, setProvenanceError] = useState('')

  useEffect(() => {
    let cancelled = false
    getSources().then((data) => {
      if (!cancelled) { setProvenance(data); setProvenanceError('') }
    }).catch((err) => {
      if (!cancelled) setProvenanceError(err.message)
    })
    return () => { cancelled = true }
  }, [])

  return <section className="upload-view">
    <div className="section-kicker">Connected data</div>
    <h1>Upload equipment and schedule exports.</h1>
    <p>CSV imports update the local planning database. An upload can update known assets or projects and add new ones using existing company, site and equipment class codes.</p>
    <div className="upload-grid">{sources.map((source) => <UploadCard key={source.id} source={source}
      onUploaded={onUploaded} onViewRequests={onViewRequests} />)}</div>
    {provenanceError && <p className="upload-error" role="alert">Couldn't load the data provenance ({provenanceError}).</p>}
    {provenance && <Provenance data={provenance} />}
  </section>
}
