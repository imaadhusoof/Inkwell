import { memo, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../lib/pdfjs'
import { AnnotationStore, usePageStrokes } from '../lib/annotationStore'
import { drawStroke, prepareCanvas } from '../lib/ink'
import type { PageSize } from './Viewer'

const THUMB_WIDTH = 132

interface ThumbnailProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  size: PageSize
  store: AnnotationStore
  active: boolean
  onSelect: (page: number) => void
}

const Thumbnail = memo(function Thumbnail({
  pdf,
  pageNumber,
  size,
  store,
  active,
  onSelect
}: ThumbnailProps): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null)
  const pdfCanvas = useRef<HTMLCanvasElement>(null)
  const inkCanvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const strokes = usePageStrokes(store, pageNumber)
  const scale = THUMB_WIDTH / size.width
  const dpr = window.devicePixelRatio || 1

  // Only render thumbnails once they scroll into view
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '300px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    pdf.getPage(pageNumber).then((page) => {
      const canvas = pdfCanvas.current
      if (cancelled || !canvas) return
      const viewport = page.getViewport({ scale: scale * dpr })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise.catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [visible, pdf, pageNumber, scale, dpr])

  useEffect(() => {
    const canvas = inkCanvas.current
    if (!visible || !canvas) return
    const ctx = prepareCanvas(canvas, size.width, size.height, scale, dpr)
    if (ctx) for (const s of strokes) drawStroke(ctx, s)
  }, [visible, strokes, size, scale, dpr])

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <button
      ref={ref}
      className={`thumb ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(pageNumber)}
      title={`Page ${pageNumber}`}
    >
      <div className="thumb__page" style={{ width: THUMB_WIDTH, height: size.height * scale }}>
        <canvas ref={pdfCanvas} />
        <canvas ref={inkCanvas} className="thumb__ink" />
      </div>
      <span className="thumb__label">{pageNumber}</span>
    </button>
  )
})

interface ThumbnailsProps {
  pdf: PDFDocumentProxy
  pageSizes: PageSize[]
  store: AnnotationStore
  currentPage: number
  onSelect: (page: number) => void
}

export function Thumbnails({ pdf, pageSizes, store, currentPage, onSelect }: ThumbnailsProps): React.JSX.Element {
  return (
    <aside className="thumbnails">
      {pageSizes.map((size, i) => (
        <Thumbnail
          key={i}
          pdf={pdf}
          pageNumber={i + 1}
          size={size}
          store={store}
          active={currentPage === i + 1}
          onSelect={onSelect}
        />
      ))}
    </aside>
  )
}
