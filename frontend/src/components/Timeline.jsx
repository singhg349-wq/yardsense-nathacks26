import { useRef, useState } from 'react'
import { className } from './classNames'
import { optionParts } from './optionParts'
import './Timeline.css'

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const OPTION_LABELS = {
  move_ours: 'move ours', rent_sister: 'sister rental',
  rent_outside: 'outside rental', buy: 'buy',
}

const CURRENCY = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
const OPTION_KEYS = [
  ['move_ours', 'Move ours', 'move'], ['rent_sister', 'Sister rental', 'sister'],
  ['rent_outside', 'Outside rental', 'outside'], ['buy', 'Buy', 'buy'],
]
const OPTION_CLASS = { move_ours: 'move', rent_sister: 'sister', rent_outside: 'outside', buy: 'buy', split: 'split' }

// Drags move in whole weeks.
function snapWeeks(days) {
  return Math.round(days / 7) * 7
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
    label: `${n.qty} × ${className(n.class)}`,
    tag: 'planned',
    start: n.start,
    finish: n.finish,
    kind: 'planned',
    tip: `Planned: ${n.qty} × ${className(n.class)} · ${n.start} to ${n.finish} (before allocation)`,
  }))
}

// Allocator output (placeholder): [{project_id, label, start, finish}]
// "1 move ours + 1 buy" for a split need, otherwise the option's own label.
function choiceLabel(a) {
  if (a.option !== 'split') return OPTION_LABELS[a.option]
  return optionParts(a).map((part) => `${part.qty} ${OPTION_LABELS[part.option]}`).join(' + ')
}

// A split bar shows each source's colour in proportion to its units.
function splitStyle(a) {
  if (a.option !== 'split') return undefined
  const parts = optionParts(a)
  const total = parts.reduce((sum, part) => sum + part.qty, 0)
  let at = 0
  const stops = parts.map((part) => {
    const from = at
    at += (part.qty / total) * 100
    return `var(--opt-${OPTION_CLASS[part.option]}) ${from}% ${at}%`
  })
  return { background: `linear-gradient(90deg, ${stops.join(', ')})` }
}

function allocationRows(project, allocations, changedIds) {
  return allocations
    .filter((a) => a.project_id === project.id)
    .map((a) => ({
      key: a.request_id,
      label: `${a.qty} × ${className(a.class)}`,
      tag: choiceLabel(a),
      start: a.start,
      finish: a.finish,
      kind: 'allocated',
      option: a.option,
      style: splitStyle(a),
      tip: `${a.qty} × ${className(a.class)} · ${choiceLabel(a)} · group cost ${
        a.group_cost == null ? 'n/a' : CURRENCY.format(a.group_cost)} · ${a.start} to ${a.finish}`,
      changed: changedIds.has(a.request_id),
    }))
}

export default function Timeline({ projects, allocations = [], changedIds = new Set(),
  onShiftProject, shifts = [], today = '2026-11-16' }) {
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
      const raw = event.clientX - drag.current.x
      const snapped = snapWeeks(raw / drag.current.width * span / DAY_MS) * DAY_MS / span * drag.current.width
      setPreview({ projectId, pixels: snapped, width: drag.current.width })
    }
  }

  function finishDrag(event, projectId) {
    if (drag.current?.projectId !== projectId) return
    const days = snapWeeks((event.clientX - drag.current.x) / drag.current.width * span / DAY_MS)
    drag.current = null
    setPreview(null)
    if (days !== 0) onShiftProject(projectId, days)
  }

  // One tick per month; the year sits on a second line for January and the first tick.
  // Labels closer than MIN_GAP (% of the axis) are dropped so they never overlap.
  const MIN_GAP = 4.2
  const months = []
  let lastShown = -Infinity
  for (let d = new Date(rangeStart); d.getTime() < rangeEnd; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const ms = d.getTime()
    const month = d.getUTCMonth()
    const left = ((ms - rangeStart) / span) * 100
    const show = left - lastShown >= MIN_GAP
    if (show) lastShown = left
    months.push({
      key: ms, left, text: show ? MONTHS[month] : null,
      year: show && (month === 0 || !months.some((m) => m.text)) ? d.getUTCFullYear() : null,
    })
  }

  const todayLine = <div className="tl-today" style={{ left: `${pct(today)}%` }} title={`Today: ${today}`} />
  const grid = months.map((m) => <i key={m.key} className="tl-grid" style={{ left: `${m.left}%` }} />)
  const shiftDays = (id) => shifts.find((shift) => shift.project_id === id)?.days ?? 0
  const weeks = (days) => `${days > 0 ? '+' : '-'}${Math.round(Math.abs(days) / 7)} wk`
  const live = (days) => (Math.abs(days) < 7 ? `${days > 0 ? '+' : '-'}${Math.abs(days)} d` : weeks(days))
  const previewDays = (id) => {
    if (preview?.projectId !== id) return 0
    return Math.round(preview.pixels / preview.width * span / DAY_MS)
  }

  return (
    <div className="tl">
      <div className="tl-intro">
        <p><strong>Grey bars are project phases; coloured bars are the group plan's equipment.</strong>
          {onShiftProject && ' Drag a project to test a slip; this does not edit the Procore schedule.'}</p>
        <div className="legend tl-legend" aria-label="Timeline legend">
          <span className="legend-item"><i className="tl-key tl-key-phase" />Project phases (bar = project span)</span>
          <span className="legend-item"><i className="tl-key tl-planned" />Planned need</span>
          <span className="legend-item"><i className="tl-key tl-key-alloc" />Allocated by the group plan:</span>
          {OPTION_KEYS.map(([key, name, cls]) => <span className="legend-item" key={key}>
            <i className={`tl-key tl-opt-${cls}`} />{name}</span>)}
          <span className="legend-item"><i className="tl-key tl-key-today" />Today</span>
          {onShiftProject && <span className="legend-item"><i className="tl-key tl-key-shift" />What-if shifted <b className="tl-badge tl-badge-inline">+6 wk</b></span>}
          <span className="legend-item"><i className="tl-key tl-key-changed" />Recommendation changed</span>
        </div>
      </div>
      <div className="tl-row tl-header">
        <div className="tl-label" />
        <div className="tl-track">
          {months.map((m) => (
            m.text && <span key={m.key} className="tl-month" style={{ left: `${m.left}%` }}>
              {m.text}{m.year && <small>{m.year}</small>}
            </span>
          ))}
          {todayLine}
          <span className="tl-today-tag" style={{ left: `${pct(today)}%` }}>Today</span>
        </div>
      </div>

      {projects.map((project) => (
        <div className="tl-project" key={project.id}>
          <div className="tl-row">
            <div className="tl-label tl-project-name" title={project.name}>
              <span>{project.name}</span>
              <small>{project.site_name ?? project.site_id}</small>
            </div>
            <div className="tl-track">
              {grid}
              <div className={`tl-bar ${onShiftProject ? 'tl-draggable' : ''} ${shiftDays(project.id) ? 'tl-shifted' : ''}`}
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
                {preview?.projectId !== project.id && shiftDays(project.id) !== 0
                  && <span className="tl-badge">{weeks(shiftDays(project.id))}</span>}
              </div>
              {preview?.projectId === project.id && previewDays(project.id) !== 0 && (
                <span className="tl-badge tl-badge-live" style={{
                  left: `calc(${pct(project.start_date) + widthPct(project.start_date, project.completion_date) / 2}% + ${preview.pixels}px)` }}>
                  {live(previewDays(project.id))}</span>
              )}
              {todayLine}
            </div>
          </div>

          {[...needRows(project), ...allocationRows(project, allocations, changedIds)].map((row) => (
            <div className={`tl-row tl-equip ${row.changed ? 'tl-changed' : ''}`} key={row.key}>
              <div className="tl-label tl-equip-name">
                <span className="tl-equip-text">{row.label}</span>
                <em className={`tl-tag ${row.option ? `tl-tag-${OPTION_CLASS[row.option]}` : ''}`}>{row.tag}</em>
              </div>
              <div className="tl-track">
                {grid}
                <div className={`tl-equip-bar tl-${row.kind} ${row.option ? `tl-opt-${OPTION_CLASS[row.option]}` : ''}`}
                  style={{ ...barStyle(row.start, row.finish), ...row.style }} title={row.tip} />
                {todayLine}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
