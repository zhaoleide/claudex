import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  Project,
  LaunchOptions,
  ClaudeSettings,
  McpServerConfig,
  ClaudeSession
} from '../shared/ipc'

const api = {
  // PTY ------------------------------------------------------------------
  pty: {
    start: (opts: LaunchOptions): Promise<{ id: string }> =>
      ipcRenderer.invoke(IPC.ptyStart, opts),
    write: (id: string, data: string) =>
      ipcRenderer.invoke(IPC.ptyWrite, { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC.ptyResize, { id, cols, rows }),
    kill: (id: string) => ipcRenderer.invoke(IPC.ptyKill, { id }),
    onData: (cb: (id: string, data: string) => void) => {
      const listener = (_evt: unknown, payload: { id: string; data: string }) =>
        cb(payload.id, payload.data)
      ipcRenderer.on(IPC.ptyData, listener)
      return () => ipcRenderer.removeListener(IPC.ptyData, listener)
    },
    onExit: (cb: (id: string, code: number, signal?: number) => void) => {
      const listener = (
        _evt: unknown,
        payload: { id: string; code: number; signal?: number }
      ) => cb(payload.id, payload.code, payload.signal)
      ipcRenderer.on(IPC.ptyExit, listener)
      return () => ipcRenderer.removeListener(IPC.ptyExit, listener)
    }
  },

  // Projects -------------------------------------------------------------
  projects: {
    list: (): Promise<Project[]> => ipcRenderer.invoke(IPC.projectsList),
    add: (p: Omit<Project, 'id' | 'createdAt'>): Promise<Project> =>
      ipcRenderer.invoke(IPC.projectsAdd, p),
    remove: (id: string) => ipcRenderer.invoke(IPC.projectsRemove, id),
    update: (id: string, patch: Partial<Project>) =>
      ipcRenderer.invoke(IPC.projectsUpdate, { id, patch }),
    pickDir: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:openDirectory')
  },

  // Sessions -------------------------------------------------------------
  sessions: {
    list: (projectPath: string): Promise<ClaudeSession[]> =>
      ipcRenderer.invoke(IPC.sessionsList, projectPath),
    listAll: (): Promise<Record<string, ClaudeSession[]>> =>
      ipcRenderer.invoke(IPC.sessionsListAll)
  },

  // Config ---------------------------------------------------------------
  config: {
    read: (): Promise<ClaudeSettings> => ipcRenderer.invoke(IPC.configRead),
    write: (settings: ClaudeSettings) =>
      ipcRenderer.invoke(IPC.configWrite, settings),
    readClaudeMd: (): Promise<string> =>
      ipcRenderer.invoke(IPC.configReadClaudeMd),
    writeClaudeMd: (text: string) =>
      ipcRenderer.invoke(IPC.configWriteClaudeMd, text),
    readMcp: (): Promise<Record<string, McpServerConfig>> =>
      ipcRenderer.invoke(IPC.configReadMcp),
    writeMcp: (servers: Record<string, McpServerConfig>) =>
      ipcRenderer.invoke(IPC.configWriteMcp, servers)
  },

  // Shell / app ----------------------------------------------------------
  shell: {
    openPath: (p: string) => ipcRenderer.invoke(IPC.shellOpenPath, p)
  },
  app: {
    info: (): Promise<{
      platform: string
      home: string
      userData: string
      version: string
    }> => ipcRenderer.invoke(IPC.appInfo)
  },

  // Auto Update ----------------------------------------------------------
  update: {
    check: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.updateCheck),
    download: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.updateDownload),
    install: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.updateInstall),
    onProgress: (cb: (data: {
      percent: number
      bytesPerSecond: number
      transferred: number
      total: number
    }) => void) => {
      const listener = (_evt: unknown, data: any) => cb(data)
      ipcRenderer.on(IPC.updateProgress, listener)
      return () => ipcRenderer.removeListener(IPC.updateProgress, listener)
    },
    onAvailable: (cb: (data: {
      version: string
      releaseDate: string
      releaseNotes: string | null
    }) => void) => {
      const listener = (_evt: unknown, data: any) => cb(data)
      ipcRenderer.on(IPC.updateAvailable, listener)
      return () => ipcRenderer.removeListener(IPC.updateAvailable, listener)
    },
    onError: (cb: (data: { message: string }) => void) => {
      const listener = (_evt: unknown, data: any) => cb(data)
      ipcRenderer.on(IPC.updateError, listener)
      return () => ipcRenderer.removeListener(IPC.updateError, listener)
    },
    onDownloaded: (cb: (data: {
      version: string
      releaseDate: string
    }) => void) => {
      const listener = (_evt: unknown, data: any) => cb(data)
      ipcRenderer.on(IPC.updateDownloaded, listener)
      return () => ipcRenderer.removeListener(IPC.updateDownloaded, listener)
    }
  }
}

contextBridge.exposeInMainWorld('claudex', api)

export type ClaudexApi = typeof api
