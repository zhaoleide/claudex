import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useStore, type Tab } from '../store/useStore'

// 亮色配色，参考 Solarized Light / Anthropic 暖白
const THEME = {
  background: '#fbf8f3',
  foreground: '#2b2a26',
  cursor: '#c4592b',
  cursorAccent: '#fbf8f3',
  selectionBackground: '#e6dcc8',
  black: '#2b2a26',
  red: '#b3361a',
  green: '#3f7d3f',
  yellow: '#a07a14',
  blue: '#2e5fa1',
  magenta: '#8a3a92',
  cyan: '#1f7a85',
  white: '#56544e',
  brightBlack: '#8a8276',
  brightRed: '#c4592b',
  brightGreen: '#5b9a4f',
  brightYellow: '#c08a1c',
  brightBlue: '#3a78c2',
  brightMagenta: '#a8519f',
  brightCyan: '#2f96a3',
  brightWhite: '#1d1c19'
}

type Props = {
  tab: Tab
  isActive: boolean
}

export function TerminalPane({ tab, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(tab.ptyId ?? null)
  const updateTab = useStore((s) => s.updateTab)
  const removeTab = useStore((s) => s.removeTab)

  // Mount xterm + spawn pty exactly once per tab.
  useEffect(() => {
    if (!containerRef.current) return
    const term = new XTerm({
      fontFamily:
        'JetBrains Mono, SF Mono, Menlo, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      letterSpacing: 0,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
      theme: THEME,
      macOptionIsMeta: true
    })
    const fit = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(containerRef.current)
    requestAnimationFrame(() => {
      try {
        fit.fit()
      } catch {
        /* container may not be visible yet */
      }
    })
    termRef.current = term
    fitRef.current = fit

    let disposed = false
    const offData = window.claudex.pty.onData((id, data) => {
      if (id === ptyIdRef.current) term.write(data)
    })
    const offExit = window.claudex.pty.onExit((id, code) => {
      if (id !== ptyIdRef.current) return
      term.writeln(`\r\n\x1b[2m[claude 进程已退出，退出码 ${code}]\x1b[0m`)
      updateTab(tab.id, { status: 'exited', exitCode: code })
    })

    term.onData((data) => {
      if (ptyIdRef.current) {
        window.claudex.pty.write(ptyIdRef.current, data)
      }
    })
    term.onResize(({ cols, rows }) => {
      if (ptyIdRef.current) {
        window.claudex.pty.resize(ptyIdRef.current, cols, rows)
      }
    })

    // Spawn pty if not already attached
    if (!tab.ptyId) {
      const args = tab.resumeSessionId
        ? ['--resume', tab.resumeSessionId, ...(tab.args ?? [])]
        : tab.args ?? []
      window.claudex.pty
        .start({
          cwd: tab.cwd,
          command: tab.command,
          args,
          cols: term.cols,
          rows: term.rows
        })
        .then(({ id }) => {
          if (disposed) {
            window.claudex.pty.kill(id)
            return
          }
          ptyIdRef.current = id
          updateTab(tab.id, { ptyId: id, status: 'running' })
        })
        .catch((err) => {
          term.writeln(`\r\n\x1b[31m${String(err.message ?? err)}\x1b[0m`)
          updateTab(tab.id, { status: 'exited', exitCode: -1 })
        })
    }

    return () => {
      disposed = true
      offData()
      offExit()
      if (ptyIdRef.current) window.claudex.pty.kill(ptyIdRef.current)
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.id])

  // Re-fit on size / activation changes.
  useEffect(() => {
    if (!isActive) return
    const id = window.setTimeout(() => {
      try {
        fitRef.current?.fit()
        termRef.current?.focus()
      } catch {
        /* ignore */
      }
    }, 30)
    return () => window.clearTimeout(id)
  }, [isActive])

  useEffect(() => {
    const onResize = () => {
      try {
        fitRef.current?.fit()
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Auto-remove tab on double-exit click? we just leave it for the user.
  void removeTab

  return (
    <div
      className="absolute inset-0 p-2"
      style={{ visibility: isActive ? 'visible' : 'hidden' }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
