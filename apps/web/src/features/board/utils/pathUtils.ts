export type PointPair = [number, number]

/**
 * Simplifies a list of PointPair coordinates using the Ramer-Douglas-Peucker (RDP) algorithm.
 */
export function simplifyPoints(pts: PointPair[], tolerance: number): PointPair[] {
  if (pts.length <= 2) return pts

  const sqTolerance = tolerance * tolerance
  const keep = new Array<boolean>(pts.length).fill(false)
  keep[0] = true
  keep[pts.length - 1] = true

  simplifyRange(pts, 0, pts.length - 1, sqTolerance, keep)

  return pts.filter((_, idx) => keep[idx])
}

function simplifyRange(
  pts: PointPair[],
  first: number,
  last: number,
  sqTolerance: number,
  keep: boolean[]
) {
  if (last <= first + 1) return

  let maxSqDist = 0
  let index = 0

  const pStart = pts[first]!
  const pEnd = pts[last]!

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(pts[i]!, pStart, pEnd)
    if (sqDist > maxSqDist) {
      index = i
      maxSqDist = sqDist
    }
  }

  if (maxSqDist > sqTolerance) {
    keep[index] = true
    simplifyRange(pts, first, index, sqTolerance, keep)
    simplifyRange(pts, index, last, sqTolerance, keep)
  }
}

function getSqSegDist(p: PointPair, p1: PointPair, p2: PointPair): number {
  let x = p1[0]
  let y = p1[1]
  let dx = p2[0] - x
  let dy = p2[1] - y

  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) {
      x = p2[0]
      y = p2[1]
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = p[0] - x
  dy = p[1] - y

  return dx * dx + dy * dy
}

/**
 * Simplifies a flat array of coordinates [x1, y1, x2, y2, ...] using RDP.
 */
export function simplifyFlatPoints(points: number[], tolerance = 1.5): number[] {
  if (points.length <= 4) return points

  const pairs: PointPair[] = []
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] !== undefined && points[i + 1] !== undefined) {
      pairs.push([points[i]!, points[i + 1]!])
    }
  }

  const simplifiedPairs = simplifyPoints(pairs, tolerance)

  const result: number[] = []
  for (const pair of simplifiedPairs) {
    result.push(pair[0], pair[1])
  }
  return result
}
