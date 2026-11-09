import { describe, expect, it } from 'vitest'
import { allocations, assignments, classes, idle, sites } from '../test/mapFixtures'
import {
  addDays, basemap, buildMoves, chipEdge, cityBounds, defaultMove, escapeHtml, fleetStatus, formatDate,
  formatLongDate, formatMoney, idleSince, isCustomerSite, moveKpis, siteLabel, siteNote,
} from './mapData'

const moves = buildMoves(allocations, classes, sites)
const byRequest = (id) => moves.find((move) => move.id.startsWith(id))

describe('buildMoves', () => {
  it('keeps only move_ours and rent_sister allocations', () => {
    expect(moves.map((move) => move.id)).toEqual([
      'PRJ-RIV:0:Y-NR', 'PRJ-RIV:1:S-WGT', 'PRJ-CAP:2:S-RIV', 'PRJ-KNG:5:S-RIV',
    ])
  })

  it('rolls units from one origin into a single row', () => {
    expect(byRequest('PRJ-RIV:0')).toMatchObject({
      type: 'rent_sister', qty: 2, unit: '2 × 19 ft scissor lift', ids: '#100003, #100004',
      from: 'Northgate Rentals yard', to: 'Riverside Clinic', kmEach: 12.4, soon: true, onSite: false,
    })
    expect(byRequest('PRJ-RIV:0').truck).toBeCloseTo(411.72)
    expect(byRequest('PRJ-RIV:0').km).toBeCloseTo(24.8)
  })

  it('labels a unit bought earlier as new', () => {
    expect(byRequest('PRJ-KNG:5').ids).toBe('New · Rentals buys it')
  })

  it('marks moves more than 30 days out as not soon', () => {
    expect(byRequest('PRJ-CAP:2').soon).toBe(false)
  })

  it('counts a move exactly 30 days out as soon', () => {
    const [row] = buildMoves([{ ...allocations[1], start: addDays('2026-11-16', 30) }], classes, sites)
    expect(row.soon).toBe(true)
    const [later] = buildMoves([{ ...allocations[1], start: addDays('2026-11-16', 31) }], classes, sites)
    expect(later.soon).toBe(false)
  })

  it('splits an allocation with two origins and shares out what it keeps', () => {
    const split = { ...allocations[0], kept_in_group: 900, moves: [
      { asset_id: '1', from_site_id: 'Y-NR', to_site_id: 'S-RIV', km: 12, transport_cost: 200 },
      { asset_id: '2', from_site_id: 'Y-NR', to_site_id: 'S-RIV', km: 12, transport_cost: 200 },
      { asset_id: '3', from_site_id: 'S-KNG', to_site_id: 'S-RIV', km: 3, transport_cost: 165 },
    ] }
    const rows = buildMoves([split], classes, sites)
    expect(rows.map((row) => [row.fromId, row.qty, row.kept])).toEqual([['Y-NR', 2, 600], ['S-KNG', 1, 300]])
  })

  it('draws only the moved unit of a split need and credits what that unit kept', () => {
    const split = { ...allocations[0], option: 'split', qty: 2, group_cost: 19264.42, kept_in_group: 67575.58,
      units: [
        { option: 'move_ours', qty: 1, asset_ids: ['100017'], group_cost: 8544.16 },
        { option: 'buy', qty: 1, asset_ids: ['BUY-TELEHANDLER-6'], group_cost: 10720.26 },
      ],
      moves: [{ asset_id: '100017', from_site_id: 'S-WGT', to_site_id: 'S-RIV', km: 16.5, transport_cost: 224.16 }] }
    const rows = buildMoves([split], classes, sites)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'move_ours', qty: 1, ids: '#100017', fromId: 'S-WGT' })
    // One outside unit costs (67575.58 + 19264.42) / 2 = 43420; the moved unit's group cost is 8544.16.
    expect(rows[0].kept).toBeCloseTo(34875.84)
  })

  it('flags a move that stays on the same site', () => {
    const same = { ...allocations[1], moves: [{ asset_id: '1', from_site_id: 'S-RIV', to_site_id: 'S-RIV', km: 0, transport_cost: 150 }] }
    expect(buildMoves([same], classes, sites)[0].onSite).toBe(true)
  })

  it('shows the class code and survives a site or class it does not know', () => {
    const odd = { ...allocations[1], class: 'NEW_CLASS', moves: [{ asset_id: '1', from_site_id: 'S-GONE', to_site_id: 'S-RIV', km: 1, transport_cost: 150 }] }
    expect(buildMoves([odd], classes, sites)[0]).toMatchObject({ unit: 'NEW_CLASS', from: 'Unknown site' })
  })

  it('skips a move option with no moves', () => {
    expect(buildMoves([{ ...allocations[1], moves: [] }], classes, sites)).toEqual([])
  })
})

describe('defaultMove', () => {
  it('picks the soonest start, then the most kept', () => {
    expect(defaultMove(moves).id).toBe('PRJ-RIV:1:S-WGT')
  })

  it('returns null with no moves', () => {
    expect(defaultMove([])).toBeNull()
  })
})

describe('moveKpis', () => {
  it('matches the seed plan totals', () => {
    const kpis = moveKpis(moves)
    expect(kpis).toMatchObject({ count: 4, soon: 2 })
    expect(Math.round(kpis.kept)).toBe(20420)
    expect(Math.round(kpis.truck)).toBe(955)
    expect(Math.round(kpis.km)).toBe(46)
  })
})

describe('fleetStatus', () => {
  const fleet = fleetStatus(assignments, idle)

  it('separates working, rented and idle units', () => {
    expect(fleet).toMatchObject({ working: 2, rented: 3, idle: 4, total: 9 })
  })

  it('does not count a checked-out unit as working once it is idle', () => {
    expect(fleet.workingBySite).toEqual({ 'S-WGT': 1, 'S-KNG': 1 })
  })

  it('counts rented and idle units per site', () => {
    expect(fleet.rentedBySite).toEqual({ 'S-EX1': 1, 'S-EX2': 2 })
    expect(fleet.idleBySite).toEqual({ 'Y-NR': 2, 'S-WGT': 1, 'S-KNG': 1 })
  })
})

describe('idleSince', () => {
  it('reads the date from the where text', () => {
    expect(idleSince(idle[2])).toBe('Idle since Nov 6')
  })

  it('falls back when the unit has no date', () => {
    expect(idleSince(idle[0])).toBe('Unassigned in yard')
    expect(idleSince({})).toBe('Unassigned in yard')
  })
})

describe('siteNote', () => {
  it('describes a single unit leaving', () => {
    expect(siteNote('S-WGT', moves)).toBe('Recommended: move to Riverside Clinic on Nov 23 (10 km).')
  })

  it('says how many units leave', () => {
    expect(siteNote('Y-NR', moves)).toBe('Recommended: move 2 units to Riverside Clinic on Nov 23 (12 km).')
  })

  it('prefers the selected move and counts the others', () => {
    expect(siteNote('S-RIV', moves, 'PRJ-KNG:5:S-RIV')).toBe('Recommended: move to Kingsway Lofts on Feb 1 (3 km). +1 more.')
  })

  it('says so when nothing leaves', () => {
    expect(siteNote('Y-NB', moves)).toBe('No recommended moves leave this site.')
  })

  it('ignores a move that stays on site', () => {
    const same = [{ ...moves[1], fromId: 'S-RIV', toId: 'S-RIV', onSite: true }]
    expect(siteNote('S-RIV', same)).toBe('No recommended moves leave this site.')
  })
})

describe('sites', () => {
  it('recognises rental customers only', () => {
    expect(sites.filter(isCustomerSite).map((site) => site.id)).toEqual(['S-EX1', 'S-EX2'])
  })

  it('tidies site names', () => {
    expect(siteLabel(sites[2])).toBe('Riverside Clinic')
    expect(siteLabel(sites[6])).toBe('Spruce Grove Storage')
    expect(siteLabel(sites[0])).toBe('Northgate Builders yard')
    expect(siteLabel(undefined)).toBe('Unknown site')
  })

  it('fits the map to the city without the far-off customers', () => {
    expect(cityBounds(sites)).toEqual([[53.454, -113.615], [53.57, -113.415]])
    expect(cityBounds(sites.filter(isCustomerSite))).toBeNull()
  })

  it('puts each customer chip on the edge it lies past', () => {
    const bounds = cityBounds(sites)
    expect(chipEdge(sites[6], bounds)).toBe('west')
    expect(chipEdge({ lat: 53.3, lon: -113.5 }, bounds)).toBe('south')
    expect(chipEdge({ lat: 53.5, lon: -113.1 }, bounds)).toBe('east')
    expect(chipEdge({ lat: 53.9, lon: -113.5 }, bounds)).toBe('north')
  })
})

describe('basemap', () => {
  it('uses CARTO dark tiles with the key and credits both sources', () => {
    const map = basemap('a b')
    expect(map.url).toBe('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=a%20b')
    expect(map.attribution).toContain('OpenStreetMap')
    expect(map.attribution).toContain('CARTO')
    expect(map.className).toBe('map-tiles-dark')
  })

  it.each([undefined, ''])('never requests CARTO without a key (%s)', (key) => {
    const map = basemap(key)
    expect(map.url).toContain('tile.openstreetmap.org')
    expect(map.attribution).not.toContain('CARTO')
    expect(map.className).toBe('map-tiles-darkened')
  })
})

describe('formatting', () => {
  it('formats dates without shifting the day', () => {
    expect(formatDate('2026-11-23')).toBe('Nov 23')
    expect(formatLongDate('2026-11-16')).toBe('Mon, Nov 16, 2026')
    expect(addDays('2026-12-30', 7)).toBe('2027-01-06')
  })

  it('formats money as whole dollars', () => {
    expect(formatMoney(20420.01)).toBe('$20,420')
  })

  it('escapes text bound for marker HTML', () => {
    expect(escapeHtml(`<b a="1">&'`)).toBe('&lt;b a=&quot;1&quot;&gt;&amp;&#39;')
  })
})
