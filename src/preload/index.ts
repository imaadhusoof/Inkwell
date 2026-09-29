import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface OpenedPdf {
  path: string
  name: string
  data: ArrayBuffer
}

export interface RecentFile {
  path: string
  name: string
  lastOpened: number
  pageCount?: number
  thumbnail?: string
}

export interface ViewState {
  page: number
  zoom: number
}

const api = {
  platform: process.platform,
  openPdf: (): Promise<OpenedPdf[]> => ipcRenderer.invoke('pdf:open'),
  openPdfPath: (pdfPath: string): Promise<OpenedPdf | null> =>
    ipcRenderer.invoke('pdf:openPath', pdfPath),
  /** Resolves the on-disk path of a file dropped onto the window. */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  savePdf: (suggestedName: string, bytes: Uint8Array): Promise<string | null> =>
    ipcRenderer.invoke('pdf:save', suggestedName, bytes),

  listRecents: (): Promise<RecentFile[]> => ipcRenderer.invoke('recents:list'),
  touchRecent: (entry: Omit<RecentFile, 'lastOpened'>): Promise<void> =>
    ipcRenderer.invoke('recents:touch', entry),
  updateRecent: (pdfPath: string, patch: Partial<RecentFile>): Promise<void> =>
    ipcRenderer.invoke('recents:update', pdfPath, patch),
  removeRecent: (pdfPath: string): Promise<void> => ipcRenderer.invoke('recents:remove', pdfPath),

  loadAnnotations: (pdfPath: string): Promise<unknown | null> =>
    ipcRenderer.invoke('annotations:load', pdfPath),
  saveAnnotations: (pdfPath: string, data: unknown): Promise<void> =>
    ipcRenderer.invoke('annotations:save', pdfPath, data),
  loadNotes: (pdfPath: string): Promise<string | null> =>
    ipcRenderer.invoke('notes:load', pdfPath),
  saveNotes: (pdfPath: string, markdown: string): Promise<void> =>
    ipcRenderer.invoke('notes:save', pdfPath, markdown),
  loadViewState: (pdfPath: string): Promise<ViewState | null> =>
    ipcRenderer.invoke('view:load', pdfPath),
  saveViewState: (pdfPath: string, state: ViewState): Promise<void> =>
    ipcRenderer.invoke('view:save', pdfPath, state),

  setTheme: (theme: 'light' | 'dark'): void => ipcRenderer.send('theme:set', theme)
}

contextBridge.exposeInMainWorld('inkwell', api)

export type InkwellApi = typeof api
