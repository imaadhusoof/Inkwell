import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadAnnotations, saveAnnotations, loadNotes, saveNotes } from './storage'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.inkwell.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('pdf:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const buffer = readFileSync(filePath)
    return {
      path: filePath,
      name: filePath.split(/[\\/]/).pop() ?? filePath,
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    }
  })

  ipcMain.handle('annotations:load', (_event, pdfPath: string) => loadAnnotations(pdfPath))
  ipcMain.handle('annotations:save', (_event, pdfPath: string, data: unknown) =>
    saveAnnotations(pdfPath, data)
  )
  ipcMain.handle('notes:load', (_event, pdfPath: string) => loadNotes(pdfPath))
  ipcMain.handle('notes:save', (_event, pdfPath: string, markdown: string) =>
    saveNotes(pdfPath, markdown)
  )

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
