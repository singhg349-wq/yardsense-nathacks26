import { useCallback, useMemo, useState } from 'react'
import PlannerView from './components/PlannerView'
import RequestScreen from './components/RequestScreen'
import Dashboard from './components/Dashboard'
import FleetAdvisor from './components/FleetAdvisor'
import MapView from './components/MapView'
import DataUpload from './components/DataUpload'
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
    setAccepted([])
  }, [])
  const acceptRecommendation = useCallback((entry) => {
    const { project_id, request } = entry
    const key = [project_id, request.class, request.qty, request.start, request.finish].join(':')
    setAccepted((current) => [...current.filter((item) => item.key !== key), { ...entry, key }])
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
        <button type="button" className={view === 'request' ? 'active' : ''} onClick={() => setView('request')}>Requests</button>
        <button type="button" className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Timeline</button>
        <button type="button" className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button>
        <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
        <button type="button" className={view === 'fleet' ? 'active' : ''} onClick={() => setView('fleet')}>Fleet advisor</button>
        <button type="button" className={view === 'data' ? 'active' : ''} onClick={() => setView('data')}>Data upload</button>
      </nav>
    </header>
    <main>
      <div style={{ display: view === 'request' ? undefined : 'none' }}>
        <RequestScreen key={dataVersion} shifts={shifts} onAccept={acceptRecommendation} />
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
