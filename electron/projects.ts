import { ipcMain, app } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '../shared/ipc'
import type { Project } from '../shared/ipc'

type Store = { projects: Project[] }

function storePath() {
  return path.join(app.getPath('userData'), 'projects.json')
}

function load(): Store {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Store
    if (!Array.isArray(parsed.projects)) return { projects: [] }
    return parsed
  } catch {
    return { projects: [] }
  }
}

function save(store: Store) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true })
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf-8')
}

export function registerProjectHandlers() {
  ipcMain.handle(IPC.projectsList, async () => {
    return load().projects
  })

  ipcMain.handle(
    IPC.projectsAdd,
    async (
      _evt,
      input: Omit<Project, 'id' | 'createdAt'>
    ): Promise<Project> => {
      const store = load()
      const exists = store.projects.find((p) => p.path === input.path)
      if (exists) return exists
      const project: Project = {
        id: randomUUID(),
        createdAt: Date.now(),
        ...input
      }
      store.projects.unshift(project)
      save(store)
      return project
    }
  )

  ipcMain.handle(IPC.projectsRemove, async (_evt, id: string) => {
    const store = load()
    store.projects = store.projects.filter((p) => p.id !== id)
    save(store)
  })

  ipcMain.handle(
    IPC.projectsUpdate,
    async (
      _evt,
      { id, patch }: { id: string; patch: Partial<Project> }
    ) => {
      const store = load()
      const idx = store.projects.findIndex((p) => p.id === id)
      if (idx === -1) return null
      store.projects[idx] = { ...store.projects[idx], ...patch, id }
      save(store)
      return store.projects[idx]
    }
  )
}
