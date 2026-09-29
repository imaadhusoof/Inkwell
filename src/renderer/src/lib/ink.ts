import { getStroke, type StrokeOptions } from 'perfect-freehand'
import type { Stroke, StrokePoint } from './types'

export const HIGHLIGHTER_OPACITY = 0.38

function strokeOptions(stroke: Stroke, last: boolean): StrokeOptions {
  if (stroke.tool === 'highlighter') {
    return {
      size: stroke.size,
      thinning: 0,
      smoothing: 0.5,
      streamline: 0.35,
      simulatePressure: false,
      last,
      start: { cap: false },
      end: { cap: false }
    }
  }
  return {
    size: stroke.size,
    thinning: 0.55,
    smoothing: 0.5,
    streamline: stroke.simulatePressure ? 0.45 : 0.3,
    simulatePressure: stroke.simulatePressure,
    last
  }
}

/** Outline polygon for a stroke, in page space. `last` is false while the stroke is still being drawn. */
export function strokeOutline(stroke: Stroke, last = true): number[][] {
  return getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    strokeOptions(stroke, last)
  )
}

/** Turns an outline into a smooth closed path using quadratic curves through the midpoints. */
function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D()
  const n = outline.length
  if (n < 3) return path
  const [x0, y0] = outline[0]
  const [x1, y1] = outline[1]
  path.moveTo((x0 + x1) / 2, (y0 + y1) / 2)
  for (let i = 1; i < n; i++) {
    const [ax, ay] = outline[i]
    const [bx, by] = outline[(i + 1) % n]
    path.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2)
  }
  path.closePath()
  return path
}

// Finished strokes never change, so their paths are computed once and reused on every redraw
const pathCache = new WeakMap<Stroke, Path2D>()

function pathFor(stroke: Stroke): Path2D {
  let path = pathCache.get(stroke)
  if (!path) {
    path = outlineToPath(strokeOutline(stroke))
    pathCache.set(stroke, path)
  }
  return path
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, live = false): void {
  if (stroke.points.length === 0) return
  const path = live ? outlineToPath(strokeOutline(stroke, false)) : pathFor(stroke)
  ctx.globalAlpha = stroke.opacity
  ctx.fillStyle = stroke.color
  ctx.fill(path)
  ctx.globalAlpha = 1
}

/**
 * Sets up a canvas for drawing in page space: sizes its backing store for the current
 * zoom and device pixel ratio, clears it, and applies the matching transform.
 */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  zoom: number,
  dpr: number
): CanvasRenderingContext2D | null {
  const width = Math.floor(pageWidth * zoom * dpr)
  const height = Math.floor(pageHeight * zoom * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0)
  return ctx
}

function distanceToSegment(px: number, py: number, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  let t = lengthSq === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

/** Whether a circle at (x, y) touches the stroke, accounting for its width. */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + stroke.size / 2
  const pts = stroke.points
  if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].y - y) <= reach
  for (let i = 1; i < pts.length; i++) {
    if (distanceToSegment(x, y, pts[i - 1], pts[i]) <= reach) return true
  }
  return false
}
