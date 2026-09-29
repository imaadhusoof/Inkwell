import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type OpenedPdf, type RecentFile } from './lib/api'
import { pdfjsLib, type PDFDocumentProxy } from './lib/pdfjs'
import { AnnotationStore, useHistory } from './lib/annotationStore'
import { exportAnnotatedPdf } from './lib/exportPdf'
import type { InkTool, ToolId, ToolSettings } from './lib/types'
import { TitleBar, type ThemePreference } from './components/TitleBar'
import { Home } from './components/Home'
import { Viewer, type PageSize, type ViewerHandle } from './components/Viewer'
import { ToolDock, PALETTES, SIZE_PRESETS } from './components/ToolDock'
import { Thumbnails } from './components/Thumbnails'
import { NotesPanel } from './components/NotesPanel'
import { ExportIcon, NotesIcon, PagesIcon } from './components/Icons'

interface OpenDoc {
  path: string
  name: string
  data: ArrayBuffer
  pdf: PDFDocumentProxy
  pageSizes: PageSize[]
  store: AnnotationStore
}

interface View {
  page: number
  zoom: number | null
}

const DEFAULT_SETTINGS: ToolSettings = {
  tool: 'pen',
  pen: { color: PALETTES.pen[0], size: SIZE_PRESETS.pen[1] },
  highlighter: { color: PALETTES.highlighter[0], size: SIZE_PRESETS.highlighter[1] }
}

const TOOL_KEYS: Record<string, ToolId> = { v: 'select', h: 'hand', p: 'pen', m: 'highlighter', e: 'eraser' }
const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']

function usePersistentState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`inkwell:${key}`)
      if (!raw) return initial
      const parsed = JSON.parse(raw)
      // Merge objects over the defaults so settings added later still get a value
      return typeof initial === 'object' && initial !== null ? { ...initial, ...parsed } : parsed
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(`inkwell:${key}`, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  )
}

async function renderCover(pdf: PDFDocumentProxy): Promise<string> {
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: 320 / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.75)
}

function App(): React.JSX.Element {
  const [docs, setDocs] = useState<OpenDoc[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [recents, setRecents] = useState<RecentFile[]>([])
  const [settings, setSettings] = usePersistentState<ToolSettings>('tools', DEFAULT_SETTINGS)
  const [themePref, setThemePref] = usePersistentState<ThemePreference>('theme', 'system')
  const [showThumbs, setShowThumbs] = usePersistentState('thumbnails', true)
  const [notesOpen, setNotesOpen] = usePersistentState('notesOpen', false)
  const [notesWidth, setNotesWidth] = usePersistentState('notesWidth', 360)
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [exporting, setExporting] = useState(false)
  const viewerRef = useRef<ViewerHandle>(null)
  const views = useRef(new Map<string, View>())
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout>>()

  const activeDoc = docs.find((d) => d.path === activePath) ?? null
  const history = useHistory(activeDoc?.store ?? null)

  // ---- Theme -------------------------------------------------------------
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const theme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    api.setTheme(theme)
  }, [theme])

  // ---- Toasts --------------------------------------------------------------
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  // ---- Opening and closing documents ------------------------------------------
  const refreshRecents = useCallback(() => api.listRecents().then(setRecents), [])
  useEffect(() => {
    void refreshRecents()
  }, [refreshRecents])

  const docsRef = useRef(docs)
  docsRef.current = docs

  const openDocument = useCallback(
    async (file: OpenedPdf) => {
      if (docsRef.current.some((d) => d.path === file.path)) {
        setActivePath(file.path)
        return
      }
      try {
        const pdf = await pdfjsLib.getDocument({ data: file.data.slice(0) }).promise
        const pageSizes = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then((page) => {
              const { width, height } = page.getViewport({ scale: 1 })
              return { width, height }
            })
          )
        )
        const store = new AnnotationStore(file.path)
        const [, savedView] = await Promise.all([store.load(), api.loadViewState(file.path)])
        views.current.set(file.path, savedView ?? { page: 1, zoom: null })

        setDocs((prev) =>
          prev.some((d) => d.path === file.path)
            ? prev
            : [...prev, { path: file.path, name: file.name, data: file.data, pdf, pageSizes, store }]
        )
        setActivePath(file.path)

        await api.touchRecent({ path: file.path, name: file.name, pageCount: pdf.numPages })
        await api.updateRecent(file.path, { thumbnail: await renderCover(pdf) })
        void refreshRecents()
      } catch (err) {
        console.error(err)
        showToast(`Couldn't open ${file.name}`)
      }
    },
    [refreshRecents, showToast]
  )

  const openDialog = useCallback(async () => {
    const files = await api.openPdf()
    for (const f of files) await openDocument(f)
  }, [openDocument])

  const openRecent = useCallback(
    async (path: string) => {
      const file = await api.openPdfPath(path)
      if (file) return openDocument(file)
      showToast("That file couldn't be found. It may have been moved or deleted.")
      await api.removeRecent(path)
      void refreshRecents()
    },
    [openDocument, refreshRecents, showToast]
  )

  const closeDocument = useCallback((path: string) => {
    const doc = docsRef.current.find((d) => d.path === path)
    if (!doc) return
    doc.store.flush()
    void doc.pdf.destroy()
    const remaining = docsRef.current.filter((d) => d.path !== path)
    setDocs(remaining)
    setActivePath((active) => {
      if (active !== path) return active
      const index = docsRef.current.findIndex((d) => d.path === path)
      return remaining[Math.min(index, remaining.length - 1)]?.path ?? null
    })
  }, [])

  const handleViewChange = useCallback(
    (page: number, zoom: number) => {
      setCurrentPage(page)
      if (!activePath) return
      views.current.set(activePath, { page, zoom })
      if (viewSaveTimer.current) clearTimeout(viewSaveTimer.current)
      const path = activePath
      viewSaveTimer.current = setTimeout(() => void api.saveViewState(path, { page, zoom }), 600)
    },
    [activePath]
  )

  const exportPdf = useCallback(async () => {
    if (!activeDoc || exporting) return
    if (activeDoc.store.pagesWithInk().length === 0) {
      showToast('There are no annotations to export yet.')
      return
    }
    setExporting(true)
    try {
      activeDoc.store.flush()
      const bytes = await exportAnnotatedPdf(activeDoc.data, activeDoc.pdf, activeDoc.store)
      const savedTo = await api.savePdf(activeDoc.name.replace(/\.pdf$/i, '') + ' (annotated).pdf', bytes)
      if (savedTo) showToast(`Exported to ${savedTo}`)
    } catch (err) {
      console.error(err)
      showToast('Export failed. Check the console for details.')
    } finally {
      setExporting(false)
    }
  }, [activeDoc, exporting, showToast])

  // ---- Drag and drop -------------------------------------------------------
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false
    const onEnter = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth++
      setDragging(true)
    }
    const onLeave = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent): void => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => /\.pdf$/i.test(f.name))
      if (files.length === 0) {
        if (e.dataTransfer?.files.length) showToast('Only PDF files can be opened.')
        return
      }
      for (const file of files) {
        await openDocument({ path: api.pathForFile(file) || file.name, name: file.name, data: await file.arrayBuffer() })
      }
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openDocument, showToast])

  // ---- Keyboard shortcuts -----------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'o') {
        e.preventDefault()
        void openDialog()
        return
      }
      if (mod && key === 'tab' && docs.length > 0) {
        e.preventDefault()
        const paths: (string | null)[] = [null, ...docs.map((d) => d.path)]
        const i = paths.indexOf(activePath)
        setActivePath(paths[(i + (e.shiftKey ? -1 : 1) + paths.length) % paths.length])
        return
      }
      if (!activeDoc) return
      if (mod && key === 'w') {
        e.preventDefault()
        closeDocument(activeDoc.path)
        return
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault()
        viewerRef.current?.zoomIn()
        return
      }
      if (mod && key === '-') {
        e.preventDefault()
        viewerRef.current?.zoomOut()
        return
      }
      if (mod && key === '0') {
        e.preventDefault()
        viewerRef.current?.fitWidth()
        return
      }
      if (mod && e.shiftKey && key === 'e') {
        e.preventDefault()
        void exportPdf()
        return
      }
      // Everything below would clash with typing in the notes
      if (isTyping(e.target)) return
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) activeDoc.store.redo()
        else activeDoc.store.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        activeDoc.store.redo()
        return
      }
      if (mod || e.altKey) return
      if (TOOL_KEYS[key]) {
        setSettings((s) => ({ ...s, tool: TOOL_KEYS[key] }))
      } else if (key === '[' || key === ']') {
        setSettings((s) => {
          if (s.tool !== 'pen' && s.tool !== 'highlighter') return s
          const tool: InkTool = s.tool
          const step = tool === 'pen' ? 0.5 : 2
          const size = Math.min(tool === 'pen' ? 24 : 48, Math.max(0.5, s[tool].size + (key === ']' ? step : -step)))
          return { ...s, [tool]: { ...s[tool], size } }
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [docs, activePath, activeDoc, openDialog, closeDocument, exportPdf, setSettings])

  const view = activePath ? views.current.get(activePath) : undefined
  const goToPage = useCallback((page: number) => viewerRef.current?.goToPage(page), [])

  return (
    <div className="app">
      <TitleBar
        platform={api.platform}
        tabs={docs}
        activePath={activePath}
        onSelect={setActivePath}
        onClose={closeDocument}
        onOpen={openDialog}
        theme={themePref}
        onCycleTheme={() => setThemePref(THEME_ORDER[(THEME_ORDER.indexOf(themePref) + 1) % THEME_ORDER.length])}
      />

      {activeDoc ? (
        <main className="workspace">
          {showThumbs && (
            <Thumbnails
              pdf={activeDoc.pdf}
              pageSizes={activeDoc.pageSizes}
              store={activeDoc.store}
              currentPage={currentPage}
              onSelect={goToPage}
            />
          )}
          <div className="workspace__center">
            <Viewer
              key={activeDoc.path}
              ref={viewerRef}
              pdf={activeDoc.pdf}
              pageSizes={activeDoc.pageSizes}
              store={activeDoc.store}
              settings={settings}
              initialPage={view?.page ?? 1}
              initialZoom={view?.zoom ?? null}
              onViewChange={handleViewChange}
            />
            <div className="workspace__corner workspace__corner--left">
              <button
                className={`icon-btn floating ${showThumbs ? 'is-active' : ''}`}
                onClick={() => setShowThumbs((v) => !v)}
                title="Page thumbnails"
              >
                <PagesIcon />
              </button>
            </div>
            <ToolDock
              settings={settings}
              onChange={setSettings}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onUndo={() => activeDoc.store.undo()}
              onRedo={() => activeDoc.store.redo()}
            />
            <div className="workspace__corner workspace__corner--right">
              <button className="btn floating" onClick={exportPdf} disabled={exporting} title="Export annotated PDF (Ctrl Shift E)">
                <ExportIcon size={16} /> <span className="btn__label">{exporting ? 'Exporting…' : 'Export'}</span>
              </button>
              <button
                className={`icon-btn floating ${notesOpen ? 'is-active' : ''}`}
                onClick={() => setNotesOpen((v) => !v)}
                title="Notes"
              >
                <NotesIcon />
              </button>
            </div>
          </div>
          {notesOpen && (
            <NotesPanel
              key={activeDoc.path}
              pdfPath={activeDoc.path}
              width={notesWidth}
              onResize={setNotesWidth}
              onClose={() => setNotesOpen(false)}
            />
          )}
        </main>
      ) : (
        <Home recents={recents} onOpen={openDialog} onOpenRecent={openRecent} onRemoveRecent={async (path) => {
          await api.removeRecent(path)
          void refreshRecents()
        }} />
      )}

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__box">Drop to open</div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
