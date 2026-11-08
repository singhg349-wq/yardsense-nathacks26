import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/RequestScreen', () => ({ default: () => <p>requests</p> }))
vi.mock('./components/Dashboard', () => ({ default: () => <p>dashboard</p> }))
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
  it('orders the tabs Requests, Timeline, Map, Dashboard, Fleet advisor, Data upload', () => {
    render(<App />)
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Requests', 'Timeline', 'Map', 'Dashboard', 'Fleet advisor', 'Data upload'])
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
})
