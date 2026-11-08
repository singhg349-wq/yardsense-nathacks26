import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvent } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  basemap, chipEdge, cityBounds, COMPANIES, escapeHtml, formatMoney, isCustomerSite, MOVE_COLORS, siteLabel,
} from './mapData'
import { arcGeometry } from './mapGeometry'

const TILES = basemap(import.meta.env.VITE_CARTO_KEY)
const FIT_OPTIONS = { paddingTopLeft: [70, 72], paddingBottomRight: [80, 56] }
const MARKER_RADIUS_PX = 22

// Hand-placed so these names don't sit on top of an arc in the seed layout. Default is 'right'.
const LABEL_SIDES = { 'S-WGT': 'below', 'S-KNG': 'left', 'S-WMD': 'below' }
const YARD_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-7h10v7"/><path d="M7 17h10"/></svg>'
const SITE_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V10l5-3v14"/><path d="M9 21V4l11 4v13"/><path d="M13 11h3M13 15h3"/><path d="M2 21h20"/></svg>'

function siteIcon(site, idleCount, selected) {
  const name = siteLabel(site)
  const color = COMPANIES[site.company]?.color ?? '#9fb2c1'
  const aria = `${name}, ${site.kind}${idleCount ? `, ${idleCount} idle` : ''}`
  const badge = idleCount ? `<span class="map-marker-badge">${idleCount} idle</span>` : ''
  return L.divIcon({
    className: 'map-marker-anchor',
    iconSize: [0, 0],
    html: `<button type="button" data-focus-key="site:${escapeHtml(site.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(aria)}"
      class="map-marker map-marker-${site.kind}${selected ? ' is-selected' : ''}" style="background:${color}">${site.kind === 'yard' ? YARD_ICON : SITE_ICON}</button>
      ${badge}<span class="map-marker-name map-marker-name-${LABEL_SIDES[site.id] ?? 'right'}">${escapeHtml(name)}</span>`,
  })
}

function pillIcon(move, selected) {
  const text = `${Math.round(move.kmEach)} km · ${formatMoney(move.truck)}`
  const aria = `${move.unit}, ${move.from} to ${move.to}, ${text}`
  return L.divIcon({
    className: 'map-marker-anchor',
    iconSize: [0, 0],
    html: `<button type="button" data-focus-key="move:${escapeHtml(move.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(aria)}"
      class="map-pill${selected ? ' is-selected' : ''}">${escapeHtml(text)}</button>`,
  })
}

function arrowIcon(angle, color, opacity) {
  return L.divIcon({
    className: 'map-marker-anchor',
    iconSize: [0, 0],
    html: `<span class="map-arrow" style="transform:translate(-50%,-50%) rotate(${angle}deg);background:${color};opacity:${opacity}"></span>`,
  })
}

/** Curved arcs, arrowheads and price pills. Curves are in pixels, so they follow the zoom. */
function MoveArcs({ moves, sitesById, selectedMoveId, onSelectMove, onFocusKey }) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())
  useMapEvent('zoomend', () => setZoom(map.getZoom()))

  const arcs = useMemo(() => moves.flatMap((move, index) => {
    const from = sitesById[move.fromId]
    const to = sitesById[move.toId]
    if (!from || !to || move.onSite) return []
    const geometry = arcGeometry(
      map.project([from.lat, from.lon], zoom), map.project([to.lat, to.lon], zoom),
      { side: index % 2 ? -1 : 1, trim: MARKER_RADIUS_PX },
    )
    if (!geometry) return []
    const toLatLng = (point) => map.unproject(L.point(point.x, point.y), zoom)
    const selected = move.id === selectedMoveId
    const color = MOVE_COLORS[move.type]
    return [{
      move,
      selected,
      color,
      positions: geometry.points.map(toLatLng),
      midpoint: toLatLng(geometry.mid),
      end: toLatLng(geometry.end),
      pill: pillIcon(move, selected),
      arrow: arrowIcon(geometry.angle, color, selected ? 1 : 0.5),
    }]
  }), [moves, sitesById, selectedMoveId, zoom, map])

  return arcs.map(({ move, selected, color, positions, midpoint, end, pill, arrow }) => {
    const select = {
      click: () => {
        onFocusKey(`move:${move.id}`)
        onSelectMove(move.id)
      },
    }
    return <Fragment key={move.id}>
      {selected && <Polyline positions={positions} interactive={false}
        pathOptions={{ color, weight: 12, opacity: 0.22, lineCap: 'round' }} />}
      <Polyline positions={positions} eventHandlers={select}
        pathOptions={{
          color,
          weight: selected ? 4 : 2.5,
          opacity: selected ? 1 : 0.5,
          dashArray: move.soon ? null : '7 7',
          lineCap: 'round',
        }} />
      <Marker position={end} icon={arrow} interactive={false} keyboard={false} />
      <Marker position={midpoint} icon={pill} keyboard={false} zIndexOffset={selected ? 900 : 500}
        eventHandlers={select} />
    </Fragment>
  })
}

function SiteMarkers({ sites, idleBySite, selectedSiteId, onSelectSite, onFocusKey }) {
  return sites.map((site) => <SiteMarker key={site.id} site={site}
    idleCount={idleBySite[site.id] ?? 0} selected={site.id === selectedSiteId}
    onSelectSite={onSelectSite} onFocusKey={onFocusKey} />)
}

function SiteMarker({ site, idleCount, selected, onSelectSite, onFocusKey }) {
  const icon = useMemo(() => siteIcon(site, idleCount, selected), [site, idleCount, selected])
  return <Marker position={[site.lat, site.lon]} icon={icon} keyboard={false}
    zIndexOffset={selected ? 800 : 0}
    eventHandlers={{
      click: () => {
        onFocusKey(`site:${site.id}`)
        onSelectSite(site.id)
      },
    }} />
}

/** Reports what the map is showing, so edge chips can hide once their marker is in view. */
function ViewWatcher({ onChange }) {
  const map = useMap()
  useMapEvent('moveend', () => onChange(map.getBounds()))
  useEffect(() => onChange(map.getBounds()), [map, onChange])
  return null
}

/** App keeps hidden tabs mounted, so Leaflet needs telling when it has a real size again. */
function ResizeOnShow({ active }) {
  const map = useMap()
  useEffect(() => {
    if (active) map.invalidateSize()
  }, [active, map])
  return null
}

export default function MapCanvas({
  active, sites, moves, kpis, rentedBySite, idleBySite, selectedMoveId, selectedSiteId,
  onSelectMove, onSelectSite,
}) {
  const mapRef = useRef(null)
  const shellRef = useRef(null)
  const focusKey = useRef(null)
  const [viewBounds, setViewBounds] = useState(null)
  const sitesById = useMemo(() => Object.fromEntries(sites.map((site) => [site.id, site])), [sites])
  const bounds = useMemo(() => cityBounds(sites), [sites])
  const customers = sites.filter((site) => isCustomerSite(site)
    && !viewBounds?.contains([site.lat, site.lon]))

  // Selecting swaps the marker's HTML, which drops keyboard focus. Put it back.
  useEffect(() => {
    const key = focusKey.current
    if (!key) return
    focusKey.current = null
    const target = [...shellRef.current.querySelectorAll('[data-focus-key]')]
      .find((element) => element.dataset.focusKey === key)
    target?.focus({ preventScroll: true })
  }, [selectedMoveId, selectedSiteId])

  const rememberFocus = (key) => { focusKey.current = key }

  return <div className="map-canvas" ref={shellRef}>
    <MapContainer ref={mapRef} bounds={bounds} boundsOptions={FIT_OPTIONS} zoomControl={false}
      scrollWheelZoom={false} zoomSnap={0.25} className="map-leaflet">
      <TileLayer {...TILES} />
      <ResizeOnShow active={active} />
      <ViewWatcher onChange={setViewBounds} />
      <SiteMarkers sites={sites} idleBySite={idleBySite} selectedSiteId={selectedSiteId}
        onSelectSite={onSelectSite} onFocusKey={rememberFocus} />
      <MoveArcs moves={moves} sitesById={sitesById} selectedMoveId={selectedMoveId}
        onSelectMove={onSelectMove} onFocusKey={rememberFocus} />
    </MapContainer>

    <div className="map-summary-pill">
      <strong>{kpis.count} move{kpis.count === 1 ? '' : 's'}</strong>
      <span>· {formatMoney(kpis.kept)} kept in group</span>
    </div>

    <button type="button" className="map-round-button map-fit" aria-label="Fit map to sites"
      onClick={() => mapRef.current?.fitBounds(bounds, FIT_OPTIONS)}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
    </button>

    <div className="map-zoom">
      <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
    </div>

    {customers.map((site) => <button type="button" key={site.id}
      className={`map-edge-chip map-edge-chip-${chipEdge(site, bounds)}`}
      aria-pressed={site.id === selectedSiteId} onClick={() => onSelectSite(site.id)}>
      {siteLabel(site)} · {rentedBySite[site.id] ?? 0} units rented out
    </button>)}

    <div className="map-legend">
      <div><span className="map-legend-line" style={{ background: MOVE_COLORS.move_ours }} />Move ours</div>
      <div><span className="map-legend-line" style={{ background: MOVE_COLORS.rent_sister }} />From Northgate Rentals</div>
      <div><span className="map-legend-dash" />Starts after 30 days</div>
      <div><span className="map-legend-shape map-legend-yard" />Yard<span className="map-legend-shape map-legend-site" />Site</div>
    </div>
  </div>
}
