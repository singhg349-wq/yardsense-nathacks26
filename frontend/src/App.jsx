import { useCallback, useEffect, useState } from 'react'
import { API_URL, getHealth } from './api'
import './App.css'

function App() {
  const [health, setHealth] = useState({ state: 'loading' })

  const check = useCallback(async () => {
    setHealth({ state: 'loading' })
    try {
      const data = await getHealth()
      setHealth({ state: 'ok', data })
    } catch (err) {
      setHealth({ state: 'error', message: err.message })
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return (
    <main className="app">
      <h1>YardSense</h1>
      <p className="subtitle">Move ours · Rent from sister · Rent outside · Buy</p>

      <section className="health">
        <strong>Backend: </strong>
        {health.state === 'loading' && <span>checking…</span>}
        {health.state === 'ok' && <span className="ok">{health.data.status}</span>}
        {health.state === 'error' && (
          <span className="error">unreachable ({health.message})</span>
        )}
        <div>
          <code>GET {API_URL}/health</code>
        </div>
        <button onClick={check}>Check again</button>
      </section>
    </main>
  )
}

export default App
