import { describe, expect, it } from 'vitest'
import { arcGeometry } from './mapGeometry'

const from = { x: 0, y: 0 }
const to = { x: 100, y: 0 }

describe('arcGeometry', () => {
  it('starts and ends on the two points when nothing is trimmed', () => {
    const { points } = arcGeometry(from, to)
    expect(points[0]).toEqual(from)
    expect(points.at(-1)).toEqual(to)
  })

  it('bows to the side it is told to', () => {
    expect(arcGeometry(from, to, { side: 1 }).mid.y).toBeCloseTo(9)
    expect(arcGeometry(from, to, { side: -1 }).mid.y).toBeCloseTo(-9)
    expect(arcGeometry(from, to, { side: 1 }).mid.x).toBeCloseTo(50)
  })

  it('stops short of both markers when trimmed', () => {
    const { points, end } = arcGeometry(from, to, { trim: 20 })
    expect(points[0].x).toBeGreaterThan(15)
    expect(end.x).toBeLessThan(85)
    expect(end).toEqual(points.at(-1))
  })

  it('keeps the whole curve when the markers are too close to trim', () => {
    const { points } = arcGeometry(from, { x: 10, y: 0 }, { trim: 20 })
    expect(points[0]).toEqual(from)
    expect(points.at(-1)).toEqual({ x: 10, y: 0 })
  })

  it('points the arrowhead along the end of the curve', () => {
    // Bowing downward (+y) means the curve arrives travelling up and to the right.
    const { angle } = arcGeometry(from, to, { side: 1 })
    expect(angle).toBeLessThan(0)
    expect(angle).toBeGreaterThan(-45)
  })

  it('returns null for a zero-length move', () => {
    expect(arcGeometry(from, { x: 0, y: 0 })).toBeNull()
  })
})
