import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import PlannerView from './PlannerView'

vi.mock('../api', () => ({ getPlan: vi.fn(), postPlan: vi.fn(), postReplan: vi.fn() }))

const plan = {
  totals: { group_cost: 1000, kept_in_group: 500 },
  projects: [{ id: 'PRJ-KNG', name: 'Kingsway', site_id: 'S1', start_date: '2026-11-23',
    completion_date: '2027-02-01', phases: [] }],
  allocations: [], changed: [],
}

beforeEach(() => {
  vi.mocked(api.getPlan).mockResolvedValue(plan)
  vi.mocked(api.postReplan).mockReturnValue(new Promise(() => {}))
})

describe('PlannerView', () => {
  it('keeps the last plan on screen while a shifted plan loads', async () => {
    let resolve
    vi.mocked(api.postPlan).mockReturnValue(new Promise((done) => { resolve = done }))
    const { rerender } = render(<PlannerView shifts={[]} onSetShift={() => {}} />)
    expect(await screen.findByText('Group timeline')).toBeTruthy()
    await screen.findByText('Kingsway', { selector: '.tl-project-name span' })
    rerender(<PlannerView shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} onSetShift={() => {}} />)
    expect(screen.getByText('updating…')).toBeTruthy()
    expect(screen.getByText('Kingsway', { selector: '.tl-project-name span' })).toBeTruthy()
    await act(async () => { resolve({ ...plan, changed: [] }) })
    expect(screen.queryByText('updating…')).toBeNull()
  })
})
