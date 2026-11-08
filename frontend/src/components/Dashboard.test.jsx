import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import Dashboard from './Dashboard'

vi.mock('../api', () => ({
  postDashboard: vi.fn(), getBacktest: vi.fn(), getMincost: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(api.postDashboard).mockResolvedValue({
    idle_days: 0, utilization_pct: 0, fleet_assets: 0,
    horizon_start: '2026-11-16', horizon_finish: '2027-02-07', idle_by_class: [],
  })
  vi.mocked(api.getBacktest).mockResolvedValue({
    outside_spend_actual: 100, outside_spend_avoided: 50, kept_pct: 50,
    requests: 10, leaks: 2, changed_decisions: 3,
    by_class: [], top_leaks: [], assumptions: ['synthetic'],
  })
  vi.mocked(api.getMincost).mockResolvedValue({
    requests: 16, runtime_ms: 34,
    greedy_static: { group_cost: 126470.48 },
    mincost: { group_cost: 123645.83 },
    delta: { group_cost: 2824.65, pct: 2.2 },
    assumptions: ['static snapshot'],
  })
})

describe('Dashboard comparisons', () => {
  it('shows the synthetic backtest and the static min-cost comparison', async () => {
    render(<Dashboard shifts={[]} accepted={[]} />)
    expect(await screen.findByText('Last year, with YardSense')).toBeTruthy()
    expect(await screen.findByText('Greedy vs min-cost')).toBeTruthy()
    expect(screen.getByText(/Min-cost saves/)).toBeTruthy()
    expect(screen.getByText('$2,825')).toBeTruthy()
    expect(screen.getByText('$123,646')).toBeTruthy()
    expect(screen.getByText(/static comparison/)).toBeTruthy()
  })

  it('marks accepted items changed by a what-if and shows human class names', async () => {
    const entry = { key: 'k', project_name: 'Riverside', item: { qty: 1, class: 'GEN_45KW' },
      option: { option: 'buy', kept_in_group: 900 }, stale: true }
    render(<Dashboard shifts={[]} accepted={[entry]} />)
    expect(await screen.findByText(/1 × 45 kW generator/)).toBeTruthy()
    expect(screen.getByText(/changed by what-if/, { selector: '.accepted-row span' })).toBeTruthy()
    expect(screen.queryByText('GEN_45KW')).toBeNull()
  })
})
