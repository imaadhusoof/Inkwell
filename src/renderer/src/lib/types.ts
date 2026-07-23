export type ToolId = 'pen' | 'highlighter' | 'eraser'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface Stroke {
  id: string
  tool: 'pen' | 'highlighter'
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
  /** True when points came from a mouse (or any input without real pressure), so width should be simulated from speed instead of trusting a flat pressure value. */
  simulatePressure: boolean
}

export interface PageAnnotations {
  strokes: Stroke[]
}

export interface DocumentAnnotations {
  pages: Record<number, PageAnnotations>
}

export function emptyDocumentAnnotations(): DocumentAnnotations {
  return { pages: {} }
}
