import { useEffect, useState } from 'react'
import Timeline from './Timeline'
import { sampleProjects, sampleToday } from './sampleProjects'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

// Loads projects from GET /projects and draws the timeline.
// If the API is not reachable, it shows the sample data instead.
export default function TimelineView() {
  const [projects, setProjects] = useState(null)
  const [usingSample, setUsingSample] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/projects`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setProjects(data)
      })
      .catch(() => {
        if (!cancelled) {
          setProjects(sampleProjects)
          setUsingSample(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (projects === null) return <p>Loading timeline...</p>

  return (
    <section>
      <h2>Group timeline</h2>
      {usingSample && <p>API not reachable: showing sample data.</p>}
      <Timeline projects={projects} today={sampleToday} />
    </section>
  )
}
