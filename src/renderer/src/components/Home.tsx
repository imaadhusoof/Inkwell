import type { RecentFile } from '../lib/api'
import { FileIcon, InkwellLogo, TrashIcon } from './Icons'

function timeAgo(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

interface HomeProps {
  recents: RecentFile[]
  onOpen: () => void
  onOpenRecent: (path: string) => void
  onRemoveRecent: (path: string) => void
}

export function Home({ recents, onOpen, onOpenRecent, onRemoveRecent }: HomeProps): React.JSX.Element {
  return (
    <div className="home">
      <div className="home__inner">
        <header className="home__header">
          <div className="home__brand">
            <InkwellLogo size={40} />
            <div>
              <h1>Inkwell</h1>
              <p className="muted">Annotate PDFs and keep your notes beside them.</p>
            </div>
          </div>
          <button className="btn btn--primary" onClick={onOpen}>
            Open PDF <kbd>Ctrl O</kbd>
          </button>
        </header>

        {recents.length === 0 ? (
          <button className="home__drop" onClick={onOpen}>
            <FileIcon size={36} />
            <strong>Open a PDF to get started</strong>
            <span className="muted">Or drag one anywhere into this window</span>
          </button>
        ) : (
          <>
            <h2 className="home__section">Recent</h2>
            <div className="home__grid">
              {recents.map((r) => (
                <div key={r.path} className="card" title={r.path}>
                  <button className="card__open" onClick={() => onOpenRecent(r.path)}>
                    <div className="card__thumb">
                      {r.thumbnail ? <img src={r.thumbnail} alt="" /> : <FileIcon size={32} />}
                    </div>
                    <div className="card__meta">
                      <span className="card__name">{r.name.replace(/\.pdf$/i, '')}</span>
                      <span className="card__sub muted">
                        {timeAgo(r.lastOpened)}
                        {r.pageCount ? ` · ${r.pageCount} pages` : ''}
                      </span>
                    </div>
                  </button>
                  <button
                    className="card__remove icon-btn"
                    onClick={() => onRemoveRecent(r.path)}
                    title="Remove from recents"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
