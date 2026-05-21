import { useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { v4 as uuid } from '../lib/uuid'
import path from '../lib/path'

type Props = {
  onClose: () => void
  defaultCwd?: string
  defaultProjectId?: string
  defaultResumeSessionId?: string
  defaultTitle?: string
}

export function NewTerminalDialog({
  onClose,
  defaultCwd,
  defaultProjectId,
  defaultResumeSessionId,
  defaultTitle
}: Props) {
  const projects = useStore((s) => s.projects)
  const addTab = useStore((s) => s.addTab)
  const [cwd, setCwd] = useState(defaultCwd ?? projects[0]?.path ?? '')
  const [extraArgs, setExtraArgs] = useState('')
  const [resumeId, setResumeId] = useState(defaultResumeSessionId ?? '')
  const [command, setCommand] = useState('claude')

  const onPick = async () => {
    const dir = await window.claudex.projects.pickDir()
    if (dir) setCwd(dir)
  }

  const onLaunch = () => {
    if (!cwd) return
    const title =
      defaultTitle ??
      path.basename(cwd) + (resumeId ? ' (恢复)' : '')
    const args = extraArgs.trim() ? extraArgs.trim().split(/\s+/) : []
    addTab({
      id: uuid(),
      title,
      cwd,
      command,
      args,
      resumeSessionId: resumeId || undefined,
      projectId: defaultProjectId,
      status: 'starting'
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="card w-[480px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">新建 Claude 会话</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label mb-1 block">工作目录</label>
            <div className="flex gap-2">
              <input
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="/项目/路径"
                className="input font-mono text-xs"
              />
              <button onClick={onPick} className="btn">
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          <div>
            <label className="label mb-1 block">启动命令</label>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="input font-mono text-xs"
            />
            <p className="text-[10px] text-muted mt-1">
              默认使用系统 <code>PATH</code> 中的 <code>claude</code> 命令。
            </p>
          </div>

          <div>
            <label className="label mb-1 block">恢复会话 ID（可选）</label>
            <input
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              placeholder="abc123-..."
              className="input font-mono text-xs"
            />
          </div>

          <div>
            <label className="label mb-1 block">额外启动参数（可选）</label>
            <input
              value={extraArgs}
              onChange={(e) => setExtraArgs(e.target.value)}
              placeholder="--model sonnet"
              className="input font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn">
            取消
          </button>
          <button onClick={onLaunch} disabled={!cwd} className="btn-primary">
            启动
          </button>
        </div>
      </div>
    </div>
  )
}
