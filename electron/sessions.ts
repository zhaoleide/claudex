import { ipcMain, app, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'
import { IPC } from '../shared/ipc'
import type { ClaudeSession } from '../shared/ipc'

/**
 * Claude Code stores per-project session logs under
 *   ~/.claude/projects/<encoded-project-path>/<session-uuid>.jsonl
 *
 * Each .jsonl line is one event. A single chat turn easily produces 20+
 * lines because every tool call and tool result is its own event. To get
 * a useful "message count" we only count *real user turns*, i.e. records
 * with `type === "user"` whose `message.content` is text/image — NOT
 * tool_result wrappers.
 */

type Jsonl = Record<string, unknown>

const PREVIEW_MAX = 200

// --- Session custom names store ---
const namesFile = path.join(
  process.env.HOME || '/tmp',
  '.claude',
  'claudex-session-names.json'
)
let namesCache: Record<string, string> = {}

function loadNames(): Record<string, string> {
  try {
    namesCache = JSON.parse(fsSync.readFileSync(namesFile, 'utf-8'))
  } catch {
    namesCache = {}
  }
  return namesCache
}

function saveNames() {
  fsSync.mkdirSync(path.dirname(namesFile), { recursive: true })
  fsSync.writeFileSync(namesFile, JSON.stringify(namesCache, null, 2))
}

// Load on module init
loadNames()

function isUserTurnContent(content: unknown): boolean {
  if (typeof content === 'string') return content.trim().length > 0
  if (!Array.isArray(content)) return false
  let hasReal = false
  for (const c of content) {
    if (!c || typeof c !== 'object') continue
    const t = (c as { type?: string }).type
    if (t === 'tool_result' || t === 'tool_use') return false
    if (t === 'text' || t === 'image') hasReal = true
  }
  return hasReal
}

function extractText(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const c of content) {
    if (c && typeof c === 'object') {
      const t = (c as { type?: string; text?: unknown }).type
      const text = (c as { text?: unknown }).text
      if (t === 'text' && typeof text === 'string') parts.push(text)
      else if (t === 'image') parts.push('[图片]')
    }
  }
  const s = parts.join(' ').trim()
  return s.length ? s : undefined
}

function clean(text: string): string {
  // Collapse newlines/whitespace; trim slash-commands fluff.
  return text.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_MAX)
}

type ParsedSession = {
  id: string
  cwd: string
  modifiedAt: string
  startedAt?: string
  preview?: string
  lastMessage?: string
  messageCount: number
  gitBranch?: string
}

async function parseSessionFile(
  file: string,
  fallbackCwd: string
): Promise<ParsedSession | null> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf-8')
  } catch {
    return null
  }
  const stat = await fs.stat(file).catch(() => null)

  let cwd = fallbackCwd
  let gitBranch: string | undefined
  let startedAt: string | undefined
  let firstMsg: string | undefined
  let lastMsg: string | undefined
  let userTurns = 0

  const lines = raw.split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    let rec: Jsonl
    try {
      rec = JSON.parse(line)
    } catch {
      continue
    }
    const cwdField = (rec as { cwd?: unknown }).cwd
    if (typeof cwdField === 'string' && cwd === fallbackCwd) cwd = cwdField
    const gb = (rec as { gitBranch?: unknown }).gitBranch
    if (!gitBranch && typeof gb === 'string') gitBranch = gb

    const type = (rec as { type?: string }).type
    if (type !== 'user') continue

    const msg = (rec as { message?: { content?: unknown } }).message
    const content = msg && typeof msg === 'object' ? msg.content : undefined
    if (!isUserTurnContent(content)) continue

    const text = extractText(content)
    if (!text) continue

    userTurns += 1
    const cleaned = clean(text)
    if (!firstMsg) {
      firstMsg = cleaned
      const ts = (rec as { timestamp?: unknown }).timestamp
      if (typeof ts === 'string') startedAt = ts
    }
    lastMsg = cleaned
  }

  return {
    id: path.basename(file, '.jsonl'),
    cwd,
    modifiedAt: stat?.mtime.toISOString() ?? new Date(0).toISOString(),
    startedAt,
    preview: firstMsg,
    lastMessage: lastMsg && lastMsg !== firstMsg ? lastMsg : undefined,
    messageCount: userTurns,
    gitBranch
  }
}

async function* iterSessionFiles(): AsyncGenerator<{
  file: string
  fallbackCwd: string
}> {
  const root = path.join(app.getPath('home'), '.claude', 'projects')
  let dirs: string[]
  try {
    dirs = await fs.readdir(root)
  } catch {
    return
  }
  for (const dir of dirs) {
    const full = path.join(root, dir)
    let files: string[]
    try {
      files = await fs.readdir(full)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue
      yield { file: path.join(full, f), fallbackCwd: decodeFolderName(dir) }
    }
  }
}

function toSession(p: ParsedSession): ClaudeSession {
  return {
    id: p.id,
    projectPath: p.cwd,
    modifiedAt: p.modifiedAt,
    startedAt: p.startedAt,
    preview: p.preview,
    lastMessage: p.lastMessage,
    messageCount: p.messageCount,
    gitBranch: p.gitBranch,
    customName: namesCache[p.id]
  }
}

let watcher: fsSync.FSWatcher | null = null
let notifyTimer: NodeJS.Timeout | null = null

function startWatching() {
  if (watcher) return
  const root = path.join(app.getPath('home'), '.claude', 'projects')
  try {
    fsSync.mkdirSync(root, { recursive: true })
    console.log('[sessions] watching:', root)
    watcher = fsSync.watch(root, { recursive: true }, (event, filename) => {
      console.log('[sessions] fs event:', event, filename)
      // Debounce: many writes hit in quick succession while a session is active
      if (notifyTimer) clearTimeout(notifyTimer)
      notifyTimer = setTimeout(() => {
        notifyTimer = null
        const wins = BrowserWindow.getAllWindows()
        console.log('[sessions] notifying', wins.length, 'window(s)')
        for (const win of wins) {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.sessionsChanged)
          }
        }
      }, 800)
    })
    watcher.on('error', (err) => {
      console.error('[sessions] watcher error:', err)
    })
  } catch (err) {
    console.error('[sessions] failed to start watcher:', err)
  }
}

export function registerSessionHandlers() {
  startWatching()

  ipcMain.handle(
    IPC.sessionsList,
    async (_evt, projectPath: string): Promise<ClaudeSession[]> => {
      const target = path.resolve(projectPath)
      const out: ClaudeSession[] = []
      for await (const { file, fallbackCwd } of iterSessionFiles()) {
        const parsed = await parseSessionFile(file, fallbackCwd)
        if (!parsed || parsed.messageCount === 0) continue
        if (path.resolve(parsed.cwd) !== target) continue
        out.push(toSession(parsed))
      }
      out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      return out
    }
  )

  // 永久删除某个会话的 .jsonl 文件
  ipcMain.handle(
    IPC.sessionsDelete,
    async (
      _evt,
      payload: { id: string }
    ): Promise<{ ok: boolean; error?: string }> => {
      const id = payload?.id
      // 防止路径穿越：只允许 UUID 风格字符
      if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) {
        return { ok: false, error: 'invalid session id' }
      }
      const root = path.join(app.getPath('home'), '.claude', 'projects')
      let dirs: string[]
      try {
        dirs = await fs.readdir(root)
      } catch {
        return { ok: false, error: 'projects dir missing' }
      }
      for (const dir of dirs) {
        const candidate = path.join(root, dir, `${id}.jsonl`)
        try {
          await fs.unlink(candidate)
          console.log('[sessions] deleted:', candidate)
          return { ok: true }
        } catch {
          // 不在这个目录里，继续找
        }
      }
      return { ok: false, error: 'session file not found' }
    }
  )

  // 重命名会话（设置自定义名称）
  ipcMain.handle(
    IPC.sessionsRename,
    async (
      _evt,
      payload: { id: string; name: string }
    ): Promise<{ ok: boolean }> => {
      const { id, name } = payload ?? {}
      if (!id) return { ok: false }
      if (name) {
        namesCache[id] = name
      } else {
        delete namesCache[id]
      }
      saveNames()
      // 通知前端刷新
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IPC.sessionsChanged)
      }
      return { ok: true }
    }
  )

  // 一次性返回所有会话，按 cwd 分组，便于扁平化展示
  ipcMain.handle(
    IPC.sessionsListAll,
    async (): Promise<Record<string, ClaudeSession[]>> => {
      const grouped: Record<string, ClaudeSession[]> = {}
      for await (const { file, fallbackCwd } of iterSessionFiles()) {
        const parsed = await parseSessionFile(file, fallbackCwd)
        if (!parsed || parsed.messageCount === 0) continue
        const key = path.resolve(parsed.cwd)
        ;(grouped[key] ||= []).push(toSession(parsed))
      }
      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      }
      return grouped
    }
  )
}

function decodeFolderName(name: string): string {
  // Claude Code 把 "/" 替换成 "-"，无损还原通常需要 cwd 字段做兜底。
  if (name.startsWith('-')) return '/' + name.slice(1).replace(/-/g, '/')
  return name.replace(/-/g, '/')
}
