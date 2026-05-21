import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, app } from 'electron'
import { IPC } from '../shared/ipc'

let mainWindow: BrowserWindow | null = null

// Configure auto updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false
autoUpdater.forceDevUpdateConfig = true // Enable update checking in development

function sendToRenderer(channel: string, data?: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function setupAutoUpdater(win: BrowserWindow) {
  mainWindow = win

  // Only enable auto update in production
  // TEMP: Enable in development for testing
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Running in development mode (testing enabled)')
    // return  // Commented out for testing
  }

  console.log('[AutoUpdater] Initialized')

  // Check for updates on app start (with delay)
  setTimeout(() => {
    checkForUpdates()
  }, 3000)

  // AutoUpdater events
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version)
    sendToRenderer(IPC.updateAvailable, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available')
    // Notify renderer that check completed but no update available
    sendToRenderer(IPC.updateNotAvailable)
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message)
    sendToRenderer(IPC.updateError, {
      message: err.message
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent)
    console.log(`[AutoUpdater] Download progress: ${percent}%`)
    sendToRenderer(IPC.updateProgress, {
      percent,
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded')
    sendToRenderer(IPC.updateDownloaded, {
      version: info.version,
      releaseDate: info.releaseDate
    })
  })

  // IPC handlers
  ipcMain.handle(IPC.updateCheck, async () => {
    try {
      await checkForUpdates()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.updateDownload, async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(IPC.updateInstall, () => {
    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}

async function checkForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates()
    return result
  } catch (error) {
    console.error('[AutoUpdater] Check for updates failed:', error)
    throw error
  }
}
