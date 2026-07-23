import type { ToolId } from '../lib/types'

const COLORS = ['#1a1a1a', '#d64545', '#2f6fed', '#2f9e44', '#f2a900']

export interface ToolState {
  tool: ToolId
  color: string
  size: number
  opacity: number
}

interface ToolbarProps {
  toolState: ToolState
  onChange: (next: ToolState) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onToggleNotes: () => void
  notesOpen: boolean
}

export function Toolbar({
  toolState,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleNotes,
  notesOpen
}: ToolbarProps): React.JSX.Element {
  function setTool(tool: ToolId): void {
    if (tool === 'highlighter') {
      onChange({ ...toolState, tool, size: 18, opacity: 0.35 })
    } else if (tool === 'pen') {
      onChange({ ...toolState, tool, size: 3, opacity: 1 })
    } else {
      onChange({ ...toolState, tool })
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar__group">
        <button
          className={toolState.tool === 'pen' ? 'toolbar__btn is-active' : 'toolbar__btn'}
          onClick={() => setTool('pen')}
          title="Pen"
        >
          Pen
        </button>
        <button
          className={toolState.tool === 'highlighter' ? 'toolbar__btn is-active' : 'toolbar__btn'}
          onClick={() => setTool('highlighter')}
          title="Highlighter"
        >
          Highlighter
        </button>
        <button
          className={toolState.tool === 'eraser' ? 'toolbar__btn is-active' : 'toolbar__btn'}
          onClick={() => setTool('eraser')}
          title="Eraser"
        >
          Eraser
        </button>
      </div>

      {toolState.tool !== 'eraser' && (
        <div className="toolbar__group">
          {COLORS.map((c) => (
            <button
              key={c}
              className={
                toolState.color === c ? 'toolbar__swatch is-active' : 'toolbar__swatch'
              }
              style={{ backgroundColor: c }}
              onClick={() => onChange({ ...toolState, color: c })}
              title={c}
            />
          ))}
          <input
            type="range"
            min={1}
            max={40}
            value={toolState.size}
            onChange={(e) => onChange({ ...toolState, size: Number(e.target.value) })}
          />
        </div>
      )}

      <div className="toolbar__group">
        <button className="toolbar__btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          Undo
        </button>
        <button className="toolbar__btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          Redo
        </button>
      </div>

      <div className="toolbar__group toolbar__group--right">
        <button
          className={notesOpen ? 'toolbar__btn is-active' : 'toolbar__btn'}
          onClick={onToggleNotes}
        >
          Notes
        </button>
      </div>
    </div>
  )
}
