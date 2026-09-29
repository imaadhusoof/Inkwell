import type { InkwellApi, OpenedPdf, RecentFile, ViewState } from '../../../preload'

export type { OpenedPdf, RecentFile, ViewState }

/**
 * Stand-in for the Electron preload API so the renderer can be previewed in a plain
 * browser during development (`npm run dev` also serves it on localhost). Files are
 * picked with a file input and everything is kept in localStorage / memory.
 */
function createBrowserFallback(): InkwellApi {
  const opened = new Map<string, OpenedPdf>()
  const key = (kind: string, path: string): string => `inkwell:${kind}:${path}`
  const read = <T>(k: string): T | null => {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  }
  const recents = (): RecentFile[] =>
    (read<RecentFile[]>('inkwell:recents') ?? []).filter((r) => opened.has(r.path))
  const writeRecents = (list: RecentFile[]): void => {
    try {
      localStorage.setItem('inkwell:recents', JSON.stringify(list.slice(0, 16)))
    } catch {
      // thumbnails can overflow the quota; recents are best-effort in the browser
    }
  }

  return {
    platform: 'browser' as NodeJS.Platform,
    openPdf: () =>
      new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/pdf'
        input.multiple = true
        input.onchange = async () => {
          const files = Array.from(input.files ?? [])
          const result = await Promise.all(
            files.map(async (f) => {
              const pdf = { path: f.name, name: f.name, data: await f.arrayBuffer() }
              opened.set(pdf.path, pdf)
              return pdf
            })
          )
          resolve(result)
        }
        input.click()
      }),
    openPdfPath: async (path) => opened.get(path) ?? null,
    pathForFile: (file) => {
      void file.arrayBuffer().then((data) => opened.set(file.name, { path: file.name, name: file.name, data }))
      return file.name
    },
    savePdf: async (name, bytes) => {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      return name
    },
    listRecents: async () => recents(),
    touchRecent: async (entry) => {
      const list = recents()
      const existing = list.find((r) => r.path === entry.path)
      writeRecents([
        { ...existing, ...entry, lastOpened: Date.now() },
        ...list.filter((r) => r.path !== entry.path)
      ])
    },
    updateRecent: async (path, patch) => {
      writeRecents(recents().map((r) => (r.path === path ? { ...r, ...patch } : r)))
    },
    removeRecent: async (path) => writeRecents(recents().filter((r) => r.path !== path)),
    loadAnnotations: async (path) => read(key('ann', path)),
    saveAnnotations: async (path, data) => localStorage.setItem(key('ann', path), JSON.stringify(data)),
    loadNotes: async (path) => localStorage.getItem(key('notes', path)),
    saveNotes: async (path, md) => localStorage.setItem(key('notes', path), md),
    loadViewState: async (path) => read<ViewState>(key('view', path)),
    saveViewState: async (path, state) => localStorage.setItem(key('view', path), JSON.stringify(state)),
    setTheme: () => {}
  }
}

export const api: InkwellApi = window.inkwell ?? createBrowserFallback()
