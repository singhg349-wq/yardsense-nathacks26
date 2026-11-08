import { useCallback, useMemo, useState } from 'react'
import PlannerView from './components/PlannerView'
import RequestScreen from './components/RequestScreen'
import Dashboard from './components/Dashboard'
import FleetAdvisor from './components/FleetAdvisor'
import MapView from './components/MapView'
import DataUpload from './components/DataUpload'
import { acceptKey } from './acceptKey'
import './App.css'

function App() {
  const [view, setView] = useState('request')
  const [shiftMap, setShiftMap] = useState({})
  const [accepted, setAccepted] = useState([])
  const [dataVersion, setDataVersion] = useState(0)
  const shifts = useMemo(() => Object.entries(shiftMap).filter(([, days]) => days !== 0)
    .map(([project_id, days]) => ({ project_id, days })), [shiftMap])
  const setShift = useCallback((projectId, days) => {
    setShiftMap((current) => ({ ...current, [projectId]: days }))
  }, [])
  const acceptRecommendation = useCallback((entry) => {
    const { project_id, request } = entry
    const key = acceptKey(project_id, request)
    setAccepted((current) => [...current.filter((item) => item.key !== key), { ...entry, key, stale: false }])
  }, [])
  // After a what-if, flag accepted items whose recommended option is no longer the top one.
  const reconcileAccepted = useCallback((data) => {
    setAccepted((current) => {
      let changed = false
      const next = current.map((entry) => {
        if (entry.project_id !== data.project_id) return entry
        const item = data.items.find((row) => row.class === entry.request.class && row.qty === entry.request.qty)
        const top = item?.options.find((option) => option.available)
        if (!top) return entry
        const stale = top.option !== entry.option.option
        if (stale === Boolean(entry.stale)) return entry
        changed = true
        return { ...entry, stale }
      })
      return changed ? next : current
    })
  }, [])
  const dataUploaded = useCallback(() => {
    setDataVersion((version) => version + 1)
    setShiftMap({})
    setAccepted([])
  }, [])

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-mark">Y</div>
      <div className="brand-copy"><strong>YardSense</strong><span>Northgate Group / Equipment desk · synthetic demo</span></div>
      <nav className="app-nav" aria-label="Main navigation">
        <button type="button" className={view === 'request' ? 'active' : ''} aria-current={view === 'request' ? 'page' : undefined} onClick={() => setView('request')}>Requests</button>
        <button type="button" className={view === 'timeline' ? 'active' : ''} aria-current={view === 'timeline' ? 'page' : undefined} onClick={() => setView('timeline')}>Timeline</button>
        <button type="button" className={view === 'map' ? 'active' : ''} aria-current={view === 'map' ? 'page' : undefined} onClick={() => setView('map')}>Map</button>
        <button type="button" className={view === 'dashboard' ? 'active' : ''} aria-current={view === 'dashboard' ? 'page' : undefined} onClick={() => setView('dashboard')}>Dashboard</button>
        <button type="button" className={view === 'fleet' ? 'active' : ''} aria-current={view === 'fleet' ? 'page' : undefined} onClick={() => setView('fleet')}>Fleet advisor</button>
        <button type="button" className={view === 'data' ? 'active' : ''} aria-current={view === 'data' ? 'page' : undefined} onClick={() => setView('data')}>Data upload</button>
      </nav>
    </header>
    <main>
      <div style={{ display: view === 'request' ? undefined : 'none' }}>
        <RequestScreen key={dataVersion} shifts={shifts} accepted={accepted}
          onAccept={acceptRecommendation} onResults={reconcileAccepted} />
      </div>
      <div style={{ display: view === 'timeline' ? undefined : 'none' }}>
        <PlannerView key={dataVersion} shifts={shifts} onSetShift={setShift} />
      </div>
      <div style={{ display: view === 'map' ? undefined : 'none' }}>
        <MapView key={dataVersion} shifts={shifts} active={view === 'map'} />
      </div>
      <div style={{ display: view === 'dashboard' ? undefined : 'none' }}>
        <Dashboard key={dataVersion} shifts={shifts} accepted={accepted} />
      </div>
      <div style={{ display: view === 'fleet' ? undefined : 'none' }}>
        <FleetAdvisor key={dataVersion} />
      </div>
      <div style={{ display: view === 'data' ? undefined : 'none' }}>
        <DataUpload onUploaded={dataUploaded} onViewRequests={() => setView('request')} />
      </div>
    </main>
  </div>
}

export default App
