// Geometry for the curved move arcs. Works in screen pixels, so it knows nothing about Leaflet.

function bezierPoint(from, control, to, t) {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  }
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * A quadratic curve from `from` to `to`, bowed sideways by `bend` × its length.
 * `side` (1 or -1) picks which way it bows, and `trim` pixels are cut from each
 * end so the line stops at the edge of the marker. Returns null for a zero-length move.
 */
export function arcGeometry(from, to, { bend = 0.18, side = 1, trim = 0, steps = 48 } = {}) {
  const length = distance(from, to)
  if (length === 0) return null
  const control = {
    x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * length * bend * side,
    y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * length * bend * side,
  }
  const samples = []
  for (let i = 0; i <= steps; i += 1) samples.push(bezierPoint(from, control, to, i / steps))

  let travelled = 0
  const walked = samples.map((point, i) => {
    if (i > 0) travelled += distance(samples[i - 1], point)
    return { point, at: travelled }
  })
  // Markers closer together than both trims: keep the whole curve so an arc still shows.
  const kept = travelled > trim * 2 + 1
    ? walked.filter(({ at }) => at >= trim && at <= travelled - trim)
    : walked
  const points = kept.map(({ point }) => point)
  const last = points[points.length - 1]
  const previous = points[points.length - 2]
  return {
    points,
    mid: bezierPoint(from, control, to, 0.5),
    end: last,
    angle: (Math.atan2(last.y - previous.y, last.x - previous.x) * 180) / Math.PI,
  }
}
