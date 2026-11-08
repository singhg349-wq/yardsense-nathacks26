import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import FleetAdvisor from './FleetAdvisor'

vi.mock('../api', () => ({ getFleetAdvisor: vi.fn() }))

const advice = {
  as_of: '2026-11-16',
  horizon_months: 12,
  rules: ['Peak demand is measured daily.', 'Add when peak demand exceeds the fleet.'],
  items: [
    { class: 'BOOM_60', label: '60 ft boom lift', owned: 3, peak_units: 5, pipeline_days: 866,
      unmet_unit_days: 160, utilization_pct: 79.1, action: 'add', quantity: 2,
      breakeven_month: 1, annual_impact: 20571,
      reason: 'Peak demand 5 units against 3 owned; a purchase breaks even in month 1.' },
    { class: 'MINI_EX', label: 'Mini excavator', owned: 3, peak_units: 2, pipeline_days: 150,
      unmet_unit_days: 0, utilization_pct: 13.7, action: 'retire', quantity: 1,
      breakeven_month: null, annual_impact: 7200,
      reason: 'Peak demand 2 units against 3 owned; utilization is 13.7%.' },
    { class: 'GEN_45KW', label: '45 kW generator', owned: 5, peak_units: 3, pipeline_days: 476,
      unmet_unit_days: 0, utilization_pct: 26.1, action: 'hold', quantity: 0,
      breakeven_month: null, annual_impact: 0,
      reason: 'Peak demand 3 units against 5 owned; utilization is 26.1%.' },
  ],
}

beforeEach(() => {
  vi.mocked(api.getFleetAdvisor).mockResolvedValue(advice)
})

describe('FleetAdvisor', () => {
  it('renders add, retire and hold calls with their reasons', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByRole('heading', { name: 'Fleet advisor' })).toBeTruthy()
    expect(await screen.findByText('Add 2')).toBeTruthy()
    expect(screen.getByText('Retire 1')).toBeTruthy()
    expect(screen.getAllByText('Hold').length).toBeGreaterThan(0)
    expect(screen.getByText(/a purchase breaks even in month 1/i)).toBeTruthy()
    expect(screen.getByText(/Outside rental avoided/i)).toBeTruthy()
    expect(screen.getByText(/Carrying cost saved/i)).toBeTruthy()
  })

  it('shows the rules and the synthetic-data note', async () => {
    render(<FleetAdvisor />)
    expect(await screen.findByText('How the advisor decides')).toBeTruthy()
    expect(screen.getByText('Peak demand is measured daily.')).toBeTruthy()
    expect(screen.getByText(/Synthetic pipeline data/)).toBeTruthy()
  })
})
