import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import ReplanCard from './ReplanCard'

vi.mock('../api', () => ({ postReplan: vi.fn() }))

const saving = {
  greedy_cost: 126470.48, replan_cost: 123645.83, switching_cost: 354.26,
  net_saving: 2470.39, locked_count: 21, recommend: true,
  changes: [
    { request_id: 'PRJ-RIV:0', project: 'Riverside Clinic', class: 'SCISSOR_19',
      from_option: 'rent_sister', to_option: 'rent_outside', from_asset: '100004',
      to_asset: null, saving: -1414.74, switching_cost: 204.26 },
    { request_id: 'PRJ-WGT:4', project: 'Westgate Tower', class: 'SCISSOR_19',
      from_option: 'rent_outside', to_option: 'rent_sister', from_asset: null,
      to_asset: '100004', saving: 4239.39, switching_cost: 150 },
  ],
}

const noSaving = {
  greedy_cost: 146483.34, replan_cost: 146483.34, switching_cost: 0,
  net_saving: 0, locked_count: 19, recommend: false, changes: [],
}

beforeEach(() => {
  vi.mocked(api.postReplan).mockReset()
})

describe('ReplanCard', () => {
  it('shows the net saving, switching cost and proposed changes', async () => {
    vi.mocked(api.postReplan).mockResolvedValue(saving)
    render(<ReplanCard shifts={[]} />)
    expect(await screen.findByText(/Re-plan open requests/)).toBeTruthy()
    expect(screen.getByText(/2,470/)).toBeTruthy()
    expect(screen.getByText(/354/)).toBeTruthy()
    expect(screen.getByText('21')).toBeTruthy()
    expect(screen.getAllByText(/Westgate Tower/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/19 ft scissor lift/).length).toBe(2)
    expect(screen.getByText(/Frees the sister-yard unit for Westgate Tower/)).toBeTruthy()
    expect(screen.getByText(/16-request static snapshot/)).toBeTruthy()
    expect(screen.getAllByText('Outside').length).toBe(2)
    expect(screen.getByText(/Suggestion only/)).toBeTruthy()
    expect(api.postReplan).toHaveBeenCalledWith([])
  })

  it('says the plan is already close when there is no net saving', async () => {
    vi.mocked(api.postReplan).mockResolvedValue(noSaving)
    render(<ReplanCard shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} />)
    expect(await screen.findByText(/already within/)).toBeTruthy()
    expect(screen.queryByText(/Re-plan open requests/)).toBeNull()
    expect(api.postReplan).toHaveBeenCalledWith([{ project_id: 'PRJ-KNG', days: 42 }])
  })

  it('re-fetches when the shifts change', async () => {
    vi.mocked(api.postReplan).mockResolvedValueOnce(saving).mockResolvedValueOnce(noSaving)
    const { rerender } = render(<ReplanCard shifts={[]} />)
    await screen.findByText(/Re-plan open requests/)
    rerender(<ReplanCard shifts={[{ project_id: 'PRJ-KNG', days: 42 }]} />)
    expect(await screen.findByText(/already within/)).toBeTruthy()
    expect(api.postReplan).toHaveBeenCalledTimes(2)
  })
})
