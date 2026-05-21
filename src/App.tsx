import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { TerminalsView } from './components/TerminalsView'
import { SettingsView } from './components/SettingsView'
import { useStore } from './store/useStore'

export default function App() {
  const view = useStore((s) => s.view)
  const setProjects = useStore((s) => s.setProjects)

  useEffect(() => {
    window.claudex.projects.list().then(setProjects).catch(console.error)
  }, [setProjects])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {view === 'terminals' && <TerminalsView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
