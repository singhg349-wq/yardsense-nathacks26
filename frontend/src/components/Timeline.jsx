import { useRef, useState } from 'react'
import './Timeline.css'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const OPTION_LABELS = {
  move_ours: 'move ours', rent_sister: 'sister rental',
  rent_outside: 'outside rental', buy: 'buy',
}

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
function allocationRows(project, allocations, changedIds) {
  return allocations
    .filter((a) => a.project_id === project.id)
    .map((a) => ({
      key: a.request_id,
      label: `${a.qty} x ${a.class} · ${OPTION_LABELS[a.option]}`,
      start: a.start,
      finish: a.finish,
      kind: 'allocated',
      changed: changedIds.has(a.request_id),
    }))
}

export default function Timeline({ projects, allocations = [], changedIds = new Set(),
  onShiftProject, today = '2026-11-16' }) {
  const drag = useRef(null)
  const [preview, setPreview] = useState(null)
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

  function startDrag(event, projectId) {
    if (!onShiftProject) return
    drag.current = { projectId, x: event.clientX, width: event.currentTarget.parentElement.clientWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event, projectId) {
    if (drag.current?.projectId === projectId) {
      setPreview({ projectId, pixels: event.clientX - drag.current.x })
    }
  }

  function finishDrag(event, projectId) {
    if (drag.current?.projectId !== projectId) return
    const days = Math.round((event.clientX - drag.current.x) / drag.current.width * span / DAY_MS)
    drag.current = null
    setPreview(null)
    if (days !== 0) onShiftProject(projectId, days)
  }

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
              <div className={`tl-bar ${onShiftProject ? 'tl-draggable' : ''}`}
                style={{ ...barStyle(project.start_date, project.completion_date),
                  transform: preview?.projectId === project.id ? `translateX(${preview.pixels}px)` : undefined }}
                onPointerDown={(event) => startDrag(event, project.id)}
                onPointerMove={(event) => moveDrag(event, project.id)}
                onPointerUp={(event) => finishDrag(event, project.id)}
                onPointerCancel={() => { drag.current = null; setPreview(null) }}
                onKeyDown={(event) => {
                  if (!onShiftProject) return
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault()
                    onShiftProject(project.id, event.key === 'ArrowRight' ? 7 : -7)
                  }
                }}
                role={onShiftProject ? 'button' : undefined}
                tabIndex={onShiftProject ? 0 : undefined}
                aria-label={onShiftProject ? `Move ${project.name} by dragging or arrow keys` : undefined}>
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

          {[...needRows(project), ...allocationRows(project, allocations, changedIds)].map((row) => (
            <div className={`tl-row tl-equip ${row.changed ? 'tl-changed' : ''}`} key={row.key}>
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
