interface OpenPdfEntry {
  path: string
  name: string
}

interface SidebarProps {
  recent: OpenPdfEntry[]
  activePath: string | null
  onOpen: () => void
  onSelect: (path: string) => void
}

export function Sidebar({ recent, activePath, onOpen, onSelect }: SidebarProps): React.JSX.Element {
  return (
    <div className="sidebar">
      <div className="sidebar__brand">Inkwell</div>
      <button className="sidebar__open-btn" onClick={onOpen}>
        Open PDF…
      </button>
      <div className="sidebar__list">
        {recent.map((entry) => (
          <button
            key={entry.path}
            className={
              entry.path === activePath ? 'sidebar__item is-active' : 'sidebar__item'
            }
            onClick={() => onSelect(entry.path)}
            title={entry.path}
          >
            {entry.name}
          </button>
        ))}
      </div>
    </div>
  )
}
