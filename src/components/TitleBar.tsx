import { Sparkles } from 'lucide-react'

export function TitleBar() {
  return (
    <div className="drag-region h-9 shrink-0 flex items-center justify-center border-b border-border bg-bg-panel text-xs text-ink-soft relative">
      <div className="flex items-center gap-2 no-drag pointer-events-none">
        <Sparkles size={13} className="text-accent" />
        <span className="font-medium tracking-wide">Claudex · Claude Code 桌面管理器</span>
      </div>
    </div>
  )
}
