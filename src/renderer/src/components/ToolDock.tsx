import type { InkTool, ToolId, ToolSettings } from '../lib/types'
import {
  CursorIcon,
  EraserIcon,
  HandIcon,
  HighlighterIcon,
  PenIcon,
  RedoIcon,
  UndoIcon
} from './Icons'

export const PALETTES: Record<InkTool, string[]> = {
  pen: ['#1c1c1e', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c'],
  highlighter: ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c']
}

export const SIZE_PRESETS: Record<InkTool, number[]> = {
  pen: [1.5, 3, 6],
  highlighter: [10, 18, 28]
}

const TOOLS: { id: ToolId; label: string; key: string; Icon: typeof PenIcon }[] = [
  { id: 'select', label: 'Select text', key: 'V', Icon: CursorIcon },
  { id: 'hand', label: 'Hand', key: 'H', Icon: HandIcon },
  { id: 'pen', label: 'Pen', key: 'P', Icon: PenIcon },
  { id: 'highlighter', label: 'Highlighter', key: 'M', Icon: HighlighterIcon },
  { id: 'eraser', label: 'Eraser', key: 'E', Icon: EraserIcon }
]

interface ToolDockProps {
  settings: ToolSettings
  onChange: (next: ToolSettings) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export function ToolDock({
  settings,
  onChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: ToolDockProps): React.JSX.Element {
  const ink = settings.tool === 'pen' || settings.tool === 'highlighter' ? settings.tool : null
  const current = ink ? settings[ink] : null

  function update(patch: Partial<ToolSettings[InkTool]>): void {
    if (!ink) return
    onChange({ ...settings, [ink]: { ...settings[ink], ...patch } })
  }

  const palette = ink ? PALETTES[ink] : []
  const customColor = current && !palette.includes(current.color)

  return (
    <div className="dock floating">
      <div className="dock__group">
        {TOOLS.map(({ id, label, key, Icon }) => (
          <button
            key={id}
            className={`dock__tool ${settings.tool === id ? 'is-active' : ''}`}
            onClick={() => onChange({ ...settings, tool: id })}
            title={`${label} (${key})`}
          >
            <Icon />
            {(id === 'pen' || id === 'highlighter') && (
              <span className="dock__tool-color" style={{ background: settings[id].color }} />
            )}
          </button>
        ))}
      </div>

      {ink && current && (
        <>
          <span className="divider" />
          <div className="dock__group">
            {palette.map((color) => (
              <button
                key={color}
                className={`swatch ${current.color === color ? 'is-active' : ''}`}
                style={{ '--swatch': color } as React.CSSProperties}
                onClick={() => update({ color })}
                title={color}
              />
            ))}
            <label
              className={`swatch swatch--custom ${customColor ? 'is-active' : ''}`}
              style={customColor ? ({ '--swatch': current.color } as React.CSSProperties) : undefined}
              title="Custom colour"
            >
              <input type="color" value={current.color} onChange={(e) => update({ color: e.target.value })} />
            </label>
          </div>
          <span className="divider" />
          <div className="dock__group">
            {SIZE_PRESETS[ink].map((size, i) => (
              <button
                key={size}
                className={`dock__size ${current.size === size ? 'is-active' : ''}`}
                onClick={() => update({ size })}
                title={`Size ${size}  ([ and ] to fine-tune)`}
              >
                <span
                  style={{
                    width: 4 + i * 4,
                    height: ink === 'highlighter' ? 6 + i * 3 : 4 + i * 4,
                    borderRadius: ink === 'highlighter' ? 2 : '50%',
                    background: current.color,
                    opacity: ink === 'highlighter' ? 0.7 : 1
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}

      <span className="divider" />
      <div className="dock__group">
        <button className="dock__tool" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl Z)">
          <UndoIcon />
        </button>
        <button className="dock__tool" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl Shift Z)">
          <RedoIcon />
        </button>
      </div>
    </div>
  )
}
