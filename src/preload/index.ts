import { contextBridge, ipcRenderer } from 'electron'

export interface OpenedPdf {
  path: string
  name: string
  data: ArrayBuffer
}

const api = {
  openPdf: (): Promise<OpenedPdf | null> => ipcRenderer.invoke('pdf:open'),
  loadAnnotations: (pdfPath: string): Promise<unknown | null> =>
    ipcRenderer.invoke('annotations:load', pdfPath),
  saveAnnotations: (pdfPath: string, data: unknown): Promise<void> =>
    ipcRenderer.invoke('annotations:save', pdfPath, data),
  loadNotes: (pdfPath: string): Promise<string | null> =>
    ipcRenderer.invoke('notes:load', pdfPath),
  saveNotes: (pdfPath: string, markdown: string): Promise<void> =>
    ipcRenderer.invoke('notes:save', pdfPath, markdown)
}

contextBridge.exposeInMainWorld('inkwell', api)

export type InkwellApi = typeof api
