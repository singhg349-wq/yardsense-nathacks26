import './Timeline.css'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2026-11-16" -> milliseconds (UTC, so time zones never shift the day)
function toMs(iso) {
  return Date.parse(iso + 'T00:00:00Z')
}

// Group the planned needs of a project into one row per equipment class.
function needRows(project) {
  const needs = project.needs ?? project.planned_equipment ?? []
  return needs.map((n) => ({
    key: `${n.class}-${n.start}`,
    label: `${n.qty} x ${n.class}`,
    start: n.start,
    finish: n.finish,
    kind: 'planned',
  }))
}

// Allocator output (placeholder): [{project_id, label, start, finish}]
function allocationRows(project, allocations) {
  return allocations
    .filter((a) => a.project_id === project.id)
    .map((a, i) => ({
      key: `alloc-${i}`,
      label: a.label,
      start: a.start,
      finish: a.finish,
      kind: 'allocated',
    }))
}

export default function Timeline({ projects, allocations = [], today = '2026-11-16' }) {
  if (!projects || projects.length === 0) {
    return <p className="tl-empty">No projects to show.</p>
  }

  // The chart spans the earliest start to the latest finish, padded to whole months.
  const allDates = projects.flatMap((p) => [p.start_date, p.completion_date])
  const first = new Date(Math.min(...allDates.map(toMs), toMs(today)))
  const last = new Date(Math.max(...allDates.map(toMs), toMs(today)))
  const rangeStart = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)
  const rangeEnd = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1)
  const span = rangeEnd - rangeStart

  const pct = (iso) => ((toMs(iso) - rangeStart) / span) * 100
  const widthPct = (start, finish) => ((toMs(finish) - toMs(start) + DAY_MS) / span) * 100
  const barStyle = (start, finish) => ({ left: `${pct(start)}%`, width: `${widthPct(start, finish)}%` })

  // One label per month across the top.
  const months = []
  for (let d = new Date(rangeStart); d.getTime() < rangeEnd; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const ms = d.getTime()
    const month = d.getUTCMonth()
    months.push({
      key: ms,
      left: ((ms - rangeStart) / span) * 100,
      text: month === 0 || months.length === 0 ? `${MONTHS[month]} ${d.getUTCFullYear()}` : MONTHS[month],
    })
  }

  const todayLine = <div className="tl-today" style={{ left: `${pct(today)}%` }} title={`Today: ${today}`} />

  return (
    <div className="tl">
      <div className="tl-row tl-header">
        <div className="tl-label" />
        <div className="tl-track">
          {months.map((m) => (
            <span key={m.key} className="tl-month" style={{ left: `${m.left}%` }}>
              {m.text}
            </span>
          ))}
          {todayLine}
        </div>
      </div>

      {projects.map((project) => (
        <div className="tl-project" key={project.id}>
          <div className="tl-row">
            <div className="tl-label tl-project-name" title={project.name}>
              {project.name}
            </div>
            <div className="tl-track">
              <div className="tl-bar" style={barStyle(project.start_date, project.completion_date)}>
                {(project.phases ?? []).map((phase, i) => (
                  <div
                    key={phase.task_name}
                    className={`tl-phase tl-phase-${i % 6}`}
                    style={{
                      left: `${(pct(phase.start) - pct(project.start_date)) / widthPct(project.start_date, project.completion_date) * 100}%`,
                      width: `${widthPct(phase.start, phase.finish) / widthPct(project.start_date, project.completion_date) * 100}%`,
                    }}
                    title={`${phase.task_name}: ${phase.start} to ${phase.finish}`}
                  />
                ))}
              </div>
              {todayLine}
            </div>
          </div>

          {[...needRows(project), ...allocationRows(project, allocations)].map((row) => (
            <div className="tl-row tl-equip" key={row.key}>
              <div className="tl-label tl-equip-name">
                {row.label} <em>{row.kind}</em>
              </div>
              <div className="tl-track">
                <div className={`tl-equip-bar tl-${row.kind}`} style={barStyle(row.start, row.finish)} />
                {todayLine}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
