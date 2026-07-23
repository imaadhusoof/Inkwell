import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Toolbar, type ToolState } from './components/Toolbar'
import { PdfPage } from './components/PdfPage'
import { NotesPanel } from './components/NotesPanel'
import { AnnotationProvider, useAnnotations } from './lib/AnnotationContext'
import { pdfjsLib, type PDFDocumentProxy } from './lib/pdfjs'

const SCALE = 1.4

interface OpenDoc {
  name: string
  data: ArrayBuffer
}

function DocumentView({
  pdfDoc,
  toolState
}: {
  pdfDoc: PDFDocumentProxy
  toolState: ToolState
}): React.JSX.Element {
  return (
    <div className="document-view">
      {Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map((pageNumber) => (
        <PdfPage
          key={pageNumber}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          scale={SCALE}
          toolSettings={toolState}
        />
      ))}
    </div>
  )
}

function UndoRedoToolbar({
  toolState,
  onChange,
  notesOpen,
  onToggleNotes
}: {
  toolState: ToolState
  onChange: (t: ToolState) => void
  notesOpen: boolean
  onToggleNotes: () => void
}): React.JSX.Element {
  const { undo, redo, canUndo, canRedo } = useAnnotations()
  return (
    <Toolbar
      toolState={toolState}
      onChange={onChange}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      notesOpen={notesOpen}
      onToggleNotes={onToggleNotes}
    />
  )
}

function App(): React.JSX.Element {
  const [openDocs, setOpenDocs] = useState<Record<string, OpenDoc>>({})
  const [activePath, setActivePath] = useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [toolState, setToolState] = useState<ToolState>({
    tool: 'pen',
    color: '#1a1a1a',
    size: 3,
    opacity: 1
  })

  useEffect(() => {
    if (!activePath) {
      setPdfDoc(null)
      return
    }
    const entry = openDocs[activePath]
    if (!entry) return
    let cancelled = false
    pdfjsLib.getDocument({ data: entry.data.slice(0) }).promise.then((doc) => {
      if (cancelled) return
      setPdfDoc(doc)
    })
    return () => {
      cancelled = true
    }
  }, [activePath, openDocs])

  async function handleOpen(): Promise<void> {
    const result = await window.inkwell.openPdf()
    if (!result) return
    setOpenDocs((prev) => ({ ...prev, [result.path]: { name: result.name, data: result.data } }))
    setActivePath(result.path)
  }

  const recent = Object.entries(openDocs).map(([path, doc]) => ({ path, name: doc.name }))

  return (
    <div className="app">
      <Sidebar recent={recent} activePath={activePath} onOpen={handleOpen} onSelect={setActivePath} />
      <div className="app__main">
        <AnnotationProvider pdfPath={activePath}>
          <UndoRedoToolbar
            toolState={toolState}
            onChange={setToolState}
            notesOpen={notesOpen}
            onToggleNotes={() => setNotesOpen((v) => !v)}
          />
          <div className="app__content">
            <div className="app__viewer">
              {pdfDoc ? (
                <DocumentView pdfDoc={pdfDoc} toolState={toolState} />
              ) : (
                <div className="app__empty">Open a PDF to start annotating</div>
              )}
            </div>
            {notesOpen && <NotesPanel pdfPath={activePath} />}
          </div>
        </AnnotationProvider>
      </div>
    </div>
  )
}

export default App
