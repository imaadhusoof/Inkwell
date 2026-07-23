import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { useAnnotations } from '../lib/AnnotationContext'
import { drawStroke } from '../lib/strokeRender'
import type { Stroke, StrokePoint, ToolId } from '../lib/types'

const ERASER_RADIUS = 12

interface ToolSettings {
  tool: ToolId
  color: string
  size: number
  opacity: number
}

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy
  pageNumber: number
  scale: number
  toolSettings: ToolSettings
}

export function PdfPage({ pdfDoc, pageNumber, scale, toolSettings }: PdfPageProps): React.JSX.Element {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const drawing = useRef<StrokePoint[] | null>(null)
  const drawingSimulatePressure = useRef(false)
  const erasing = useRef(false)

  const { getPageStrokes, addStroke, eraseAt } = useAnnotations()
  const strokes = getPageStrokes(pageNumber)

  useEffect(() => {
    let cancelled = false
    pdfDoc.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      setSize({ width: viewport.width, height: viewport.height })
      const canvas = pdfCanvasRef.current
      if (!canvas) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvasContext: ctx, viewport }).promise
    })
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pageNumber, scale])

  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas || size.width === 0) return
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(scale, scale)
    for (const s of strokes) drawStroke(ctx, s)
    ctx.restore()
  }, [strokes, size, scale])

  function toPageSpace(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = toPageSpace(e)
    if (toolSettings.tool === 'eraser') {
      erasing.current = true
      eraseAt(pageNumber, x, y, ERASER_RADIUS)
      return
    }
    drawingSimulatePressure.current = e.pointerType !== 'pen'
    drawing.current = [{ x, y, pressure: e.pressure ?? 0.5 }]
    console.log('[inkwell] pointerdown', { pointerType: e.pointerType, pressure: e.pressure })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    const { x, y } = toPageSpace(e)
    if (erasing.current) {
      eraseAt(pageNumber, x, y, ERASER_RADIUS)
      return
    }
    if (!drawing.current) return
    drawing.current.push({ x, y, pressure: e.pressure ?? 0.5 })

    const canvas = overlayCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale)
    for (const s of strokes) drawStroke(ctx, s)
    const live: Stroke = {
      id: 'live',
      tool: toolSettings.tool === 'highlighter' ? 'highlighter' : 'pen',
      color: toolSettings.color,
      size: toolSettings.size,
      opacity: toolSettings.opacity,
      points: drawing.current,
      simulatePressure: drawingSimulatePressure.current
    }
    drawStroke(ctx, live)
    ctx.restore()
  }

  function handlePointerUp(): void {
    if (erasing.current) {
      erasing.current = false
      return
    }
    const points = drawing.current
    drawing.current = null
    if (!points || points.length < 2) return
    const pressures = points.map((p) => p.pressure)
    console.log('[inkwell] stroke pressure range', {
      min: Math.min(...pressures),
      max: Math.max(...pressures),
      simulatePressure: drawingSimulatePressure.current
    })
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      tool: toolSettings.tool === 'highlighter' ? 'highlighter' : 'pen',
      color: toolSettings.color,
      size: toolSettings.size,
      opacity: toolSettings.opacity,
      points,
      simulatePressure: drawingSimulatePressure.current
    }
    addStroke(pageNumber, stroke)
  }

  return (
    <div className="pdf-page" style={{ width: size.width, height: size.height }}>
      <canvas ref={pdfCanvasRef} className="pdf-page__base" />
      <canvas
        ref={overlayCanvasRef}
        className="pdf-page__overlay"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
}
