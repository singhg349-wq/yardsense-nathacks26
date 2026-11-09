import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import RequestScreen from './RequestScreen'
import { acceptKey } from '../acceptKey'

vi.mock('../api', () => ({ getProjects: vi.fn(), getClasses: vi.fn(), recommend: vi.fn() }))

const projects = [{ id: 'PRJ-RIV', name: 'Riverside Clinic' }]
const classes = [
  { code: 'SCISSOR_19', label: '19 ft scissor lift' },
  { code: 'TELEHANDLER', label: 'Telehandler' },
  { code: 'GEN_45KW', label: '45 kW generator' },
]
const recommendation = {
  project_id: 'PRJ-RIV',
  items: [{
    class: 'SCISSOR_19', qty: 2,
    options: [{
      option: 'rent_sister', available: true, project_cost: 120, group_cost: 50,
      kept_in_group: 70, reason: '2 x 19 ft scissor lift idle at Northgate Rentals.',
      breakdown: [{ label: 'Internal rental', amount: 80 }, { label: 'Transport', amount: 20 }],
      group_breakdown: [{ label: 'Group transport', amount: 20 }, { label: 'Group wear', amount: 30 }],
    }],
  }],
}

beforeEach(() => {
  vi.mocked(api.getProjects).mockResolvedValue(projects)
  vi.mocked(api.getClasses).mockResolvedValue(classes)
  vi.mocked(api.recommend).mockResolvedValue(recommendation)
})

const splitRecommendation = {
  project_id: 'PRJ-WMD',
  items: [{
    class: 'TELEHANDLER', qty: 2,
    options: [{
      option: 'split', available: true, project_cost: 76116, group_cost: 19264, kept_in_group: 67576,
      reason: 'Split 1 x move ours + 1 x buy: only 1 of 2 Telehandler idle in the group.',
      breakdown: [{ label: '1 x move ours: transport', amount: 224 }],
      units: [
        { option: 'move_ours', qty: 1, group_cost: 8544 },
        { option: 'buy', qty: 1, group_cost: 10720 },
      ],
    }, {
      option: 'rent_outside', available: true, project_cost: 86840, group_cost: 86840, kept_in_group: 0,
      reason: 'Outside rental for 208 days, delivery included.', breakdown: [],
    }],
  }],
}

describe('RequestScreen', () => {
  it('shows a split need as one pill per source', async () => {
    vi.mocked(api.recommend).mockResolvedValue(splitRecommendation)
    render(<RequestScreen />)
    expect(await screen.findByLabelText('Split')).toBeTruthy()
    expect(screen.getAllByText('1 × Move ours').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 × Buy').length).toBeGreaterThan(0)
    expect(screen.getByText(/only 1 of 2 Telehandler idle/)).toBeTruthy()
  })

  it('shows the why-this cost breakdown for an available option', async () => {
    render(<RequestScreen />)
    expect((await screen.findAllByText('Why this?')).length).toBeGreaterThan(0)
    expect(screen.getByText('Internal rental')).toBeTruthy()
    expect(screen.getByText('$80')).toBeTruthy()
    expect(screen.getByText(/Group cost is what leaves Northgate Group/)).toBeTruthy()
  })

  it('shows both project-side and group-side lines in Why this?', async () => {
    render(<RequestScreen />)
    await screen.findAllByText('Why this?')
    expect(screen.getByText(/Project pays/)).toBeTruthy()
    expect(screen.getByText(/Group pays/)).toBeTruthy()
    expect(screen.getByText('Group wear')).toBeTruthy()
    expect(screen.getByText('$30')).toBeTruthy()
  })

  it('raises the accepted KPI as recommendations are accepted', async () => {
    function Host() {
      const [accepted, setAccepted] = useState([])
      return <RequestScreen accepted={accepted} onAccept={(entry) => setAccepted([
        { ...entry, key: acceptKey(entry.project_id, entry.request) }])} />
    }
    render(<Host />)
    expect((await screen.findByText(/Accepted:/)).textContent).toMatch(/\$0 kept.*0 of 1/)
    expect(screen.getByText('Recommended')).toBeTruthy()
    fireEvent.click(screen.getByText('Accept recommendation'))
    expect(screen.getByText(/Accepted:/).textContent).toMatch(/\$70 kept.*1 of 1/)
  })
})
