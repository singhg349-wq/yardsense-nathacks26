import { useEffect, useMemo, useState } from 'react'
import { getAssignments, getAvailableAssets, getClasses, getSites, postPlan } from '../api'
import MapCanvas from './MapCanvas'
import {
  addDays, buildMoves, COMPANIES, DEMO_TODAY, defaultMove, fleetStatus, formatDate, formatLongDate,
  formatMoney, idleSince, moveKpis, siteLabel, siteNote, TYPE_LABELS,
} from './mapData'
import './MapView.css'

const FILTERS = [['all', 'All'], ['move_ours', TYPE_LABELS.move_ours], ['rent_sister', TYPE_LABELS.rent_sister]]
const IDLE_WINDOW_DAYS = 7

function loadWorld() {
  return Promise.all([
    getSites(), getAssignments(), getClasses(),
    getAvailableAssets(DEMO_TODAY, addDays(DEMO_TODAY, IDLE_WINDOW_DAYS)),
  ]).then(([sites, assignments, classes, idle]) => ({ sites, assignments, classes, idle }))
}

function Kpi({ label, value, sub, primary }) {
  return <article className={`map-kpi${primary ? ' map-kpi-primary' : ''}`}>
    <span>{label}</span><strong>{value}</strong><small>{sub}</small>
  </article>
}

function FleetCard({ fleet }) {
  const segments = [
    ['Working on group projects', fleet.working, 'map-fleet-working'],
    ['Rented to outside customers', fleet.rented, 'map-fleet-rented'],
    ['Idle', fleet.idle, 'map-fleet-idle'],
  ]
  return <section className="map-card map-fleet" aria-labelledby="map-fleet-title">
    <div className="map-card-heading"><h2 id="map-fleet-title">Fleet status</h2><span>{fleet.total} units</span></div>
    <div className="map-fleet-bar" aria-hidden="true">
      {segments.map(([label, count, className]) => <div key={label} className={className} style={{ flexGrow: count }} />)}
    </div>
    <div className="map-fleet-legend">
      {segments.map(([label, count, className]) => <div key={label}>
        <span className={`map-fleet-dot ${className}`} /><span>{label}</span><strong>{count}</strong>
      </div>)}
    </div>
  </section>
}

function SitePanel({ site, fleet, idleUnits, moves, selectedMoveId }) {
  if (!site) return null
  const rented = fleet.rentedBySite[site.id] ?? 0
  return <section className="map-card map-site-panel" aria-labelledby="map-site-title" aria-live="polite">
    <div>
      <span className="map-site-kicker">Selected {site.kind}</span>
      <h2 id="map-site-title">{siteLabel(site)}</h2>
      <p>{COMPANIES[site.company]?.name ?? site.company} · {site.address}</p>
    </div>
    <div className="map-site-chips">
      <span className="map-chip-idle">{idleUnits.length} idle</span>
      <span className="map-chip-working">{fleet.workingBySite[site.id] ?? 0} working</span>
      {rented > 0 && <span className="map-chip-rented">{rented} rented out</span>}
    </div>
    {idleUnits.length > 0 && <ul className="map-idle-list">
      {idleUnits.map((unit) => <li key={unit.asset_id}>
        <span className="map-fleet-dot map-fleet-idle" />
        <div><strong>{unit.description}</strong><span>#{unit.asset_id} · {idleSince(unit)}</span></div>
      </li>)}
    </ul>}
    <p className="map-site-note">{siteNote(site.id, moves, selectedMoveId)}</p>
  </section>
}

function MovesTable({ moves, selectedMoveId, onSelect }) {
  const [filter, setFilter] = useState('all')
  const counts = (type) => (type === 'all' ? moves.length : moves.filter((move) => move.type === type).length)
  const rows = moves.filter((move) => filter === 'all' || move.type === filter)
  return <section className="map-card map-moves" aria-labelledby="map-moves-title">
    <div className="map-moves-heading">
      <h2 id="map-moves-title">Recommended moves</h2>
      <div className="map-filters" role="group" aria-label="Filter moves">
        {FILTERS.map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id}
          onClick={() => setFilter(id)}>{label} · {counts(id)}</button>)}
      </div>
    </div>
    <div className="map-moves-scroll">
      <div className="map-moves-grid">
        <div className="map-moves-row map-moves-head">
          <span>Unit</span><span>From → To</span><span>Dates</span><span>Distance</span><span>Truck</span><span>Kept in group</span><span>Type</span>
        </div>
        {rows.length === 0 && <p className="map-empty">No moves match this filter.</p>}
        {rows.map((move) => <button type="button" key={move.id} aria-pressed={move.id === selectedMoveId}
          aria-label={`${move.unit}, ${move.from} to ${move.to}`}
          className={`map-moves-row map-moves-item${move.id === selectedMoveId ? ' is-selected' : ''}`}
          onClick={() => onSelect(move.id)}>
          <span className="map-moves-unit"><strong>{move.unit}</strong><small>{move.ids}</small></span>
          <span>{move.from} <span className="map-arrow-text">→</span> {move.to}</span>
          <span>{formatDate(move.start)} – {formatDate(move.finish)}</span>
          <span>{move.onSite ? 'On site' : `${Math.round(move.kmEach)} km${move.qty > 1 ? ` ×${move.qty}` : ''}`}</span>
          <span>{formatMoney(move.truck)}</span>
          <strong className="map-kept">{formatMoney(move.kept)}</strong>
          <span><span className={`map-type-chip map-type-${move.type}`}>{TYPE_LABELS[move.type]}</span></span>
        </button>)}
      </div>
    </div>
    <p className="map-footnote">Distances are straight-line × 1.3, an estimate of road distance. Truck cost = $150 base + $4.50/km per unit moved.</p>
  </section>
}

export default function MapView({ shifts, active = true }) {
  const [world, setWorld] = useState(null)
  const [worldError, setWorldError] = useState('')
  const [planResponse, setPlanResponse] = useState(null)
  const [selectedMoveId, setSelectedMoveId] = useState(null)
  const [selectedSiteId, setSelectedSiteId] = useState(null)
  // Leaflet can't start inside a display:none tab, so wait until this one is first opened.
  const [opened, setOpened] = useState(active)
  if (active && !opened) setOpened(true)

  const shiftKey = JSON.stringify(shifts)
  const planError = planResponse?.key === shiftKey ? planResponse.error : ''
  const allocations = planResponse?.allocations ?? null
  const replanning = planResponse?.key !== shiftKey && allocations !== null

  useEffect(() => {
    let cancelled = false
    loadWorld().then((data) => { if (!cancelled) setWorld(data) })
      .catch((err) => { if (!cancelled) setWorldError(err.message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    postPlan(shifts).then((data) => {
      if (!cancelled) setPlanResponse({ key: shiftKey, allocations: data.allocations, error: '' })
    }).catch((err) => {
      // Keep the last good plan on screen beside the error.
      if (!cancelled) setPlanResponse((current) => ({ key: shiftKey, allocations: current?.allocations ?? null, error: err.message }))
    })
    return () => { cancelled = true }
  }, [shifts, shiftKey])

  const moves = useMemo(() => (world && allocations ? buildMoves(allocations, world.classes, world.sites) : []),
    [world, allocations])
  const kpis = useMemo(() => moveKpis(moves), [moves])
  // Known gap: /assets/available has no shifts input, so idle units, badges and the fleet card
  // stay on the unshifted schedule when a project is dragged. Arcs, table and move KPIs do update.
  const fleet = useMemo(() => (world ? fleetStatus(world.assignments, world.idle) : null), [world])

  const selectedMove = moves.find((move) => move.id === selectedMoveId) ?? defaultMove(moves)
  const siteId = selectedSiteId ?? selectedMove?.fromId ?? world?.sites[0]?.id
  const site = world?.sites.find((entry) => entry.id === siteId)

  function selectMove(id) {
    setSelectedMoveId(id)
    setSelectedSiteId(null)
  }

  const error = worldError || planError
  return <section className="map-view">
    <div className="map-heading">
      <div><h1>Equipment map</h1><p>Where Northgate's equipment is, and where the plan moves it.</p></div>
      <span className="map-today">Today · {formatLongDate(DEMO_TODAY)}</span>
    </div>
    {error && <p className="map-error" role="alert">
      Couldn't load the map data ({error}). Check that the backend is running, then reload the page.
    </p>}
    {(!world || !allocations) && !error && <p className="map-loading">Loading the map…</p>}
    {world && allocations && <div className={`map-layout${replanning ? ' is-busy' : ''}`}>
      <aside className="map-side">
        <div className="map-kpis">
          <Kpi primary label="Kept in group by moving" value={formatMoney(kpis.kept)} sub="vs renting the same units outside" />
          <Kpi label="Moves recommended" value={kpis.count} sub={`${kpis.soon} start within 30 days`} />
          <Kpi label="Idle units now" value={fleet.idle} sub="Across yards and sites" />
          <Kpi label="Trucking cost" value={formatMoney(kpis.truck)} sub={`${Math.round(kpis.km)} km of moves, est.`} />
        </div>
        <FleetCard fleet={fleet} />
        <SitePanel site={site} fleet={fleet} moves={moves} selectedMoveId={selectedMove?.id}
          idleUnits={world.idle.filter((unit) => unit.site_id === siteId)} />
      </aside>
      <div className="map-main">
        {opened && <MapCanvas active={active} sites={world.sites} moves={moves} kpis={kpis}
          rentedBySite={fleet.rentedBySite} idleBySite={fleet.idleBySite}
          selectedMoveId={selectedMove?.id} selectedSiteId={siteId}
          onSelectMove={selectMove} onSelectSite={setSelectedSiteId} />}
        <MovesTable moves={moves} selectedMoveId={selectedMove?.id} onSelect={selectMove} />
      </div>
    </div>}
  </section>
}
