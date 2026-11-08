// Pure functions that turn API responses into what the Map tab shows.

// The API doesn't expose the demo date or company names, so they live here.
export const DEMO_TODAY = '2026-11-16'
export const COMPANIES = {
  NB01: { name: 'Northgate Builders', color: '#24405a' },
  NR01: { name: 'Northgate Rentals', color: '#1f8a5b' },
  NE01: { name: 'Northgate Electric', color: '#2f6fb3' },
}
// Literals for Leaflet; these mirror the CSS tokens in index.css.
export const TOKENS = { navy900: '#10202f', navy700: '#24405a', orange: '#f47a1f', blue: '#2f6fb3', green: '#1f8a5b', red: '#c8413b' }
export const MOVE_COLORS = { move_ours: TOKENS.blue, rent_sister: TOKENS.green }
export const SELECTED_ROUTE_COLOR = TOKENS.orange
export const TYPE_LABELS = { move_ours: 'Move ours', rent_sister: 'From Rentals' }

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * CARTO Dark Matter needs a free key, and without one every tile carries a watermark.
 * With no key, use OSM tiles darkened in CSS so a fresh clone still looks right.
 */
export function basemap(cartoKey) {
  if (cartoKey) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`,
      attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      subdomains: 'abcd',
      maxZoom: 20,
      className: 'map-tiles-dark',
    }
  }
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
    className: 'map-tiles-darkened',
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const SOON_DAYS = 30
const MOVE_OPTIONS = new Set(Object.keys(MOVE_COLORS))

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
})
export const formatMoney = (value) => money.format(value)

const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`)

export function addDays(iso, days) {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function formatDate(iso) {
  return new Date(toMs(iso)).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatLongDate(iso) {
  return new Date(toMs(iso)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

/** Rental customers' sites: Northgate Rentals' sites that aren't its yard. */
export function isCustomerSite(site) {
  return site.kind === 'site' && site.company === 'NR01'
}

/** "Riverside Clinic site" -> "Riverside Clinic"; yards keep their full name. */
export function siteLabel(site) {
  if (!site) return 'Unknown site'
  return site.name.replace(/ \(rental customer\)$/, '').replace(/ site$/, '')
}

/** One row and arc per allocation + origin site, so a split allocation still adds up. */
export function buildMoves(allocations, classes, sites) {
  const labels = Object.fromEntries(classes.map((entry) => [entry.code, entry.label]))
  const sitesById = Object.fromEntries(sites.map((site) => [site.id, site]))
  const rows = []
  for (const allocation of allocations) {
    const split = allocation.option === 'split'
    if ((!split && !MOVE_OPTIONS.has(allocation.option)) || !allocation.moves?.length) continue
    // A split need (e.g. 1 move ours + 1 buy) draws only its moved units, each in its own source's colour.
    const parts = split ? allocation.units ?? [] : []
    const partOf = (assetId) => parts.find((part) => part.asset_ids?.includes(assetId))
    const byOrigin = new Map()
    for (const move of allocation.moves) {
      const type = split ? partOf(move.asset_id)?.option : allocation.option
      const key = `${type}:${move.from_site_id}`
      if (!byOrigin.has(key)) byOrigin.set(key, { type, fromId: move.from_site_id, units: [] })
      byOrigin.get(key).units.push(move)
    }
    // Outside-rental cost of one unit, so a split credits each moved unit with what it really kept.
    const outsideEach = (allocation.kept_in_group + allocation.group_cost) / allocation.qty
    for (const { type, fromId, units } of byOrigin.values()) {
      if (!MOVE_OPTIONS.has(type)) continue
      const qty = units.length
      const label = labels[allocation.class] ?? allocation.class
      const part = partOf(units[0].asset_id)
      rows.push({
        id: split ? `${allocation.request_id}:${type}:${fromId}` : `${allocation.request_id}:${fromId}`,
        type,
        qty,
        unit: qty > 1 ? `${qty} × ${label}` : label,
        ids: unitIdsLabel(units.map((unit) => unit.asset_id)),
        fromId,
        toId: allocation.site_id,
        from: siteLabel(sitesById[fromId]),
        to: siteLabel(sitesById[allocation.site_id]),
        start: allocation.start,
        finish: allocation.finish,
        kmEach: units[0].km,
        km: units.reduce((total, unit) => total + unit.km, 0),
        truck: units.reduce((total, unit) => total + unit.transport_cost, 0),
        kept: split && part
          ? (outsideEach * part.qty - part.group_cost) * (qty / part.qty)
          : allocation.kept_in_group * (qty / allocation.moves.length),
        soon: toMs(allocation.start) <= toMs(DEMO_TODAY) + SOON_DAYS * DAY_MS,
        onSite: fromId === allocation.site_id,
      })
    }
  }
  return rows
}

function unitIdsLabel(assetIds) {
  const owned = assetIds.filter((id) => !id.startsWith('BUY-')).map((id) => `#${id}`)
  const bought = assetIds.length - owned.length
  if (bought === 0) return owned.join(', ')
  return [...owned, bought > 1 ? `${bought} new · Rentals buys them` : 'New · Rentals buys it'].join(', ')
}

/** Soonest start wins; among those, the most kept in the group. */
export function defaultMove(moves) {
  return [...moves].sort((a, b) => toMs(a.start) - toMs(b.start) || b.kept - a.kept)[0] ?? null
}

export function moveKpis(moves) {
  return {
    count: moves.length,
    soon: moves.filter((move) => move.soon).length,
    kept: moves.reduce((total, move) => total + move.kept, 0),
    truck: moves.reduce((total, move) => total + move.truck, 0),
    km: moves.reduce((total, move) => total + move.km, 0),
  }
}

function countBySite(rows) {
  const counts = {}
  for (const row of rows) counts[row.site_id] = (counts[row.site_id] ?? 0) + 1
  return counts
}

/**
 * Fleet status from the check-out log and today's idle units. A unit can still be
 * checked out while the schedule says it has finished, so idle units are taken out of "working".
 */
export function fleetStatus(assignments, idleUnits) {
  const idleIds = new Set(idleUnits.map((unit) => unit.asset_id))
  const out = assignments.filter((entry) => entry.checked_in === null && !idleIds.has(entry.asset_id))
  const rentedOut = out.filter((entry) => entry.project_id === null)
  const working = out.filter((entry) => entry.project_id !== null)
  return {
    working: working.length,
    rented: rentedOut.length,
    idle: idleUnits.length,
    total: working.length + rentedOut.length + idleUnits.length,
    workingBySite: countBySite(working),
    rentedBySite: countBySite(rentedOut),
    idleBySite: countBySite(idleUnits),
  }
}

/** "at Westgate Tower site since Nov 6" -> "Idle since Nov 6". */
export function idleSince(unit) {
  const match = unit.where?.match(/ since (.+)$/)
  return match ? `Idle since ${match[1]}` : 'Unassigned in yard'
}

/** One line on what leaves this site. Prefers the selected move, else the soonest. */
export function siteNote(siteId, moves, selectedId) {
  const leaving = moves.filter((move) => move.fromId === siteId && !move.onSite)
  if (leaving.length === 0) return 'No recommended moves leave this site.'
  const first = leaving.find((move) => move.id === selectedId) ?? defaultMove(leaving)
  const what = first.qty > 1 ? `move ${first.qty} units` : 'move'
  const more = leaving.length > 1 ? ` +${leaving.length - 1} more.` : ''
  return `Recommended: ${what} to ${first.to} on ${formatDate(first.start)} (${Math.round(first.kmEach)} km).${more}`
}

/** The box the map fits to: every yard and site except far-off rental customers. */
export function cityBounds(sites) {
  const city = sites.filter((site) => !isCustomerSite(site))
  if (city.length === 0) return null
  const lats = city.map((site) => site.lat)
  const lons = city.map((site) => site.lon)
  return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]
}

/** Which edge of the map a rental customer's chip sits on. */
export function chipEdge(site, bounds) {
  const [[south, west], [north, east]] = bounds
  if (site.lon < west) return 'west'
  if (site.lon > east) return 'east'
  return site.lat < south ? 'south' : north < site.lat ? 'north' : 'west'
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}
