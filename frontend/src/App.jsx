import RequestScreen from './components/RequestScreen'
import './App.css'

function App() {
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-mark">Y</div>
      <div className="brand-copy"><strong>YardSense</strong><span>Northgate Group / Equipment desk</span></div>
      <div className="header-note">Move smarter. Keep more in the group.</div>
    </header>
    <main><RequestScreen /></main>
  </div>
}

export default App
