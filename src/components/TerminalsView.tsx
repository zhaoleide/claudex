import { Plus, X, Folder, RotateCcw } from 'lucide-react'
import { useStore, type Tab } from '../store/useStore'
import { TerminalPane } from './Terminal'
import { cn } from '../lib/cn'
import { useState } from 'react'
import { NewTerminalDialog } from './NewTerminalDialog'

function statusColor(status: Tab['status']): string {
  if (status === 'running') return '#10b981' // emerald-500
  if (status === 'starting') return '#f59e0b' // amber-500
  return '#94a3b8' // slate-400
}

function hueColor(hue: number | undefined, alpha = 1): string {
  if (hue === undefined) return `rgba(148,163,184,${alpha})`
  return `hsla(${hue}, 70%, 55%, ${alpha})`
}

export function TerminalsView() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const removeTab = useStore((s) => s.removeTab)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-stretch gap-1 px-2 py-1.5 border-b border-border bg-bg-subtle overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeTabId
          const isResume = !!t.resumeSessionId
          const tooltip = [
            t.cwd,
            t.resumeSessionId ? `恢复会话 ${t.resumeSessionId}` : '新会话',
            t.sessionPreview ? `首句：${t.sessionPreview}` : null
          ]
            .filter(Boolean)
            .join('\n')
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'group relative flex items-stretch gap-2 pl-2.5 pr-1.5 py-1 rounded-md whitespace-nowrap border min-w-[140px] max-w-[260px] text-left',
                active
                  ? 'bg-bg-panel border-border-strong text-ink shadow-sm'
                  : 'border-transparent text-ink-soft hover:bg-bg-hover hover:text-ink'
              )}
              title={tooltip}
            >
              {/* 左侧色条：基于 sessionId hash 的稳定色相 */}
              <span
                className="self-stretch w-0.5 rounded-full shrink-0"
                style={{ backgroundColor: hueColor(t.accentHue, active ? 1 : 0.55) }}
              />
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  {isResume && (
                    <RotateCcw
                      size={10}
                      className="text-muted shrink-0"
                      strokeWidth={2.5}
                    />
                  )}
                  <span className="text-xs font-medium truncate">
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor(t.status) }}
                  />
                  <span className="truncate">
                    {isResume
                      ? `恢复 · ${t.resumeSessionId?.slice(0, 6) ?? ''}`
                      : t.cwd.split('/').slice(-1)[0] || t.cwd}
                  </span>
                </div>
              </div>
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(t.id)
                }}
                className="self-start mt-1 p-0.5 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-bg-hover shrink-0"
                title="关闭该会话"
              >
                <X size={11} />
              </span>
            </button>
          )
        })}
        <button
          onClick={() => setShowNew(true)}
          className="ml-1 flex items-center gap-1 px-2.5 rounded-md text-xs text-ink-soft hover:bg-bg-hover hover:text-ink shrink-0"
        >
          <Plus size={13} /> 新建会话
        </button>
      </div>

      <div className="relative flex-1 min-h-0 bg-bg-panel">
        {tabs.length === 0 ? (
          <EmptyState onNew={() => setShowNew(true)} />
        ) : (
          tabs.map((t) => (
            <TerminalPane key={t.id} tab={t} isActive={t.id === activeTabId} />
          ))
        )}
      </div>

      {showNew && <NewTerminalDialog onClose={() => setShowNew(false)} />}
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-3">
      <Folder size={32} className="text-border-strong" />
      <p className="text-sm">还没有运行中的会话</p>
      <button onClick={onNew} className="btn-primary">
        <Plus size={14} /> 新建一个 Claude 会话
      </button>
    </div>
  )
}
