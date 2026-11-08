import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import { allocations, assignments, classes, idle, sites } from '../test/mapFixtures'
import MapView from './MapView'

vi.mock('../api', () => ({
  getSites: vi.fn(), getAssignments: vi.fn(), getClasses: vi.fn(),
  getAvailableAssets: vi.fn(), postPlan: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(api.getSites).mockResolvedValue(sites)
  vi.mocked(api.getAssignments).mockResolvedValue(assignments)
  vi.mocked(api.getClasses).mockResolvedValue(classes)
  vi.mocked(api.getAvailableAssets).mockReset().mockResolvedValue(idle)
  vi.mocked(api.postPlan).mockReset().mockResolvedValue({ allocations })
})

async function renderLoaded(props = {}) {
  const view = render(<MapView shifts={[]} {...props} />)
  await screen.findByRole('heading', { name: 'Recommended moves' })
  return view
}

const row = (name) => screen.getAllByRole('button', { name }).find((button) => button.className.includes('map-moves-item'))
const sitePanel = () => within(screen.getByRole('region', { name: /Westgate|Rentals yard|Kingsway|Riverside|Capilano|Builders|Spruce|Leduc/ }))

describe('MapView', () => {
  it('asks for idle units from demo today to a week later', async () => {
    await renderLoaded()
    expect(api.getAvailableAssets).toHaveBeenCalledWith('2026-11-16', '2026-11-23')
    expect(api.postPlan).toHaveBeenCalledWith([])
  })

  it('shows the KPI tiles from the plan and idle data', async () => {
    const { container } = await renderLoaded()
    const tiles = [...container.querySelectorAll('.map-kpi')].map((tile) => tile.textContent)
    expect(tiles[0]).toContain('Kept in group by moving$20,420')
    expect(tiles[1]).toContain('Moves recommended4')
    expect(tiles[1]).toContain('2 start within 30 days')
    expect(tiles[2]).toContain('Idle units now4')
    expect(tiles[3]).toContain('Trucking cost$955')
    expect(tiles[3]).toContain('46 km of moves, est.')
  })

  it('shows fleet status counts', async () => {
    const { container } = await renderLoaded()
    const legend = container.querySelector('.map-fleet-legend').textContent
    expect(legend).toContain('Working on group projects2')
    expect(legend).toContain('Rented to outside customers3')
    expect(legend).toContain('Idle4')
    expect(container.querySelector('.map-card-heading').textContent).toContain('9 units')
  })

  it('selects the soonest, highest-value move by default and shows its origin', async () => {
    await renderLoaded()
    expect(row(/^Telehandler, Westgate/).getAttribute('aria-pressed')).toBe('true')
    const panel = sitePanel()
    expect(panel.getByRole('heading', { name: 'Westgate Tower' })).toBeTruthy()
    expect(panel.getByText('Northgate Builders · 17250 Cedar Gate Avenue NW, Edmonton, AB')).toBeTruthy()
    expect(panel.getByText('1 idle')).toBeTruthy()
    expect(panel.getByText('1 working')).toBeTruthy()
    expect(panel.getByText('Telehandler 10k lb 55 ft')).toBeTruthy()
    expect(panel.getByText('#100017 · Idle since Nov 6')).toBeTruthy()
    expect(panel.getByText('Recommended: move to Riverside Clinic on Nov 23 (10 km).')).toBeTruthy()
  })

  it('shows the moves table columns', async () => {
    await renderLoaded()
    const lifts = row(/^2 × 19 ft scissor lift/)
    expect(lifts.textContent).toContain('#100003, #100004')
    expect(lifts.textContent).toContain('Northgate Rentals yard → Riverside Clinic')
    expect(lifts.textContent).toContain('Nov 23 – Jan 31')
    expect(lifts.textContent).toContain('12 km ×2')
    expect(lifts.textContent).toContain('$412')
    expect(lifts.textContent).toContain('$4,978')
    expect(lifts.textContent).toContain('From Rentals')
    expect(row(/^Telehandler, Westgate/).textContent).toContain('Move ours')
  })

  it('clicking a row selects the move and shows its origin site', async () => {
    await renderLoaded()
    fireEvent.click(row(/^2 × 19 ft scissor lift/))
    expect(row(/^2 × 19 ft scissor lift/).getAttribute('aria-pressed')).toBe('true')
    expect(row(/^Telehandler, Westgate/).getAttribute('aria-pressed')).toBe('false')
    expect(sitePanel().getByRole('heading', { name: 'Northgate Rentals yard' })).toBeTruthy()
    expect(sitePanel().getAllByText('Scissor Lift 19 ft electric')).toHaveLength(2)
    expect(sitePanel().getByText('#100003 · Unassigned in yard')).toBeTruthy()
  })

  it('clicking a marker shows that site and keeps the selected move', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^Kingsway Lofts, site/ }))
    expect(sitePanel().getByRole('heading', { name: 'Kingsway Lofts' })).toBeTruthy()
    expect(sitePanel().getByText('Mini Excavator 3.5 t')).toBeTruthy()
    expect(sitePanel().getByText('No recommended moves leave this site.')).toBeTruthy()
    expect(row(/^Telehandler, Westgate/).getAttribute('aria-pressed')).toBe('true')
  })

  it('selecting a move after a site goes back to the move origin', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^Kingsway Lofts, site/ }))
    fireEvent.click(row(/^2 × 19 ft scissor lift/))
    expect(sitePanel().getByRole('heading', { name: 'Northgate Rentals yard' })).toBeTruthy()
  })

  it('shows rented-out units for a customer site', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^Leduc Cold Storage · 2/ }))
    expect(sitePanel().getByText('2 rented out')).toBeTruthy()
    expect(sitePanel().getByText('0 idle')).toBeTruthy()
  })

  it('filters the table and shows counts', async () => {
    const { container } = await renderLoaded()
    const rows = () => container.querySelectorAll('.map-moves-item')
    expect(rows()).toHaveLength(4)
    const ours = screen.getByRole('button', { name: 'Move ours · 1' })
    fireEvent.click(ours)
    expect(ours.getAttribute('aria-pressed')).toBe('true')
    expect(rows()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'From Rentals · 3' }))
    expect(rows()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'All · 4' }))
    expect(rows()).toHaveLength(4)
  })

  it('notes that distances are estimates', async () => {
    await renderLoaded()
    expect(screen.getByText(/straight-line × 1\.3/)).toBeTruthy()
  })

  it('re-plans when shifts change and updates the moves', async () => {
    const { container, rerender } = await renderLoaded()
    const shifts = [{ project_id: 'PRJ-KNG', days: 42 }]
    vi.mocked(api.postPlan).mockResolvedValue({
      allocations: allocations.filter((entry) => entry.request_id !== 'PRJ-KNG:5'),
    })
    rerender(<MapView shifts={shifts} />)
    expect(api.postPlan).toHaveBeenLastCalledWith(shifts)
    await waitFor(() => expect(container.querySelectorAll('.map-moves-item')).toHaveLength(3))
    expect(container.querySelector('.map-summary-pill').textContent).toBe('3 moves· $18,463 kept in group')
  })

  it('keeps the chosen move across a re-plan when it still exists', async () => {
    const { rerender } = await renderLoaded()
    fireEvent.click(row(/^2 × 19 ft scissor lift/))
    rerender(<MapView shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} />)
    await act(async () => {})
    expect(row(/^2 × 19 ft scissor lift/).getAttribute('aria-pressed')).toBe('true')
  })

  it('falls back to the default move when the chosen one disappears', async () => {
    const { rerender, container } = await renderLoaded()
    fireEvent.click(row(/^2 × 19 ft scissor lift/))
    vi.mocked(api.postPlan).mockResolvedValue({
      allocations: allocations.filter((entry) => entry.request_id !== 'PRJ-RIV:0'),
    })
    rerender(<MapView shifts={[{ project_id: 'PRJ-RIV', days: 7 }]} />)
    await waitFor(() => expect(container.querySelectorAll('.map-moves-item')).toHaveLength(3))
    expect(row(/^Telehandler, Westgate/).getAttribute('aria-pressed')).toBe('true')
  })

  it('does not refetch idle units on a re-plan (known gap, see DECISIONS #16)', async () => {
    const { rerender } = await renderLoaded()
    rerender(<MapView shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} />)
    await act(async () => {})
    expect(api.getAvailableAssets).toHaveBeenCalledTimes(1)
  })

  it('shows a clear message when the backend is unreachable', async () => {
    vi.mocked(api.getSites).mockRejectedValue(new Error('Failed to fetch'))
    vi.mocked(api.postPlan).mockRejectedValue(new Error('Failed to fetch'))
    render(<MapView shifts={[]} />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Check that the backend is running')
    expect(screen.queryByRole('heading', { name: 'Recommended moves' })).toBeNull()
  })

  it('keeps the last plan on screen if a re-plan fails', async () => {
    const { container, rerender } = await renderLoaded()
    vi.mocked(api.postPlan).mockRejectedValue(new Error('HTTP 500'))
    rerender(<MapView shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} />)
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500')
    expect(container.querySelectorAll('.map-moves-item')).toHaveLength(4)
  })

  it('shows a loading message first', async () => {
    render(<MapView shifts={[]} />)
    expect(screen.getByText('Loading the map…')).toBeTruthy()
    await screen.findByRole('heading', { name: 'Recommended moves' })
  })

  it('handles a plan with no moves', async () => {
    vi.mocked(api.postPlan).mockResolvedValue({ allocations: [] })
    const { container } = await renderLoaded()
    expect(screen.getByText('No moves match this filter.')).toBeTruthy()
    expect(container.querySelector('.map-summary-pill').textContent).toBe('0 moves· $0 kept in group')
  })

  it('waits to start Leaflet until the tab is first opened', async () => {
    const { container, rerender } = await renderLoaded({ active: false })
    expect(container.querySelector('.leaflet-container')).toBeNull()
    rerender(<MapView shifts={[]} active />)
    expect(container.querySelector('.leaflet-container')).toBeTruthy()
    rerender(<MapView shifts={[]} active={false} />)
    expect(container.querySelector('.leaflet-container')).toBeTruthy()
  })
})
