import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import DataUpload from './DataUpload'

vi.mock('../api', () => ({ API_URL: 'http://test', getSources: vi.fn(), uploadCsv: vi.fn() }))

const provenance = {
  synthetic_demo: true,
  sources: [{
    id: 'sap', name: 'SAP asset register', system: 'SAP ERP',
    shape: 'Asset master CSV', mode: 'mocked', confidence: 'synthetic',
    citation: null, notes: 'Seeded from synthetic data.',
  }],
  rates: [{
    class: 'SCISSOR_19', label: '19 ft scissor lift', field: '4-week outside rate',
    value: 900, basis: 'sourced', confidence: 'medium',
    citation: 'DOZR Calgary', source_url: 'https://example.com/dozr',
  }],
  assumptions: ['The demo is synthetic.'],
}

beforeEach(() => {
  vi.mocked(api.getSources).mockResolvedValue(provenance)
})

describe('DataUpload provenance', () => {
  it('shows sources, confidence and citations', async () => {
    render(<DataUpload />)
    expect(await screen.findByText('Where these numbers come from')).toBeTruthy()
    expect(screen.getAllByText('SAP asset register').length).toBeGreaterThan(0)
    expect(screen.getByText('$900')).toBeTruthy()
    expect(screen.getByText('medium')).toBeTruthy()
    expect(screen.getByText('DOZR Calgary')).toBeTruthy()
    expect(screen.getByText('Synthetic demo data')).toBeTruthy()
    expect(screen.getByText('The demo is synthetic.')).toBeTruthy()
  })

  it('loads the slipped schedule sample in one click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, blob: async () => new Blob(['project_id,project_name'], { type: 'text/csv' }),
    }))
    vi.mocked(api.uploadCsv).mockResolvedValue({ imported: 5 })
    const onUploaded = vi.fn()
    render(<DataUpload onUploaded={onUploaded} />)
    fireEvent.click(await screen.findByRole('button', { name: /Load slipped schedule demo/i }))
    await waitFor(() => expect(api.uploadCsv).toHaveBeenCalledWith('procore', expect.any(File)))
    expect(onUploaded).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
