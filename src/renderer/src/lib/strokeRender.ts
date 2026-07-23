import { getStroke } from 'perfect-freehand'
import type { Stroke } from './types'

function toFreehandInput(stroke: Stroke): number[][] {
  return stroke.points.map((p) => [p.x, p.y, p.pressure])
}

function strokeOptions(stroke: Stroke): Parameters<typeof getStroke>[1] {
  if (stroke.tool === 'highlighter') {
    return {
      size: stroke.size,
      thinning: 0,
      smoothing: 0.4,
      streamline: 0.4,
      simulatePressure: false
    }
  }
  return {
    size: stroke.size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: stroke.simulatePressure
  }
}

/** Draws a single stroke onto a 2D canvas context using perfect-freehand's outline. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.points.length === 0) return

  const outline = getStroke(toFreehandInput(stroke), strokeOptions(stroke))
  if (outline.length === 0) return

  ctx.save()
  ctx.globalAlpha = stroke.opacity
  ctx.fillStyle = stroke.color
  ctx.beginPath()
  ctx.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    ctx.lineTo(outline[i][0], outline[i][1])
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function redrawStrokes(canvas: HTMLCanvasElement, strokes: Stroke[]): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const stroke of strokes) {
    drawStroke(ctx, stroke)
  }
}

/** Distance from point to nearest point of the stroke, for eraser hit-testing. */
export function distanceToStroke(x: number, y: number, stroke: Stroke): number {
  let min = Infinity
  for (const p of stroke.points) {
    const d = Math.hypot(p.x - x, p.y - y)
    if (d < min) min = d
  }
  return min
}
