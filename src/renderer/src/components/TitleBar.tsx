import { CloseIcon, HomeIcon, InkwellLogo, MonitorIcon, MoonIcon, PlusIcon, SunIcon } from './Icons'

export type ThemePreference = 'system' | 'light' | 'dark'

interface Tab {
  path: string
  name: string
}

interface TitleBarProps {
  platform: string
  tabs: Tab[]
  activePath: string | null
  onSelect: (path: string | null) => void
  onClose: (path: string) => void
  onOpen: () => void
  theme: ThemePreference
  onCycleTheme: () => void
}

const THEME_ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon }

export function TitleBar({
  platform,
  tabs,
  activePath,
  onSelect,
  onClose,
  onOpen,
  theme,
  onCycleTheme
}: TitleBarProps): React.JSX.Element {
  const ThemeIcon = THEME_ICONS[theme]
  return (
    <header className={`titlebar platform-${platform}`}>
      <div className="titlebar__brand">
        <InkwellLogo size={20} />
      </div>
      <nav className="titlebar__tabs">
        <button
          className={`tab tab--home ${activePath === null ? 'is-active' : ''}`}
          onClick={() => onSelect(null)}
          title="Home"
        >
          <HomeIcon size={16} />
        </button>
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`tab ${tab.path === activePath ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              // Middle click closes, like a browser tab
              if (e.button === 1) {
                e.preventDefault()
                onClose(tab.path)
              }
            }}
          >
            <button className="tab__label" onClick={() => onSelect(tab.path)} title={tab.path}>
              {tab.name.replace(/\.pdf$/i, '')}
            </button>
            <button className="tab__close" onClick={() => onClose(tab.path)} title="Close (Ctrl W)">
              <CloseIcon size={13} />
            </button>
          </div>
        ))}
        <button className="tab tab--new" onClick={onOpen} title="Open PDF (Ctrl O)">
          <PlusIcon size={16} />
        </button>
      </nav>
      <button className="titlebar__action icon-btn" onClick={onCycleTheme} title={`Theme: ${theme}`}>
        <ThemeIcon size={16} />
      </button>
    </header>
  )
}
