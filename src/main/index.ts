import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, extname, join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  loadAnnotations,
  saveAnnotations,
  loadNotes,
  saveNotes,
  loadViewState,
  saveViewState,
  listRecents,
  touchRecent,
  updateRecent,
  removeRecent,
  type RecentFile,
  type ViewState
} from './storage'

const TITLE_BAR_HEIGHT = 44

const THEME_COLORS = {
  light: { background: '#f3f3f1', titleBar: '#ebebe8', symbol: '#3a3a3c' },
  dark: { background: '#18181b', titleBar: '#111113', symbol: '#e4e4e7' }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 760,
    minHeight: 520,
    show: false,
    backgroundColor: THEME_COLORS.light.background,
    autoHideMenuBar: true,
    // Custom title bar so document tabs can sit in it, like most modern PDF apps
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 14, y: 15 } }
      : {
          titleBarOverlay: {
            color: THEME_COLORS.light.titleBar,
            symbolColor: THEME_COLORS.light.symbol,
            height: TITLE_BAR_HEIGHT
          }
        }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function readPdf(filePath: string): { path: string; name: string; data: ArrayBuffer } | null {
  if (extname(filePath).toLowerCase() !== '.pdf' || !existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  return {
    path: filePath,
    name: basename(filePath),
    data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.inkwell.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('pdf:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled) return []
    return result.filePaths.map(readPdf).filter((f) => f !== null)
  })

  ipcMain.handle('pdf:openPath', (_event, filePath: string) => readPdf(filePath))

  ipcMain.handle('pdf:save', async (_event, suggestedName: string, bytes: Uint8Array) => {
    const result = await dialog.showSaveDialog({
      defaultPath: suggestedName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, bytes)
    return result.filePath
  })

  ipcMain.handle('recents:list', () => listRecents())
  ipcMain.handle('recents:touch', (_event, entry: Omit<RecentFile, 'lastOpened'>) =>
    touchRecent(entry)
  )
  ipcMain.handle('recents:update', (_event, filePath: string, patch: Partial<RecentFile>) =>
    updateRecent(filePath, patch)
  )
  ipcMain.handle('recents:remove', (_event, filePath: string) => removeRecent(filePath))

  ipcMain.handle('annotations:load', (_event, pdfPath: string) => loadAnnotations(pdfPath))
  ipcMain.handle('annotations:save', (_event, pdfPath: string, data: unknown) =>
    saveAnnotations(pdfPath, data)
  )
  ipcMain.handle('notes:load', (_event, pdfPath: string) => loadNotes(pdfPath))
  ipcMain.handle('notes:save', (_event, pdfPath: string, markdown: string) =>
    saveNotes(pdfPath, markdown)
  )
  ipcMain.handle('view:load', (_event, pdfPath: string) => loadViewState(pdfPath))
  ipcMain.handle('view:save', (_event, pdfPath: string, state: ViewState) =>
    saveViewState(pdfPath, state)
  )

  // Keep the native window controls and background in step with the app theme
  ipcMain.on('theme:set', (_event, theme: 'light' | 'dark') => {
    if (!mainWindow) return
    const colors = THEME_COLORS[theme]
    mainWindow.setBackgroundColor(colors.background)
    if (process.platform !== 'darwin') {
      mainWindow.setTitleBarOverlay({
        color: colors.titleBar,
        symbolColor: colors.symbol,
        height: TITLE_BAR_HEIGHT
      })
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
