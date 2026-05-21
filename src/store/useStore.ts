import { create } from 'zustand'
import type { Project } from '@shared/ipc'

export type Tab = {
  id: string // local tab id (uuid)
  ptyId?: string // assigned after start
  title: string
  cwd: string
  projectId?: string
  resumeSessionId?: string
  /** First-user-message snippet (for "恢复" tabs, used as subtitle) */
  sessionPreview?: string
  /** Stable hue (0..359) derived from sessionId / cwd, drives the dot color */
  accentHue?: number
  command?: string
  args?: string[]
  status: 'starting' | 'running' | 'exited'
  exitCode?: number
}

export type View = 'terminals' | 'settings'

type StoreState = {
  view: View
  setView: (v: View) => void

  projects: Project[]
  setProjects: (p: Project[]) => void
  upsertProject: (p: Project) => void
  removeProject: (id: string) => void

  tabs: Tab[]
  activeTabId: string | null
  addTab: (t: Tab) => void
  updateTab: (id: string, patch: Partial<Tab>) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string | null) => void
}

export const useStore = create<StoreState>((set) => ({
  view: 'terminals',
  setView: (v) => set({ view: v }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  upsertProject: (p) =>
    set((s) => {
      const idx = s.projects.findIndex((x) => x.id === p.id)
      if (idx === -1) return { projects: [p, ...s.projects] }
      const next = s.projects.slice()
      next[idx] = p
      return { projects: next }
    }),
  removeProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  tabs: [],
  activeTabId: null,
  addTab: (t) =>
    set((s) => ({
      tabs: [...s.tabs, t],
      activeTabId: t.id,
      view: 'terminals'
    })),
  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    })),
  removeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      let activeTabId = s.activeTabId
      if (activeTabId === id) {
        activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null
      }
      return { tabs, activeTabId }
    }),
  setActiveTab: (id) => set({ activeTabId: id })
}))
