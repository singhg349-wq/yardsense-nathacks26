import { describe, expect, it } from 'vitest'
import { countSources, optionParts } from './optionParts'

describe('optionParts', () => {
  it('treats a normal choice as one part', () => {
    expect(optionParts({ option: 'move_ours', qty: 2 })).toEqual([{ option: 'move_ours', qty: 2 }])
  })

  it('returns the units of a split choice', () => {
    const units = [{ option: 'move_ours', qty: 1 }, { option: 'buy', qty: 1 }]
    expect(optionParts({ option: 'split', qty: 2, units })).toBe(units)
  })

  it('counts a split once per source it uses', () => {
    expect(countSources([
      { option: 'buy' },
      { option: 'split', units: [{ option: 'move_ours', qty: 1 }, { option: 'buy', qty: 1 }] },
    ])).toEqual({ buy: 2, move_ours: 1 })
  })
})
