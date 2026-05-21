import { useEffect, useMemo, useState } from 'react'
import {
  FolderOpen,
  FolderPlus,
  Plus,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  MessageSquare
} from 'lucide-react'
import type { ClaudeSession, Project } from '@shared/ipc'
import { useStore } from '../store/useStore'
import { v4 as uuid } from '../lib/uuid'
import path from '../lib/path'
import { cn } from '../lib/cn'

type SessionMap = Record<string, ClaudeSession[]>

function hueFromString(s: string): number {
  // 简单 djb2 hash → 0..359，足够把不同 sessionId 映射到不同色相
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

function snippet(text: string | undefined, max = 14): string {
  if (!text) return ''
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!t) return ''
  const diff = Date.now() - t
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return '刚刚'
  if (diff < hr) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hr)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

export function Sidebar() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const tabCount = useStore((s) => s.tabs.length)
  const projects = useStore((s) => s.projects)
  const setProjects = useStore((s) => s.setProjects)
  const upsertProject = useStore((s) => s.upsertProject)
  const removeProject = useStore((s) => s.removeProject)
  const addTab = useStore((s) => s.addTab)

  const [allSessions, setAllSessions] = useState<SessionMap>({})
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')

  const loadSessions = async () => {
    setLoading(true)
    try {
      const map = await window.claudex.sessions.listAll()
      setAllSessions(map)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const refresh = async () => {
    const list = await window.claudex.projects.list()
    setProjects(list)
    await loadSessions()
  }

  const sessionsFor = (p: Project): ClaudeSession[] => {
    const exact = allSessions[p.path] ?? []
    if (exact.length > 0) return exact
    const norm = p.path.replace(/\/+$/, '')
    return allSessions[norm] ?? []
  }

  const orphanGroups = useMemo(() => {
    const known = new Set(
      projects.flatMap((p) => [p.path, p.path.replace(/\/+$/, '')])
    )
    return Object.entries(allSessions)
      .filter(([cwd]) => !known.has(cwd))
      .map(([cwd, list]) => ({ cwd, list }))
      .sort(
        (a, b) =>
          new Date(b.list[0]?.modifiedAt ?? 0).getTime() -
          new Date(a.list[0]?.modifiedAt ?? 0).getTime()
      )
  }, [allSessions, projects])

  const totalSessions = useMemo(
    () => Object.values(allSessions).reduce((n, x) => n + x.length, 0),
    [allSessions]
  )

  const sortedProjects = useMemo(
    () =>
      projects.slice().sort((a, b) => {
        const af = sessionsFor(a)
        const bf = sessionsFor(b)
        const aLast = Math.max(
          a.lastOpenedAt ?? 0,
          new Date(af[0]?.modifiedAt ?? 0).getTime()
        )
        const bLast = Math.max(
          b.lastOpenedAt ?? 0,
          new Date(bf[0]?.modifiedAt ?? 0).getTime()
        )
        return Number(!!b.favorite) - Number(!!a.favorite) || bLast - aLast
      }),
    [projects, allSessions] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const filterText = filter.trim().toLowerCase()
  const matchesFilter = (s: string | undefined) =>
    !filterText || (s ?? '').toLowerCase().includes(filterText)

  const toggle = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  const addProject = async () => {
    const dir = await window.claudex.projects.pickDir()
    if (!dir) return
    const p = await window.claudex.projects.add({
      name: path.basename(dir),
      path: dir
    })
    upsertProject(p)
  }

  const adoptOrphan = async (cwd: string) => {
    const p = await window.claudex.projects.add({
      name: path.basename(cwd),
      path: cwd
    })
    upsertProject(p)
  }

  const launchProject = (project: Project, session?: ClaudeSession) => {
    const preview = session?.preview
    const title = session
      ? `${project.name} · ${snippet(preview) || session.id.slice(0, 6)}`
      : project.name
    addTab({
      id: uuid(),
      title,
      cwd: project.path,
      projectId: project.id,
      resumeSessionId: session?.id,
      sessionPreview: preview,
      accentHue: hueFromString(session?.id ?? `new:${project.id}:${Date.now()}`),
      status: 'starting'
    })
    window.claudex.projects
      .update(project.id, { lastOpenedAt: Date.now() })
      .then((p) => p && upsertProject(p))
      .catch(console.error)
  }

  const launchByPath = (cwd: string, session?: ClaudeSession) => {
    const base = path.basename(cwd) || cwd
    const preview = session?.preview
    const title = session
      ? `${base} · ${snippet(preview) || session.id.slice(0, 6)}`
      : base
    addTab({
      id: uuid(),
      title,
      cwd,
      resumeSessionId: session?.id,
      sessionPreview: preview,
      accentHue: hueFromString(session?.id ?? `new:${cwd}:${Date.now()}`),
      status: 'starting'
    })
  }

  const onToggleFav = async (p: Project) => {
    const updated = await window.claudex.projects.update(p.id, {
      favorite: !p.favorite
    })
    if (updated) upsertProject(updated)
  }

  const onRemove = async (p: Project) => {
    if (!confirm(`将"${p.name}"从列表中移除？\n（不会删除本地文件）`)) return
    await window.claudex.projects.remove(p.id)
    removeProject(p.id)
  }

  return (
    <aside className="w-[340px] shrink-0 border-r border-border bg-bg-subtle flex flex-col min-h-0">
      {/* 顶部操作区 */}
      <div className="p-2.5 border-b border-border space-y-2 bg-bg-subtle/80 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <button
            onClick={addProject}
            className="btn-primary text-xs flex-1 justify-center"
            title="选择目录添加为项目"
          >
            <Plus size={13} /> 添加项目
          </button>
          <button
            onClick={refresh}
            className="btn px-2"
            title="刷新项目和会话"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索项目或会话内容…"
            className="input h-7 pl-7 pr-2 text-xs"
          />
        </div>
        <div className="text-[10px] text-muted px-0.5">
          {projects.length} 个项目 · {totalSessions} 个会话
          {orphanGroups.length > 0 && ` · ${orphanGroups.length} 个未注册目录`}
        </div>
      </div>

      {/* 项目树 */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {projects.length === 0 && orphanGroups.length === 0 ? (
          <div className="text-center text-muted text-xs p-6">
            还没有项目。
            <br />
            点击 <span className="text-accent">添加项目</span> 开始。
          </div>
        ) : (
          <>
            {sortedProjects.map((p) => {
              const list = sessionsFor(p)
              const visible = list.filter(
                (s) =>
                  matchesFilter(s.preview) ||
                  matchesFilter(s.lastMessage) ||
                  matchesFilter(p.name) ||
                  matchesFilter(p.path)
              )
              if (
                filterText &&
                !matchesFilter(p.name) &&
                !matchesFilter(p.path) &&
                visible.length === 0
              ) {
                return null
              }
              return (
                <ProjectNode
                  key={p.id}
                  project={p}
                  sessions={visible}
                  totalSessions={list.length}
                  collapsed={!!collapsed[p.id]}
                  onToggle={() => toggle(p.id)}
                  onLaunch={() => launchProject(p)}
                  onResume={(s) => launchProject(p, s)}
                  onToggleFav={() => onToggleFav(p)}
                  onRemove={() => onRemove(p)}
                />
              )
            })}

            {orphanGroups.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border">
                <div className="flex items-center gap-1.5 px-1.5 mb-1.5 text-[10px] uppercase tracking-wider text-muted">
                  <FolderPlus size={11} />
                  未注册的目录
                </div>
                {orphanGroups
                  .filter(
                    ({ cwd, list }) =>
                      matchesFilter(cwd) ||
                      list.some(
                        (s) =>
                          matchesFilter(s.preview) ||
                          matchesFilter(s.lastMessage)
                      )
                  )
                  .map(({ cwd, list }) => (
                    <OrphanNode
                      key={cwd}
                      cwd={cwd}
                      sessions={list}
                      collapsed={!!collapsed[`orphan:${cwd}`]}
                      onToggle={() => toggle(`orphan:${cwd}`)}
                      onAdopt={() => adoptOrphan(cwd)}
                      onResume={(s) => launchByPath(cwd, s)}
                      onLaunch={() => launchByPath(cwd)}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部视图切换 */}
      <div className="border-t border-border p-1.5 flex gap-1">
        <SidebarTab
          active={view === 'terminals'}
          onClick={() => setView('terminals')}
          icon={<Terminal size={13} />}
          label="终端"
          badge={tabCount > 0 ? tabCount : undefined}
        />
        <SidebarTab
          active={view === 'settings'}
          onClick={() => setView('settings')}
          icon={<Settings2 size={13} />}
          label="设置"
        />
      </div>
    </aside>
  )
}

function SidebarTab({
  active,
  onClick,
  icon,
  label,
  badge
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors',
        active
          ? 'bg-bg-panel border border-border shadow-sm text-ink'
          : 'text-ink-soft hover:bg-bg-hover hover:text-ink'
      )}
    >
      <span className={active ? 'text-accent' : ''}>{icon}</span>
      <span>{label}</span>
      {badge !== undefined && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
          {badge}
        </span>
      )}
    </button>
  )
}

function ProjectNode({
  project,
  sessions,
  totalSessions,
  collapsed,
  onToggle,
  onLaunch,
  onResume,
  onToggleFav,
  onRemove
}: {
  project: Project
  sessions: ClaudeSession[]
  totalSessions: number
  collapsed: boolean
  onToggle: () => void
  onLaunch: () => void
  onResume: (s: ClaudeSession) => void
  onToggleFav: () => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-border bg-bg-panel overflow-hidden">
      <header className="group flex items-center gap-1 px-1.5 py-1.5 hover:bg-bg-hover/40">
        <button
          onClick={onToggle}
          className="text-muted hover:text-ink p-0.5"
          title={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <FolderOpen size={13} className="text-accent shrink-0" />
        <button
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
          title={project.path}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{project.name}</span>
            {project.favorite && (
              <Star size={10} className="text-amber-500 fill-amber-500 shrink-0" />
            )}
            <span className="text-[10px] text-muted shrink-0">
              {totalSessions}
            </span>
          </div>
          <div className="text-[10px] text-muted font-mono truncate">
            {project.path}
          </div>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <IconBtn
            onClick={onToggleFav}
            title="收藏 / 取消收藏"
            icon={
              <Star
                size={12}
                className={
                  project.favorite ? 'fill-amber-500 text-amber-500' : ''
                }
              />
            }
          />
          <IconBtn
            onClick={() => window.claudex.shell.openPath(project.path)}
            title="在 Finder 中打开"
            icon={<ExternalLink size={12} />}
          />
          <IconBtn
            onClick={onRemove}
            title="从列表中移除"
            icon={<Trash2 size={12} />}
            danger
          />
        </div>
        <button
          onClick={onLaunch}
          className="text-[11px] px-1.5 py-0.5 rounded text-accent hover:bg-accent/15 shrink-0 inline-flex items-center gap-1"
          title="新建一个会话"
        >
          <Play size={11} /> 新会话
        </button>
      </header>

      {!collapsed && (
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="text-[11px] text-muted px-2 py-2">
              暂无历史会话
            </div>
          ) : (
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onResume={() => onResume(s)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function OrphanNode({
  cwd,
  sessions,
  collapsed,
  onToggle,
  onAdopt,
  onResume,
  onLaunch
}: {
  cwd: string
  sessions: ClaudeSession[]
  collapsed: boolean
  onToggle: () => void
  onAdopt: () => void
  onResume: (s: ClaudeSession) => void
  onLaunch: () => void
}) {
  return (
    <div className="rounded-md border border-dashed border-border mb-2 overflow-hidden">
      <header className="group flex items-center gap-1 px-1.5 py-1.5 hover:bg-bg-hover/40">
        <button
          onClick={onToggle}
          className="text-muted hover:text-ink p-0.5"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <FolderOpen size={13} className="text-muted shrink-0" />
        <button onClick={onToggle} className="min-w-0 flex-1 text-left" title={cwd}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm truncate text-ink-soft">
              {path.basename(cwd) || cwd}
            </span>
            <span className="text-[10px] text-muted shrink-0">
              {sessions.length}
            </span>
          </div>
          <div className="text-[10px] text-muted font-mono truncate">{cwd}</div>
        </button>
        <button
          onClick={onAdopt}
          className="text-[11px] px-1.5 py-0.5 rounded text-accent hover:bg-accent/15 shrink-0 inline-flex items-center gap-1"
          title="添加为项目"
        >
          <Plus size={11} /> 加入
        </button>
        <button
          onClick={onLaunch}
          className="text-[11px] px-1.5 py-0.5 rounded text-ink-soft hover:bg-bg-hover shrink-0 inline-flex items-center gap-1"
          title="在该目录启动新会话"
        >
          <Play size={11} />
        </button>
      </header>
      {!collapsed && (
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {sessions.slice(0, 5).map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              onResume={() => onResume(s)}
            />
          ))}
          {sessions.length > 5 && (
            <div className="text-[10px] text-muted px-2 py-1">
              还有 {sessions.length - 5} 个会话…加入项目后查看完整列表
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SessionRow({
  session,
  onResume
}: {
  session: ClaudeSession
  onResume: () => void
}) {
  const turns = session.messageCount ?? 0
  return (
    <button
      onClick={onResume}
      className="w-full text-left flex items-start gap-1.5 px-1.5 py-1.5 rounded border border-transparent hover:border-border hover:bg-bg-subtle transition-colors group"
      title="点击恢复该会话"
    >
      <MessageSquare size={11} className="mt-1 text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink line-clamp-2 leading-snug">
          {session.preview || (
            <span className="text-muted">（没有用户消息）</span>
          )}
        </div>
        {session.lastMessage && (
          <div className="text-[11px] text-ink-soft mt-0.5 line-clamp-1">
            <span className="text-muted">最近：</span>
            {session.lastMessage}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted">
          <span>{formatRelative(session.modifiedAt)}</span>
          <span>·</span>
          <span>{turns} 轮</span>
          {session.gitBranch && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5 truncate max-w-[100px]">
                <GitBranch size={9} />
                {session.gitBranch}
              </span>
            </>
          )}
        </div>
      </div>
      <Play
        size={11}
        className="mt-1 text-muted opacity-0 group-hover:opacity-100 shrink-0"
      />
    </button>
  )
}

function IconBtn({
  onClick,
  title,
  icon,
  danger
}: {
  onClick: () => void
  title: string
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded text-muted hover:bg-bg-hover',
        danger ? 'hover:text-red-500' : 'hover:text-ink'
      )}
    >
      {icon}
    </button>
  )
}
