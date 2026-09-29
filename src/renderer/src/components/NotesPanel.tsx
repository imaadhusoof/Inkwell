import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { CloseIcon } from './Icons'

const SAVE_DELAY = 500
const MIN_WIDTH = 260
const MAX_WIDTH = 640

interface NotesPanelProps {
  pdfPath: string
  width: number
  onResize: (width: number) => void
  onClose: () => void
}

type SaveState = 'idle' | 'saving' | 'saved'

function FormatBar({ editor }: { editor: Editor }): React.JSX.Element {
  const buttons: { label: string; title: string; active: boolean; run: () => void; className?: string }[] = [
    { label: 'H1', title: 'Heading 1', active: editor.isActive('heading', { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'H2', title: 'Heading 2', active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'B', title: 'Bold (Ctrl B)', active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run(), className: 'is-bold' },
    { label: 'I', title: 'Italic (Ctrl I)', active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run(), className: 'is-italic' },
    { label: 'S', title: 'Strikethrough', active: editor.isActive('strike'), run: () => editor.chain().focus().toggleStrike().run(), className: 'is-strike' },
    { label: '•', title: 'Bullet list', active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: '1.', title: 'Numbered list', active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: '“', title: 'Quote', active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: '</>', title: 'Code block', active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() }
  ]
  return (
    <div className="notes__format">
      {buttons.map((b) => (
        <button
          key={b.title}
          className={`notes__format-btn ${b.className ?? ''} ${b.active ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
          title={b.title}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

export function NotesPanel({ pdfPath, width, onResize, onClose }: NotesPanelProps): React.JSX.Element {
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  const pendingSave = useRef<(() => void) | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [, rerender] = useState(0)

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '',
    onUpdate: ({ editor: e }) => {
      setSaveState('saving')
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      pendingSave.current = () => {
        pendingSave.current = null
        void api.saveNotes(pdfPath, e.storage.markdown.getMarkdown()).then(() => setSaveState('saved'))
      }
      saveTimeout.current = setTimeout(() => pendingSave.current?.(), SAVE_DELAY)
    },
    // Keeps the format bar's active states in sync with the cursor
    onSelectionUpdate: () => rerender((n) => n + 1),
    onTransaction: () => rerender((n) => n + 1)
  })

  useEffect(() => {
    if (!editor) return
    let cancelled = false
    api.loadNotes(pdfPath).then((markdown) => {
      if (cancelled) return
      editor.commands.setContent(markdown ?? '', false)
      setSaveState('idle')
    })
    return () => {
      cancelled = true
      // Save straight away when switching documents or closing the panel
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      pendingSave.current?.()
    }
  }, [pdfPath, editor])

  function startResize(e: React.PointerEvent): void {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width
    const move = (ev: PointerEvent): void =>
      onResize(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX))))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-resizing')
    }
    document.body.classList.add('is-resizing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <aside className="notes" style={{ width }}>
      <div className="notes__resize" onPointerDown={startResize} />
      <header className="notes__header">
        <span className="notes__title">Notes</span>
        <span className={`notes__status is-${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
        </span>
        <button className="icon-btn" onClick={onClose} title="Close notes">
          <CloseIcon size={16} />
        </button>
      </header>
      {editor && <FormatBar editor={editor} />}
      <div className="notes__body" onClick={() => editor?.commands.focus()}>
        {editor?.isEmpty && <div className="notes__placeholder">Start typing your notes… Markdown shortcuts like # and - work too.</div>}
        <EditorContent editor={editor} />
      </div>
    </aside>
  )
}
