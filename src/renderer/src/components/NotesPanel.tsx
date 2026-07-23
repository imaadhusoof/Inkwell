import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { useEffect, useRef } from 'react'

interface NotesPanelProps {
  pdfPath: string | null
}

export function NotesPanel({ pdfPath }: NotesPanelProps): React.JSX.Element {
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: '',
    onUpdate: ({ editor: e }) => {
      if (!pdfPath) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        const markdown = e.storage.markdown.getMarkdown()
        window.inkwell.saveNotes(pdfPath, markdown)
      }, 500)
    }
  })

  useEffect(() => {
    if (!editor) return
    if (!pdfPath) {
      editor.commands.setContent('')
      return
    }
    let cancelled = false
    window.inkwell.loadNotes(pdfPath).then((markdown) => {
      if (cancelled || !editor) return
      editor.commands.setContent(markdown ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [pdfPath, editor])

  return (
    <div className="notes-panel">
      <div className="notes-panel__header">Notes</div>
      <div className="notes-panel__body">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
