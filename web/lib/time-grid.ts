// Shared geometry for vertical 24-hour grids (calendar week view, day planner).

export const MINUTES_PER_DAY = 24 * 60

export function snapMinutes(min: number, step = 15): number {
  return Math.round(min / step) * step
}

export function floorMinutes(min: number, step = 15): number {
  return Math.floor(min / step) * step
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export interface Span {
  startMin: number
  endMin: number
}

export type Laid<T> = T & { lane: number; totalLanes: number }

/** Places overlapping spans side by side: each cluster of overlaps shares its lane count. */
export function layoutLanes<T extends Span>(events: T[]): Laid<T>[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: Laid<T>[] = []
  let cluster: Laid<T>[] = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const lanes: number[] = []
    for (const ev of cluster) {
      let laneIdx = lanes.findIndex(endMin => endMin <= ev.startMin)
      if (laneIdx === -1) {
        laneIdx = lanes.length
        lanes.push(ev.endMin)
      } else {
        lanes[laneIdx] = ev.endMin
      }
      ev.lane = laneIdx
    }
    cluster.forEach(ev => (ev.totalLanes = lanes.length))
    result.push(...cluster)
    cluster = []
    clusterEnd = -1
  }

  for (const ev of sorted) {
    const laneEv: Laid<T> = { ...ev, lane: 0, totalLanes: 1 }
    if (cluster.length === 0 || laneEv.startMin < clusterEnd) {
      cluster.push(laneEv)
      clusterEnd = Math.max(clusterEnd, laneEv.endMin)
    } else {
      flush()
      cluster.push(laneEv)
      clusterEnd = laneEv.endMin
    }
  }
  flush()
  return result
}
