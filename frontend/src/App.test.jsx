import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/RequestScreen', () => ({
  default: ({ onAccept }) => <button type="button" onClick={() => onAccept({
    project_id: 'PRJ-RIV', request: { class: 'TELEHANDLER', qty: 1,
      start: '2026-11-23', finish: '2027-01-31' }, option: { kept_in_group: 100 },
  })}>accept demo request</button>,
}))
vi.mock('./components/Dashboard', () => ({
  default: ({ accepted }) => <p>dashboard accepted={accepted.length}</p>,
}))
vi.mock('./components/FleetAdvisor', () => ({ default: () => <p>fleet advisor</p> }))
vi.mock('./components/DataUpload', () => ({ default: () => <p>data upload</p> }))
vi.mock('./components/PlannerView', () => ({
  default: ({ onSetShift }) => <button type="button" onClick={() => onSetShift('PRJ-KNG', 42)}>slip</button>,
}))
vi.mock('./components/MapView', () => ({
  default: ({ shifts, active }) => <p>map active={String(active)} shifts={JSON.stringify(shifts)}</p>,
}))

const tabs = () => screen.getAllByRole('button').filter((button) => button.closest('nav'))

describe('App navigation', () => {
  it('orders the tabs Dashboard, Requests, Timeline, Map, Fleet advisor, Data upload', () => {
    render(<App />)
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Dashboard', 'Requests', 'Timeline', 'Map', 'Fleet advisor', 'Data upload'])
  })

  it('opens on the Dashboard', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Dashboard' }).className).toBe('active')
  })

  it('tells the map when its tab is open', () => {
    render(<App />)
    expect(screen.getByText(/^map active=false/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(screen.getByText(/^map active=true/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Map' }).className).toBe('active')
  })

  it('passes Timeline drags to the map', () => {
    render(<App />)
    fireEvent.click(screen.getByText('slip'))
    expect(screen.getByText(/^map /).textContent).toContain('{"project_id":"PRJ-KNG","days":42}')
  })

  it('drops accepted savings when a timeline edit changes the plan', () => {
    render(<App />)
    fireEvent.click(screen.getByText('accept demo request'))
    expect(screen.getByText('dashboard accepted=1')).toBeTruthy()
    fireEvent.click(screen.getByText('slip'))
    expect(screen.getByText('dashboard accepted=0')).toBeTruthy()
  })
})
