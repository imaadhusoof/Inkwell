import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import type { AnnotationStore } from '../lib/annotationStore'
import type { ToolSettings } from '../lib/types'
import { PageView } from './PageView'
import { FitWidthIcon, MinusIcon, PlusIcon } from './Icons'

const PAD_X = 48
const PAD_TOP = 76 // leaves room for the floating tool dock
const PAD_BOTTOM = 64
const GAP = 20
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 5
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]

export interface PageSize {
  width: number
  height: number
}

export interface ViewerHandle {
  goToPage: (page: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fitWidth: () => void
}

interface ViewerProps {
  pdf: PDFDocumentProxy
  pageSizes: PageSize[]
  store: AnnotationStore
  settings: ToolSettings
  initialPage: number
  initialZoom: number | null
  onViewChange: (page: number, zoom: number) => void
}

const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer(
  { pdf, pageSizes, store, settings, initialPage, initialZoom, onViewChange },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(initialZoom ?? 1)
  const [viewport, setViewport] = useState({ top: 0, height: 800, width: 1000 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [penDetected, setPenDetected] = useState(false)
  const [panning, setPanning] = useState(false)
  // Content point to keep under the cursor while zooming
  const zoomAnchor = useRef<{ page: number; px: number; py: number; ax: number; ay: number } | null>(null)

  const maxWidth = useMemo(() => Math.max(...pageSizes.map((p) => p.width)), [pageSizes])

  // Page top offsets at the current zoom
  const layout = useMemo(() => {
    const tops: number[] = []
    let y = PAD_TOP
    for (const p of pageSizes) {
      tops.push(y)
      y += p.height * zoom + GAP
    }
    return { tops, height: y - GAP + PAD_BOTTOM }
  }, [pageSizes, zoom])

  const contentWidth = Math.max(viewport.width, maxWidth * zoom + PAD_X * 2)

  const pageAt = useCallback(
    (y: number): number => {
      const { tops } = layout
      let lo = 0
      let hi = tops.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (tops[mid] <= y) lo = mid
        else hi = mid - 1
      }
      return lo
    },
    [layout]
  )

  const fitWidthZoom = useCallback((): number => {
    const width = scrollRef.current?.clientWidth ?? viewport.width
    return clampZoom((width - PAD_X * 2) / maxWidth)
  }, [maxWidth, viewport.width])

  // ---- Zooming, anchored so the point under the cursor stays put -------------
  // Latest requested zoom, which can run ahead of the rendered one when wheel events arrive
  // faster than React re-renders (e.g. trackpad pinch)
  const targetZoom = useRef(zoom)
  // While true, the page is refitted whenever the viewer changes width (window resize, panels)
  const fitMode = useRef(initialZoom == null)
  // The automatic fit on open is capped so pages don't get huge on big screens
  const fitCap = useRef(1.6)
  const zoomTo = useCallback(
    (next: number, anchorX?: number, anchorY?: number, keepFit = false) => {
      if (!keepFit) fitMode.current = false
      const el = scrollRef.current
      if (!el) return
      next = clampZoom(next)
      if (next === targetZoom.current) return
      // Keep the first anchor until it's applied; it matches what's currently on screen
      if (!zoomAnchor.current) {
        const ax = anchorX ?? el.clientWidth / 2
        const ay = anchorY ?? el.clientHeight / 2
        const contentY = el.scrollTop + ay
        const page = pageAt(contentY)
        zoomAnchor.current = {
          page,
          px: (el.scrollLeft + ax - contentWidth / 2) / zoom,
          py: (contentY - layout.tops[page]) / zoom,
          ax,
          ay
        }
      }
      targetZoom.current = next
      setZoom(next)
    },
    [zoom, pageAt, contentWidth, layout]
  )

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current
    const el = scrollRef.current
    if (!anchor || !el) return
    zoomAnchor.current = null
    el.scrollTop = layout.tops[anchor.page] + anchor.py * zoom - anchor.ay
    el.scrollLeft = contentWidth / 2 + anchor.px * zoom - anchor.ax
  }, [zoom, layout, contentWidth])

  // First layout: fit to width unless there's a saved zoom, then jump to the saved page
  const [ready, setReady] = useState(initialZoom != null)
  useLayoutEffect(() => {
    if (ready) return
    targetZoom.current = Math.min(fitWidthZoom(), 1.6)
    setZoom(targetZoom.current)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pendingPage = useRef(initialPage)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!ready || !el || !pendingPage.current) return
    if (pendingPage.current > 1) el.scrollTop = layout.tops[pendingPage.current - 1] - PAD_TOP / 2
    pendingPage.current = 0
  }, [ready, layout])

  useImperativeHandle(
    ref,
    () => ({
      goToPage: (page) => {
        const el = scrollRef.current
        const top = layout.tops[page - 1]
        if (el && top !== undefined) el.scrollTo({ top: top - 16, behavior: 'smooth' })
      },
      zoomIn: () => zoomTo(ZOOM_STEPS.find((s) => s > zoom + 0.001) ?? MAX_ZOOM),
      zoomOut: () => zoomTo([...ZOOM_STEPS].reverse().find((s) => s < zoom - 0.001) ?? MIN_ZOOM),
      fitWidth: () => {
        zoomTo(fitWidthZoom(), undefined, 0, true)
        fitMode.current = true
        fitCap.current = MAX_ZOOM
      }
    }),
    [layout, zoom, zoomTo, fitWidthZoom]
  )

  // Ctrl + wheel (and trackpad pinch, which Chromium reports the same way) zooms
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomTo(targetZoom.current * Math.exp(-e.deltaY * 0.0022), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomTo])

  // ---- Scroll tracking: which pages to mount and which one is "current" ----------
  const syncViewport = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setViewport((prev) =>
      prev.top === el.scrollTop && prev.height === el.clientHeight && prev.width === el.clientWidth
        ? prev
        : { top: el.scrollTop, height: el.clientHeight, width: el.clientWidth }
    )
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let frame = 0
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), syncViewport()))
    }
    const observer = new ResizeObserver(syncViewport)
    observer.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    syncViewport()
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [syncViewport])

  useEffect(() => {
    if (ready && fitMode.current) zoomTo(Math.min(fitWidthZoom(), fitCap.current), undefined, 0, true)
    // Only react to width changes, not to zoom changes made elsewhere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, ready])

  const currentPage = pageAt(viewport.top + viewport.height * 0.4) + 1
  useEffect(() => {
    onViewChange(currentPage, zoom)
  }, [currentPage, zoom, onViewChange])

  // Mount pages within a screen's height either side of the visible area
  const first = pageAt(viewport.top - viewport.height)
  const last = pageAt(viewport.top + viewport.height * 2)

  // ---- Panning: hand tool, space + drag, or middle mouse ---------------------
  useEffect(() => {
    const isTyping = (t: EventTarget | null): boolean =>
      t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', () => setSpaceHeld(false))
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const tool = spaceHeld ? 'hand' : settings.tool
  const handlePenDetected = useCallback(() => setPenDetected(true), [])
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    const middle = e.button === 1
    if (!middle && tool !== 'hand') return
    const el = scrollRef.current!
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    setPanning(true)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const d = drag.current
    if (!d) return
    const el = scrollRef.current!
    el.scrollLeft = d.left - (e.clientX - d.x)
    el.scrollTop = d.top - (e.clientY - d.y)
  }
  function onPointerUp(): void {
    drag.current = null
    setPanning(false)
  }

  return (
    <div className="viewer">
      <div
        ref={scrollRef}
        className={`viewer__scroll tool-${tool} ${panning ? 'is-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="viewer__content" style={{ width: contentWidth, height: layout.height }}>
          {pageSizes.map((size, i) => {
            const mounted = ready && i >= first && i <= last
            return (
              <div
                key={i}
                className="viewer__slot"
                style={{
                  top: layout.tops[i],
                  width: size.width * zoom,
                  height: size.height * zoom,
                  marginLeft: -(size.width * zoom) / 2
                }}
              >
                {mounted ? (
                  <PageView
                    pdf={pdf}
                    pageNumber={i + 1}
                    width={size.width}
                    height={size.height}
                    zoom={zoom}
                    store={store}
                    settings={settings}
                    tool={tool}
                    penDetected={penDetected}
                    onPenDetected={handlePenDetected}
                  />
                ) : (
                  <div className="page page--placeholder" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="viewer__status floating">
        <span className="viewer__page">
          {currentPage} <span className="muted">/ {pageSizes.length}</span>
        </span>
        <span className="divider" />
        <button className="icon-btn" onClick={() => zoomTo([...ZOOM_STEPS].reverse().find((s) => s < zoom - 0.001) ?? MIN_ZOOM)} title="Zoom out (Ctrl -)">
          <MinusIcon size={16} />
        </button>
        <button className="viewer__zoom" onClick={() => zoomTo(1)} title="Actual size">
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" onClick={() => zoomTo(ZOOM_STEPS.find((s) => s > zoom + 0.001) ?? MAX_ZOOM)} title="Zoom in (Ctrl +)">
          <PlusIcon size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            zoomTo(fitWidthZoom(), undefined, 0, true)
            fitMode.current = true
            fitCap.current = MAX_ZOOM
          }}
          title="Fit width (Ctrl 0)"
        >
          <FitWidthIcon size={16} />
        </button>
      </div>
    </div>
  )
})
