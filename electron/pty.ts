import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import * as nodePty from 'node-pty'
import { IPC } from '../shared/ipc'
import type { LaunchOptions } from '../shared/ipc'

type PtyEntry = {
  id: string
  proc: nodePty.IPty
}

const sessions = new Map<string, PtyEntry>()

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/zsh'
}

function buildEnv(extra?: Record<string, string>): Record<string, string> {
  // node-pty wants all string values
  const merged: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') merged[k] = v
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) merged[k] = v
  }
  // Make TERM pleasant for xterm.js
  merged.TERM = merged.TERM || 'xterm-256color'
  merged.COLORTERM = merged.COLORTERM || 'truecolor'
  return merged
}

export function registerPtyHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC.ptyStart, async (_evt, opts: LaunchOptions) => {
    const id = randomUUID()
    const cols = opts.cols ?? 120
    const rows = opts.rows ?? 32
    const env = buildEnv(opts.env)

    // Strategy: spawn the user's login shell, then `exec claude ...`.
    // This way PATH, nvm, fnm, mise etc. are loaded properly so that
    // `claude` resolves regardless of how the user installed the CLI.
    const shell = defaultShell()
    const command = opts.command ?? 'claude'
    const argv = opts.args ?? []
    const quoted = [command, ...argv]
      .map((s) => `'${String(s).replace(/'/g, `'\\''`)}'`)
      .join(' ')
    const shellArgs =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', `${command} ${argv.join(' ')}`]
        : ['-l', '-i', '-c', `exec ${quoted}`]

    let proc: nodePty.IPty
    try {
      proc = nodePty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: opts.cwd,
        env
      })
    } catch (err) {
      throw new Error(
        `Failed to spawn pty: ${(err as Error).message}. ` +
          `Make sure node-pty is built for your Electron version (run "npm run rebuild").`
      )
    }

    sessions.set(id, { id, proc })

    proc.onData((data) => {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.ptyData, { id, data })
      }
    })

    proc.onExit(({ exitCode, signal }) => {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.ptyExit, { id, code: exitCode, signal })
      }
      sessions.delete(id)
    })

    return { id }
  })

  ipcMain.handle(
    IPC.ptyWrite,
    async (_evt, { id, data }: { id: string; data: string }) => {
      sessions.get(id)?.proc.write(data)
    }
  )

  ipcMain.handle(
    IPC.ptyResize,
    async (
      _evt,
      { id, cols, rows }: { id: string; cols: number; rows: number }
    ) => {
      const s = sessions.get(id)
      if (!s) return
      try {
        s.proc.resize(Math.max(1, cols), Math.max(1, rows))
      } catch {
        /* ignore */
      }
    }
  )

  ipcMain.handle(IPC.ptyKill, async (_evt, { id }: { id: string }) => {
    const s = sessions.get(id)
    if (!s) return
    try {
      s.proc.kill()
    } catch {
      /* ignore */
    }
    sessions.delete(id)
  })
}

export function killAllPtys() {
  for (const s of sessions.values()) {
    try {
      s.proc.kill()
    } catch {
      /* ignore */
    }
  }
  sessions.clear()
}
