import { useCallback, useMemo, useState } from 'react'
import PlannerView from './components/PlannerView'
import RequestScreen from './components/RequestScreen'
import './App.css'

function App() {
  const [view, setView] = useState('request')
  const [shiftMap, setShiftMap] = useState({})
  const shifts = useMemo(() => Object.entries(shiftMap).filter(([, days]) => days !== 0)
    .map(([project_id, days]) => ({ project_id, days })), [shiftMap])
  const setShift = useCallback((projectId, days) => {
    setShiftMap((current) => ({ ...current, [projectId]: days }))
  }, [])

  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-mark">Y</div>
      <div className="brand-copy"><strong>YardSense</strong><span>Northgate Group / Equipment desk</span></div>
      <nav className="app-nav" aria-label="Main navigation">
        <button type="button" className={view === 'request' ? 'active' : ''} onClick={() => setView('request')}>Requests</button>
        <button type="button" className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>Timeline</button>
      </nav>
    </header>
    <main>
      <div style={{ display: view === 'request' ? undefined : 'none' }}>
        <RequestScreen shifts={shifts} />
      </div>
      <div style={{ display: view === 'timeline' ? undefined : 'none' }}>
        <PlannerView shifts={shifts} onSetShift={setShift} />
      </div>
    </main>
  </div>
}

export default App
