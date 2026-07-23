import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { DocumentAnnotations, PageAnnotations, Stroke } from './types'
import { emptyDocumentAnnotations } from './types'
import { distanceToStroke } from './strokeRender'

type Action =
  | { type: 'add'; pageNumber: number; stroke: Stroke }
  | { type: 'remove'; pageNumber: number; strokes: Stroke[] }

interface AnnotationContextValue {
  getPageStrokes: (pageNumber: number) => Stroke[]
  addStroke: (pageNumber: number, stroke: Stroke) => void
  eraseAt: (pageNumber: number, x: number, y: number, radius: number) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null)

export function AnnotationProvider({
  pdfPath,
  children
}: {
  pdfPath: string | null
  children: ReactNode
}): React.JSX.Element {
  const [doc, setDoc] = useState<DocumentAnnotations>(emptyDocumentAnnotations())
  const undoStack = useRef<Action[]>([])
  const redoStack = useRef<Action[]>([])
  const [, bump] = useState(0)
  const forceRender = useCallback(() => bump((n) => n + 1), [])
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    undoStack.current = []
    redoStack.current = []
    if (!pdfPath) {
      setDoc(emptyDocumentAnnotations())
      return
    }
    let cancelled = false
    window.inkwell.loadAnnotations(pdfPath).then((data) => {
      if (cancelled) return
      setDoc((data as DocumentAnnotations) ?? emptyDocumentAnnotations())
      forceRender()
    })
    return () => {
      cancelled = true
    }
  }, [pdfPath, forceRender])

  const persist = useCallback(
    (next: DocumentAnnotations) => {
      if (!pdfPath) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        window.inkwell.saveAnnotations(pdfPath, next)
      }, 400)
    },
    [pdfPath]
  )

  const applyUpdate = useCallback(
    (updater: (prev: DocumentAnnotations) => DocumentAnnotations) => {
      setDoc((prev) => {
        const next = updater(prev)
        if (next !== prev) persist(next)
        return next
      })
    },
    [persist]
  )

  const addStroke = useCallback(
    (pageNumber: number, stroke: Stroke) => {
      undoStack.current.push({ type: 'add', pageNumber, stroke })
      redoStack.current = []
      applyUpdate((prev) => {
        const page: PageAnnotations = prev.pages[pageNumber] ?? { strokes: [] }
        return {
          pages: { ...prev.pages, [pageNumber]: { strokes: [...page.strokes, stroke] } }
        }
      })
      forceRender()
    },
    [applyUpdate, forceRender]
  )

  const eraseAt = useCallback(
    (pageNumber: number, x: number, y: number, radius: number) => {
      const removed: Stroke[] = []
      applyUpdate((prev) => {
        const page = prev.pages[pageNumber]
        if (!page || page.strokes.length === 0) return prev
        const keep: Stroke[] = []
        for (const s of page.strokes) {
          if (distanceToStroke(x, y, s) <= radius) {
            removed.push(s)
          } else {
            keep.push(s)
          }
        }
        if (removed.length === 0) return prev
        return { pages: { ...prev.pages, [pageNumber]: { strokes: keep } } }
      })
      if (removed.length > 0) {
        undoStack.current.push({ type: 'remove', pageNumber, strokes: removed })
        redoStack.current = []
        forceRender()
      }
    },
    [applyUpdate, forceRender]
  )

  const undo = useCallback(() => {
    const action = undoStack.current.pop()
    if (!action) return
    redoStack.current.push(action)
    applyUpdate((prev) => {
      const page = prev.pages[action.pageNumber] ?? { strokes: [] }
      if (action.type === 'add') {
        return {
          pages: {
            ...prev.pages,
            [action.pageNumber]: { strokes: page.strokes.filter((s) => s.id !== action.stroke.id) }
          }
        }
      }
      return {
        pages: {
          ...prev.pages,
          [action.pageNumber]: { strokes: [...page.strokes, ...action.strokes] }
        }
      }
    })
    forceRender()
  }, [applyUpdate, forceRender])

  const redo = useCallback(() => {
    const action = redoStack.current.pop()
    if (!action) return
    undoStack.current.push(action)
    applyUpdate((prev) => {
      const page = prev.pages[action.pageNumber] ?? { strokes: [] }
      if (action.type === 'add') {
        return {
          pages: { ...prev.pages, [action.pageNumber]: { strokes: [...page.strokes, action.stroke] } }
        }
      }
      const removeIds = new Set(action.strokes.map((s) => s.id))
      return {
        pages: {
          ...prev.pages,
          [action.pageNumber]: { strokes: page.strokes.filter((s) => !removeIds.has(s.id)) }
        }
      }
    })
    forceRender()
  }, [applyUpdate, forceRender])

  const getPageStrokes = useCallback(
    (pageNumber: number) => doc.pages[pageNumber]?.strokes ?? [],
    [doc]
  )

  const value: AnnotationContextValue = {
    getPageStrokes,
    addStroke,
    eraseAt,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0
  }

  return <AnnotationContext.Provider value={value}>{children}</AnnotationContext.Provider>
}

export function useAnnotations(): AnnotationContextValue {
  const ctx = useContext(AnnotationContext)
  if (!ctx) throw new Error('useAnnotations must be used within AnnotationProvider')
  return ctx
}
