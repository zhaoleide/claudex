import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, RefreshCw, Info, Download, CheckCircle, AlertCircle } from 'lucide-react'
import type { ClaudeSettings } from '@shared/ipc'

type PermKey = 'allow' | 'deny' | 'ask'
const PERM_KEYS: PermKey[] = ['allow', 'deny', 'ask']
const PERM_LABEL: Record<PermKey, string> = {
  allow: '总是允许',
  deny: '总是拒绝',
  ask: '总是询问'
}

export function SettingsView() {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null)
  const [raw, setRaw] = useState('')
  const [tab, setTab] = useState<'visual' | 'json'>('visual')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Auto update state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; progress?: number; error?: string }>({})

  const load = async () => {
    const s = await window.claudex.config.read()
    setSettings(s)
    setRaw(JSON.stringify(s, null, 2))
    setError(null)
  }

  useEffect(() => {
    load().catch((e) => setError(String(e)))

    // Setup update listeners
    const offAvailable = window.claudex.update.onAvailable((data) => {
      setUpdateStatus('available')
      setUpdateInfo({ version: data.version })
    })
    const offProgress = window.claudex.update.onProgress((data) => {
      setUpdateStatus('downloading')
      setUpdateInfo({ progress: data.percent })
    })
    const offDownloaded = window.claudex.update.onDownloaded((data) => {
      setUpdateStatus('downloaded')
      setUpdateInfo({ version: data.version })
    })
    const offError = window.claudex.update.onError((data) => {
      setUpdateStatus('error')
      setUpdateInfo({ error: data.message })
    })

    return () => {
      offAvailable()
      offProgress()
      offDownloaded()
      offError()
    }
  }, [])

  const save = async (next: ClaudeSettings) => {
    try {
      await window.claudex.config.write(next)
      setSettings(next)
      setRaw(JSON.stringify(next, null, 2))
      setSavedAt(Date.now())
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const saveJson = async () => {
    try {
      const parsed = JSON.parse(raw)
      await save(parsed)
    } catch (e) {
      setError(`Invalid JSON: ${String(e)}`)
    }
  }

  const checkForUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateInfo({})
    const result = await window.claudex.update.check()
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateInfo({ error: result.error })
    }
  }

  const downloadUpdate = async () => {
    setUpdateStatus('downloading')
    setUpdateInfo({ progress: 0 })
    const result = await window.claudex.update.download()
    if (!result.success) {
      setUpdateStatus('error')
      setUpdateInfo({ error: result.error })
    }
  }

  const installUpdate = async () => {
    await window.claudex.update.install()
  }

  if (!settings) {
    return <div className="p-6 text-muted text-sm">加载设置中…</div>
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-base font-medium">全局设置</h2>
          <p className="text-xs text-muted">
            直接修改 <code>~/.claude/settings.json</code> 文件。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-emerald-600">
              已保存：{new Date(savedAt).toLocaleTimeString('zh-CN')}
            </span>
          )}
          <button onClick={load} className="btn">
            <RefreshCw size={13} /> 重新加载
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 pt-3">
        {(['visual', 'json'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              'px-3 py-1.5 text-xs rounded-md transition-colors ' +
              (tab === k
                ? 'bg-bg-panel border border-border text-ink shadow-sm'
                : 'text-muted hover:text-ink')
            }
          >
            {k === 'visual' ? '可视化编辑' : '原始 JSON'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <Info size={13} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
        {/* Auto Update Section */}
        <Section title="应用更新">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-ink">当前版本</div>
                <div className="text-xs text-muted font-mono mt-1">
                  检查更新以获取最新版本
                </div>
              </div>
              <div className="flex items-center gap-2">
                {updateStatus === 'checking' && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <RefreshCw size={12} className="animate-spin" /> 检查中...
                  </span>
                )}
                {updateStatus === 'available' && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Info size={12} /> 发现新版本 {updateInfo.version}
                  </span>
                )}
                {updateStatus === 'downloading' && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Download size={12} /> 下载中 {updateInfo.progress}%
                  </span>
                )}
                {updateStatus === 'downloaded' && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={12} /> 已下载 {updateInfo.version}
                  </span>
                )}
                {updateStatus === 'error' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={12} /> {updateInfo.error}
                  </span>
                )}
                {updateStatus === 'idle' && (
                  <span className="text-xs text-muted">未检查更新</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {updateStatus === 'downloading' && updateInfo.progress !== undefined && (
              <div className="w-full bg-bg-subtle rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${updateInfo.progress}%` }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {(updateStatus === 'idle' || updateStatus === 'error') && (
                <button onClick={checkForUpdate} className="btn">
                  <RefreshCw size={13} /> 检查更新
                </button>
              )}
              {updateStatus === 'available' && (
                <button onClick={downloadUpdate} className="btn-primary">
                  <Download size={13} /> 下载更新
                </button>
              )}
              {updateStatus === 'downloaded' && (
                <button onClick={installUpdate} className="btn-primary">
                  <CheckCircle size={13} /> 重启并安装
                </button>
              )}
              {updateStatus === 'checking' && (
                <button disabled className="btn opacity-50 cursor-not-allowed">
                  <RefreshCw size={13} className="animate-spin" /> 检查中...
                </button>
              )}
              {updateStatus === 'downloading' && (
                <button disabled className="btn opacity-50 cursor-not-allowed">
                  <Download size={13} /> 下载中...
                </button>
              )}
            </div>
          </div>
        </Section>

        {tab === 'visual' ? (
          <>
            <Section title="通用">
              <Field label="默认模型">
                <input
                  className="input"
                  value={(settings.model as string) ?? ''}
                  placeholder="例如 claude-sonnet-4-5（留空使用默认值）"
                  onChange={(e) =>
                    setSettings({ ...settings, model: e.target.value })
                  }
                />
              </Field>
              <Field label="输出风格">
                <input
                  className="input"
                  value={(settings.outputStyle as string) ?? ''}
                  placeholder="default"
                  onChange={(e) =>
                    setSettings({ ...settings, outputStyle: e.target.value })
                  }
                />
              </Field>
              <Field label="API Key 辅助脚本">
                <input
                  className="input font-mono text-xs"
                  value={(settings.apiKeyHelper as string) ?? ''}
                  placeholder="例如 /usr/local/bin/get-anthropic-key"
                  onChange={(e) =>
                    setSettings({ ...settings, apiKeyHelper: e.target.value })
                  }
                />
              </Field>
            </Section>

            <Section title="工具权限">
              <p className="text-xs text-muted mb-2">
                按工具 / 命令模式区分。示例：{' '}
                <code>Bash(git diff:*)</code>、<code>Read(~/.zshrc)</code>。
              </p>
              {PERM_KEYS.map((k) => (
                <PermList
                  key={k}
                  title={PERM_LABEL[k]}
                  items={settings.permissions?.[k] ?? []}
                  onChange={(items) =>
                    setSettings({
                      ...settings,
                      permissions: {
                        ...(settings.permissions ?? {}),
                        [k]: items
                      }
                    })
                  }
                />
              ))}
            </Section>

            <Section title="环境变量">
              <KvEditor
                value={settings.env ?? {}}
                onChange={(env) => setSettings({ ...settings, env })}
                keyPlaceholder="ANTHROPIC_BASE_URL"
                valPlaceholder="https://..."
              />
            </Section>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => save(settings)} className="btn-primary">
                <Save size={13} /> 保存 settings.json
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="input font-mono text-xs h-[60vh]"
              spellCheck={false}
            />
            <div className="flex justify-end">
              <button onClick={saveJson} className="btn-primary">
                <Save size={13} /> 保存原始 JSON
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-4 space-y-3">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {children}
    </section>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="label">{label}</div>
      {children}
    </div>
  )
}

function PermList({
  title,
  items,
  onChange
}: {
  title: string
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <div className="space-y-2 mt-2">
      <div className="text-xs text-ink-soft">{title}</div>
      <div className="flex gap-2">
        <input
          className="input font-mono text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              onChange([...items, draft.trim()])
              setDraft('')
            }
          }}
          placeholder="Bash(git status:*)"
        />
        <button
          onClick={() => {
            if (!draft.trim()) return
            onChange([...items, draft.trim()])
            setDraft('')
          }}
          className="btn"
        >
          <Plus size={13} />
        </button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-bg-subtle text-xs font-mono"
            >
              <span className="truncate">{it}</span>
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-muted hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KvEditor({
  value,
  onChange,
  keyPlaceholder,
  valPlaceholder
}: {
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  keyPlaceholder?: string
  valPlaceholder?: string
}) {
  const entries = Object.entries(value)
  const [k, setK] = useState('')
  const [v, setV] = useState('')

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <div className="text-xs text-muted">暂无环境变量</div>
      )}
      {entries.map(([key, val]) => (
        <div key={key} className="flex gap-2 items-center">
          <input
            className="input font-mono text-xs flex-1"
            value={key}
            onChange={(e) => {
              const next = { ...value }
              delete next[key]
              next[e.target.value] = val
              onChange(next)
            }}
          />
          <input
            className="input font-mono text-xs flex-[2]"
            value={val}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
          <button
            onClick={() => {
              const next = { ...value }
              delete next[key]
              onChange(next)
            }}
            className="btn-ghost p-1 hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="flex gap-2 items-center pt-2 border-t border-border">
        <input
          className="input font-mono text-xs flex-1"
          placeholder={keyPlaceholder ?? 'KEY'}
          value={k}
          onChange={(e) => setK(e.target.value)}
        />
        <input
          className="input font-mono text-xs flex-[2]"
          placeholder={valPlaceholder ?? 'value'}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        <button
          onClick={() => {
            if (!k.trim()) return
            onChange({ ...value, [k.trim()]: v })
            setK('')
            setV('')
          }}
          className="btn"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
