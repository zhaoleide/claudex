// Shared IPC channel names + payload types between main & renderer.

export type Project = {
  id: string
  name: string
  path: string
  favorite?: boolean
  lastOpenedAt?: number
  createdAt: number
}

export type ClaudeSession = {
  id: string
  projectPath: string
  /** ISO timestamp from session log file mtime */
  modifiedAt: string
  /** ISO timestamp of first user turn */
  startedAt?: string
  /** First user message, used as preview */
  preview?: string
  /** Last user message, useful as "recent topic" hint */
  lastMessage?: string
  /** Real user-turn count (excludes tool_result, system, attachment, etc.) */
  messageCount?: number
  /** Optional git branch parsed from the log */
  gitBranch?: string
  /** User-assigned custom name */
  customName?: string
}

export type LaunchOptions = {
  cwd: string
  /** Override the binary, defaults to "claude" on PATH */
  command?: string
  /** Extra args, e.g. ["--resume", "<session-id>"] */
  args?: string[]
  /** Initial cols/rows from xterm */
  cols?: number
  rows?: number
  /** Extra env merged on top of process.env */
  env?: Record<string, string>
}

export type McpServerConfig = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  type?: 'stdio' | 'http' | 'sse'
}

export type ClaudeSettings = {
  permissions?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
  }
  env?: Record<string, string>
  apiKeyHelper?: string
  model?: string
  outputStyle?: string
  // Free-form passthrough so we never lose unknown keys when saving.
  [key: string]: unknown
}

export const IPC = {
  // PTY
  ptyStart: 'pty:start',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptyData: 'pty:data', // main -> renderer
  ptyExit: 'pty:exit', // main -> renderer

  // Projects
  projectsList: 'projects:list',
  projectsAdd: 'projects:add',
  projectsRemove: 'projects:remove',
  projectsUpdate: 'projects:update',
  projectsPickDir: 'projects:pickDir',

  // Sessions (resume)
  sessionsList: 'sessions:list',
  sessionsListAll: 'sessions:listAll',
  sessionsDelete: 'sessions:delete',
  sessionsRename: 'sessions:rename',
  sessionsChanged: 'sessions:changed', // main -> renderer (file watcher notify)

  // Claude config
  configRead: 'config:read', // settings.json
  configWrite: 'config:write',
  configReadClaudeMd: 'config:readClaudeMd',
  configWriteClaudeMd: 'config:writeClaudeMd',
  configReadMcp: 'config:readMcp',
  configWriteMcp: 'config:writeMcp',

  // Auto Update
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateProgress: 'update:progress', // main -> renderer
  updateAvailable: 'update:available', // main -> renderer
  updateNotAvailable: 'update:not-available', // main -> renderer
  updateError: 'update:error', // main -> renderer
  updateDownloaded: 'update:downloaded', // main -> renderer

  // Misc
  shellOpenPath: 'shell:openPath',
  appInfo: 'app:info'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
