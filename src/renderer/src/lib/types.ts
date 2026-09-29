export type InkTool = 'pen' | 'highlighter'
export type ToolId = 'select' | 'hand' | InkTool | 'eraser'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

/** A freehand stroke, stored in PDF page space (points at 100% zoom) so it's zoom-independent. */
export interface Stroke {
  id: string
  tool: InkTool
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

export interface PenSettings {
  color: string
  size: number
}

export interface ToolSettings {
  tool: ToolId
  pen: PenSettings
  highlighter: PenSettings
}
