import { act, fireEvent, render, screen } from '@testing-library/react'
import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { allocations, assignments, classes, idle, sites } from '../test/mapFixtures'
import MapCanvas from './MapCanvas'
import { buildMoves, fleetStatus, moveKpis } from './mapData'

const moves = buildMoves(allocations, classes, sites)
const fleet = fleetStatus(assignments, idle)

const noop = { onSelectMove: () => {}, onSelectSite: () => {} }

function canvasElement(props = {}) {
  return <MapCanvas active sites={sites} moves={moves} kpis={moveKpis(moves)}
    rentedBySite={fleet.rentedBySite} idleBySite={fleet.idleBySite}
    selectedMoveId="PRJ-RIV:1:S-WGT" selectedSiteId="S-WGT" {...noop} {...props} />
}

function renderCanvas(props = {}) {
  const handlers = { onSelectMove: vi.fn(), onSelectSite: vi.fn() }
  const view = render(canvasElement({ ...handlers, ...props }))
  return { ...view, ...handlers }
}

const paths = (container) => [...container.querySelectorAll('path.leaflet-interactive, .leaflet-overlay-pane path')]

describe('MapCanvas', () => {
  afterEach(() => { for (const name of ['zoomIn', 'zoomOut', 'fitBounds', 'invalidateSize', 'getBounds']) L.Map.prototype[name].mockRestore?.() })

  it('draws a labelled button for every yard and site', () => {
    renderCanvas()
    expect(screen.getByRole('button', { name: 'Westgate Tower, site, 1 idle' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Northgate Rentals yard, yard, 2 idle' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Capilano Substation, site' })).toBeTruthy()
  })

  it('shapes and colours markers by kind and company', () => {
    renderCanvas()
    const yard = screen.getByRole('button', { name: /^Northgate Rentals yard/ })
    expect(yard.className).toContain('map-marker-yard')
    expect(yard.getAttribute('style')).toContain('#a78bfa')
    const electric = screen.getByRole('button', { name: /^Capilano/ })
    expect(electric.className).toContain('map-marker-site')
    expect(electric.getAttribute('style')).toContain('#6cb6ff')
  })

  it('shows amber idle badges only where units are idle', () => {
    const { container } = renderCanvas()
    expect([...container.querySelectorAll('.map-marker-badge')].map((badge) => badge.textContent).sort())
      .toEqual(['1 idle', '1 idle', '2 idle'])
  })

  it('rings the selected marker and reports it to screen readers', () => {
    renderCanvas()
    const selected = screen.getByRole('button', { name: /^Westgate/ })
    expect(selected.className).toContain('is-selected')
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /^Capilano/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('selects a site when its marker is clicked', () => {
    const { onSelectSite } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: /^Capilano/ }))
    expect(onSelectSite).toHaveBeenCalledWith('S-CAP')
  })

  it('draws a pill with distance and cost for each move', () => {
    renderCanvas()
    expect(screen.getByRole('button', { name: /^Telehandler, Westgate Tower to Riverside Clinic, 10 km · \$196/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /12 km · \$412$/ })).toBeTruthy()
  })

  it('selects a move when its pill is clicked', () => {
    const { onSelectMove } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: /12 km · \$412$/ }))
    expect(onSelectMove).toHaveBeenCalledWith('PRJ-RIV:0:Y-NR')
  })

  it('draws one arc per move plus a glow on the selected one', () => {
    const { container } = renderCanvas()
    expect(paths(container)).toHaveLength(5)
    const glow = paths(container).filter((path) => path.getAttribute('stroke-width') === '12')
    expect(glow).toHaveLength(1)
    expect(glow[0].getAttribute('stroke')).toBe('#2ad1a3')
  })

  it('selects a move when its arc is clicked', () => {
    const { container, onSelectMove } = renderCanvas()
    const arc = paths(container).find((path) => path.getAttribute('stroke-width') === '4')
    fireEvent.click(arc)
    expect(onSelectMove).toHaveBeenCalledWith('PRJ-RIV:1:S-WGT')
  })

  it('colours by option, dims the unselected and dashes moves after 30 days', () => {
    const { container } = renderCanvas()
    const arcs = paths(container).filter((path) => path.getAttribute('stroke-width') === '2.5')
    expect(arcs).toHaveLength(3)
    expect(arcs.every((arc) => arc.getAttribute('stroke') === '#a78bfa')).toBe(true)
    expect(arcs.every((arc) => arc.getAttribute('stroke-opacity') === '0.5')).toBe(true)
    expect(arcs.map((arc) => arc.getAttribute('stroke-dasharray'))).toEqual([null, '7 7', '7 7'])
  })

  it('draws no arc for a move that stays on site', () => {
    const onSite = [{ ...moves[1], toId: moves[1].fromId, onSite: true, id: 'same' }]
    const { container } = renderCanvas({ moves: onSite, selectedMoveId: 'same' })
    expect(paths(container)).toHaveLength(0)
  })

  it('shows far-off customers as chips that select the site', () => {
    vi.spyOn(L.Map.prototype, 'getBounds').mockReturnValue(L.latLngBounds([53.4, -113.7], [53.6, -113.3]))
    const { onSelectSite } = renderCanvas()
    const chip = screen.getByRole('button', { name: 'Spruce Grove Storage · 1 units rented out' })
    expect(chip.className).toContain('map-edge-chip-west')
    fireEvent.click(chip)
    expect(onSelectSite).toHaveBeenCalledWith('S-EX1')
    expect(screen.getByRole('button', { name: 'Leduc Cold Storage · 2 units rented out' }).className).toContain('map-edge-chip-south')
  })

  it('hides a chip once its marker is in view', () => {
    vi.spyOn(L.Map.prototype, 'getBounds').mockReturnValue(L.latLngBounds([53.2, -114], [53.6, -113.3]))
    renderCanvas()
    expect(screen.queryByRole('button', { name: /units rented out/ })).toBeNull()
  })

  it('updates chips when the map moves', () => {
    const getBounds = vi.spyOn(L.Map.prototype, 'getBounds').mockReturnValue(L.latLngBounds([53.2, -114], [53.6, -113.3]))
    const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds')
    renderCanvas()
    const map = fitBounds.mock.contexts[0]
    getBounds.mockReturnValue(L.latLngBounds([53.4, -113.7], [53.6, -113.3]))
    act(() => { map.fire('moveend') })
    expect(screen.getAllByRole('button', { name: /units rented out/ })).toHaveLength(2)
  })

  it('shows the plan summary, legend and attribution', () => {
    const { container } = renderCanvas()
    expect(container.querySelector('.map-summary-pill').textContent).toBe('4 moves· $20,420 kept in group')
    expect(container.querySelector('.map-legend').textContent).toContain('Starts after 30 days')
    expect(container.querySelector('.leaflet-control-attribution').textContent).toContain('OpenStreetMap')
  })

  it('uses the singular for one move', () => {
    const { container } = renderCanvas({ kpis: moveKpis(moves.slice(0, 1)) })
    expect(container.querySelector('.map-summary-pill strong').textContent).toBe('1 move')
  })

  it('wires the zoom and fit buttons to the map', () => {
    const zoomIn = vi.spyOn(L.Map.prototype, 'zoomIn')
    const zoomOut = vi.spyOn(L.Map.prototype, 'zoomOut')
    const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds')
    renderCanvas()
    fitBounds.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit map to sites' }))
    expect(zoomIn).toHaveBeenCalledTimes(1)
    expect(zoomOut).toHaveBeenCalledTimes(1)
    expect(fitBounds.mock.calls[0][0]).toEqual([[53.454, -113.615], [53.57, -113.415]])
  })

  it('tells Leaflet to re-measure when the tab is shown again', () => {
    const invalidateSize = vi.spyOn(L.Map.prototype, 'invalidateSize')
    const { rerender } = renderCanvas({ active: false })
    invalidateSize.mockClear()
    rerender(canvasElement({ active: true }))
    expect(invalidateSize).toHaveBeenCalledTimes(1)
  })

  it('returns focus to a marker after selecting it re-renders', () => {
    const { rerender } = renderCanvas()
    fireEvent.click(screen.getByRole('button', { name: /^Capilano/ }))
    rerender(canvasElement({ selectedSiteId: 'S-CAP' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Capilano/ }))
  })
})
