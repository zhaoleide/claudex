import { ipcMain, app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IPC } from '../shared/ipc'
import type { ClaudeSettings, McpServerConfig } from '../shared/ipc'

const claudeDir = () => path.join(app.getPath('home'), '.claude')
const settingsFile = () => path.join(claudeDir(), 'settings.json')
const claudeMdFile = () => path.join(claudeDir(), 'CLAUDE.md')
const mcpFile = () => path.join(claudeDir(), 'mcp.json')

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8')
    if (!raw.trim()) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf-8')
}

export function registerConfigHandlers() {
  ipcMain.handle(IPC.configRead, async (): Promise<ClaudeSettings> => {
    return readJson<ClaudeSettings>(settingsFile(), {})
  })

  ipcMain.handle(
    IPC.configWrite,
    async (_evt, settings: ClaudeSettings) => {
      await writeJson(settingsFile(), settings)
    }
  )

  ipcMain.handle(IPC.configReadClaudeMd, async (): Promise<string> => {
    try {
      return await fs.readFile(claudeMdFile(), 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
      throw err
    }
  })

  ipcMain.handle(IPC.configWriteClaudeMd, async (_evt, text: string) => {
    await fs.mkdir(claudeDir(), { recursive: true })
    await fs.writeFile(claudeMdFile(), text, 'utf-8')
  })

  ipcMain.handle(
    IPC.configReadMcp,
    async (): Promise<Record<string, McpServerConfig>> => {
      // Claude Code stores MCP servers under settings.json -> mcpServers,
      // and also supports a top-level mcp.json. We try mcp.json first,
      // fall back to settings.json's mcpServers field.
      const direct = await readJson<{
        mcpServers?: Record<string, McpServerConfig>
      }>(mcpFile(), {})
      if (direct.mcpServers && Object.keys(direct.mcpServers).length > 0) {
        return direct.mcpServers
      }
      const settings = await readJson<ClaudeSettings & {
        mcpServers?: Record<string, McpServerConfig>
      }>(settingsFile(), {})
      return settings.mcpServers ?? {}
    }
  )

  ipcMain.handle(
    IPC.configWriteMcp,
    async (_evt, servers: Record<string, McpServerConfig>) => {
      // Persist in settings.json (canonical for Claude Code).
      const settings = await readJson<ClaudeSettings & {
        mcpServers?: Record<string, McpServerConfig>
      }>(settingsFile(), {})
      settings.mcpServers = servers
      await writeJson(settingsFile(), settings)
    }
  )
}
