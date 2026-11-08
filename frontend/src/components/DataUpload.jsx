import { useState } from 'react'
import { API_URL, uploadCsv } from '../api'
import './DataUpload.css'

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

  return <article className="upload-card">
    <h2>{source.name}</h2>
    <p>Expected columns: {source.columns}.</p>
    <p className="upload-sample">Try the synthetic sample: <a href={`${API_URL}/samples/${source.sample}`} download>{source.id === 'sap' ? 'sap_assets.csv' : 'procore_schedule.csv'}</a></p>
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

export default function DataUpload({ onUploaded, onViewRequests }) {
  return <section className="upload-view">
    <div className="section-kicker">Connected data</div>
    <h1>Upload equipment and schedule exports.</h1>
    <p>CSV imports update the local planning database. An upload can update known assets or projects and add new ones using existing company, site and equipment class codes.</p>
    <div className="upload-grid">{sources.map((source) => <UploadCard key={source.id} source={source}
      onUploaded={onUploaded} onViewRequests={onViewRequests} />)}</div>
  </section>
}
