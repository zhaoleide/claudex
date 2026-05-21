import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import { registerPtyHandlers, killAllPtys } from './pty'
import { registerProjectHandlers } from './projects'
import { registerConfigHandlers } from './config'
import { registerSessionHandlers } from './sessions'
import { setupAutoUpdater } from './updater'
import { IPC } from '../shared/ipc'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const isDev = !!VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev && VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerCommonHandlers() {
  ipcMain.handle(IPC.shellOpenPath, async (_evt, p: string) => {
    return shell.openPath(p)
  })

  ipcMain.handle(IPC.appInfo, async () => ({
    platform: process.platform,
    home: app.getPath('home'),
    userData: app.getPath('userData'),
    version: app.getVersion()
  }))

  ipcMain.handle('dialog:openDirectory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

app.whenReady().then(() => {
  registerCommonHandlers()
  registerPtyHandlers(() => mainWindow)
  registerProjectHandlers()
  registerConfigHandlers()
  registerSessionHandlers()
  createWindow()

  // Setup auto updater after window is created
  if (mainWindow) {
    setupAutoUpdater(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAllPtys()
})
