import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_URL, getAssignments, getAvailableAssets, getSites } from './api'

function stubFetch(body = []) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('map API helpers', () => {
  it('fetches sites and assignments', async () => {
    const fetchMock = stubFetch([{ id: 'Y-NB' }])
    await expect(getSites()).resolves.toEqual([{ id: 'Y-NB' }])
    await getAssignments()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${API_URL}/sites`, `${API_URL}/assignments`])
  })

  it('sends the idle date range as from and to', async () => {
    const fetchMock = stubFetch()
    await getAvailableAssets('2026-11-16', '2026-11-23')
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/assets/available?from=2026-11-16&to=2026-11-23`)
  })
})
