import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import FleetAdvisor from './FleetAdvisor'

vi.mock('../api', () => ({ getFleetAdvisor: vi.fn() }))

const advice = {
  as_of: '2026-11-16',
  horizon_months: 12,
  rules: ['Peak demand is measured daily.', 'Add a unit only when its net annual impact is positive.'],
  total_annual_impact: 10050,
  items: [
    { class: 'HEATER_400K', label: '400k BTU heater', owned: 8, supply: 4, on_outside_hire: 4,
      peak_units: 6, pipeline_days: 672, utilization_pct: 46, action: 'add', quantity: 1,
      breakeven_month: 72, annual_impact: 2850, plan_purchases: 0,
      next_unit: { unit: 1, days: 200, net_annual_impact: 2850, breakeven_month: 72 },
      reason: 'Unit 1 covers 200 days and nets $2,850/yr after owning cost.' },
    { class: 'MINI_EX', label: 'Mini excavator', owned: 5, supply: 3, on_outside_hire: 2,
      peak_units: 2, pipeline_days: 150, utilization_pct: 13.7, action: 'retire', quantity: 1,
      breakeven_month: null, annual_impact: 7200, plan_purchases: 0, next_unit: null,
      reason: 'Unit 100050 (Northgate Builders) is idle and the remaining units cover the peak.' },
    { class: 'GEN_45KW', label: '45 kW generator', owned: 5, supply: 0, on_outside_hire: 5,
      peak_units: 3, pipeline_days: 476, utilization_pct: null, action: 'hold', quantity: 0,
      breakeven_month: null, annual_impact: 0, plan_purchases: 3,
      next_unit: { unit: 1, days: 308, net_annual_impact: -3750, breakeven_month: null },
      reason: 'The live plan buys 3 to fill individual requests; one more unit nets -$3,750/yr.' },
  ],
}

beforeEach(() => {
  vi.mocked(api.getFleetAdvisor).mockResolvedValue(advice)
})

describe('FleetAdvisor', () => {
  it('renders add, retire and hold calls with their reasons', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByRole('heading', { name: 'Fleet advisor' })).toBeTruthy()
    expect(await screen.findByText('Add 1')).toBeTruthy()
    expect(screen.getByText('Retire 1')).toBeTruthy()
    expect(screen.getAllByText('Hold').length).toBeGreaterThan(0)
    expect(screen.getByText(/nets \$2,850\/yr after owning cost/)).toBeTruthy()
    expect(screen.getByText(/The live plan buys 3/)).toBeTruthy()
  })

  it('labels money as net of owning cost and shows break-even in months', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByText('72 months')).toBeTruthy()
    expect(screen.getAllByText(/Net annual impact/).length).toBeGreaterThan(1)
    expect(screen.queryByText(/Outside rental avoided/)).toBeNull()
    expect(screen.queryByText(/month 1\b/)).toBeNull()
  })

  it('says a losing unit does not pay back and shows supply net of outside hire', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByText("Doesn't pay back")).toBeTruthy()
    expect(screen.getByText('-$3,750/yr')).toBeTruthy()
    expect(screen.getByText(/5 in group · 0 usable \(5 on outside hire\)/)).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('shows the rules and the synthetic-data note', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByText('How the advisor decides')).toBeTruthy()
    expect(screen.getByText('Peak demand is measured daily.')).toBeTruthy()
    expect(screen.getByText(/Synthetic pipeline data/)).toBeTruthy()
  })
})
