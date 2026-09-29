import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pdfjsLib, type PDFDocumentProxy, type RenderTask } from '../lib/pdfjs'
import { AnnotationStore, usePageStrokes } from '../lib/annotationStore'
import { drawStroke, prepareCanvas, HIGHLIGHTER_OPACITY } from '../lib/ink'
import type { Stroke, StrokePoint, ToolSettings } from '../lib/types'

// Eraser radius in screen pixels, so it feels the same at every zoom level
const ERASER_SCREEN_RADIUS = 11
// Wait for zooming to settle before re-rendering the PDF at the new resolution
const RERENDER_DELAY = 160

interface PageViewProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  width: number
  height: number
  zoom: number
  store: AnnotationStore
  settings: ToolSettings
  /** Effective tool, which may differ from settings.tool while space is held to pan. */
  tool: ToolSettings['tool']
  penDetected: boolean
  onPenDetected: () => void
}

function PageViewImpl({
  pdf,
  pageNumber,
  width,
  height,
  zoom,
  store,
  settings,
  tool,
  penDetected,
  onPenDetected
}: PageViewProps): React.JSX.Element {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const inkCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const eraserRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(false)

  const strokes = usePageStrokes(store, pageNumber)
  const dpr = window.devicePixelRatio || 1

  // ---- PDF layer ---------------------------------------------------------
  const renderTask = useRef<RenderTask | null>(null)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(
      async () => {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const canvas = pdfCanvasRef.current
        if (!canvas) return
        // Render off-screen first so the old image stays up until the sharper one is ready
        const scratch = document.createElement('canvas')
        const viewport = page.getViewport({ scale: zoom * dpr })
        scratch.width = Math.floor(viewport.width)
        scratch.height = Math.floor(viewport.height)
        renderTask.current?.cancel()
        const task = page.render({ canvasContext: scratch.getContext('2d')!, viewport })
        renderTask.current = task
        try {
          await task.promise
        } catch {
          return // cancelled by a newer render
        }
        if (cancelled) return
        canvas.width = scratch.width
        canvas.height = scratch.height
        canvas.getContext('2d')!.drawImage(scratch, 0, 0)
        setRendered(true)
      },
      rendered ? RERENDER_DELAY : 0
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNumber, zoom, dpr])

  useEffect(() => () => renderTask.current?.cancel(), [])

  // ---- Text layer (for selecting and copying text) ------------------------
  useEffect(() => {
    const container = textLayerRef.current
    if (!container) return
    let textLayer: InstanceType<typeof pdfjsLib.TextLayer> | null = null
    let cancelled = false
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return
      // Rendered once at 100%; the --scale-factor CSS variable scales it with the zoom
      textLayer = new pdfjsLib.TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport: page.getViewport({ scale: 1 })
      })
      textLayer.render().catch(() => {})
    })
    return () => {
      cancelled = true
      textLayer?.cancel()
      container.replaceChildren()
    }
  }, [pdf, pageNumber])

  // ---- Ink layer -----------------------------------------------------------
  useLayoutEffect(() => {
    const canvas = inkCanvasRef.current
    if (!canvas) return
    const ctx = prepareCanvas(canvas, width, height, zoom, dpr)
    if (!ctx) return
    for (const s of strokes) drawStroke(ctx, s)
  }, [strokes, width, height, zoom, dpr])

  // ---- Pointer input -------------------------------------------------------
  const active = useRef<{
    pointerId: number
    points: StrokePoint[]
    simulatePressure: boolean
    rect: DOMRect
    erasing: boolean
    straight: boolean
  } | null>(null)
  const frame = useRef(0)

  function toPage(e: PointerEvent, rect: DOMRect): StrokePoint {
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
      pressure: e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5
    }
  }

  function currentStroke(id: string): Stroke | null {
    const a = active.current
    if (!a || (tool !== 'pen' && tool !== 'highlighter')) return null
    const pen = settings[tool]
    const points = a.straight && a.points.length > 1 ? [a.points[0], a.points[a.points.length - 1]] : a.points
    return {
      id,
      tool,
      color: pen.color,
      size: pen.size,
      opacity: tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1,
      points,
      simulatePressure: a.simulatePressure || a.straight
    }
  }

  function drawLive(): void {
    frame.current = 0
    const canvas = liveCanvasRef.current
    const stroke = currentStroke('live')
    if (!canvas || !stroke) return
    const ctx = prepareCanvas(canvas, width, height, zoom, dpr)
    if (ctx) drawStroke(ctx, stroke, true)
  }

  function moveEraserCursor(e: React.PointerEvent): void {
    const cursor = eraserRef.current
    if (!cursor) return
    const rect = e.currentTarget.getBoundingClientRect()
    cursor.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`
    cursor.style.opacity = '1'
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (e.pointerType === 'pen' && !penDetected) onPenDetected()
    // Palm rejection: once a stylus has been used, fingers scroll instead of drawing
    if (e.pointerType === 'touch' && penDetected) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    const point = toPage(e.nativeEvent, rect)
    active.current = {
      pointerId: e.pointerId,
      points: [point],
      simulatePressure: e.pointerType !== 'pen',
      rect,
      erasing: tool === 'eraser',
      straight: e.shiftKey
    }
    if (tool === 'eraser') {
      store.eraseAt(pageNumber, point.x, point.y, ERASER_SCREEN_RADIUS / zoom)
    } else {
      drawLive()
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (tool === 'eraser') moveEraserCursor(e)
    const a = active.current
    if (!a || a.pointerId !== e.pointerId) return
    // Coalesced events carry every sample the pen reported since the last frame
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    const samples = events.length > 0 ? events : [e.nativeEvent]
    if (a.erasing) {
      for (const ev of samples) {
        const p = toPage(ev, a.rect)
        store.eraseAt(pageNumber, p.x, p.y, ERASER_SCREEN_RADIUS / zoom)
      }
      return
    }
    for (const ev of samples) a.points.push(toPage(ev, a.rect))
    a.straight = e.shiftKey
    if (!frame.current) frame.current = requestAnimationFrame(drawLive)
  }

  function finishStroke(e: React.PointerEvent<HTMLCanvasElement>): void {
    const a = active.current
    if (!a || a.pointerId !== e.pointerId) return
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    const stroke = a.erasing ? null : currentStroke(crypto.randomUUID())
    active.current = null
    if (!stroke) return

    // Paint the finished stroke onto the ink layer right away so there's no flicker
    // between clearing the live layer and React redrawing the page
    const ink = inkCanvasRef.current?.getContext('2d')
    if (ink) drawStroke(ink, stroke)
    const live = liveCanvasRef.current
    live?.getContext('2d')?.clearRect(0, 0, live.width, live.height)
    store.addStroke(pageNumber, stroke)
  }

  const drawing = tool === 'pen' || tool === 'highlighter' || tool === 'eraser'
  const scaledWidth = width * zoom
  const scaledHeight = height * zoom

  return (
    <div
      className={`page ${rendered ? 'is-rendered' : ''}`}
      style={
        {
          width: scaledWidth,
          height: scaledHeight,
          '--scale-factor': zoom
        } as React.CSSProperties
      }
      data-tool={tool}
    >
      <canvas ref={pdfCanvasRef} className="page__pdf" />
      <div ref={textLayerRef} className="textLayer" />
      <canvas ref={inkCanvasRef} className="page__ink" />
      <canvas
        ref={liveCanvasRef}
        className="page__input"
        style={{
          pointerEvents: drawing ? 'auto' : 'none',
          touchAction: penDetected ? 'pan-x pan-y pinch-zoom' : 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={() => {
          if (eraserRef.current) eraserRef.current.style.opacity = '0'
        }}
      />
      {tool === 'eraser' && (
        <div
          ref={eraserRef}
          className="page__eraser"
          style={{ width: ERASER_SCREEN_RADIUS * 2, height: ERASER_SCREEN_RADIUS * 2 }}
        />
      )}
    </div>
  )
}

export const PageView = memo(PageViewImpl)
