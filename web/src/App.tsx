import { useEffect, useState } from 'react'
import { IncidentsScreen } from './components/IncidentsScreen'
import { MethodScreen } from './components/MethodScreen'
import { StatusScreen } from './components/StatusScreen'
import { loadRuns } from './lib/data'
import type { RunRecord } from './lib/status'

type Route = 'status' | 'incidents' | 'method'
type LoadState = 'loading' | 'ready' | 'error'

const NAV: Array<{ route: Route; label: string }> = [
  { route: 'status', label: 'Status' },
  { route: 'incidents', label: 'Incidents' },
  { route: 'method', label: 'Method' },
]

function readRoute(): Route {
  const value = window.location.hash.replace(/^#\/?/, '')
  return value === 'incidents' || value === 'method' ? value : 'status'
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        const next = await loadRuns()
        if (!active) return
        setRuns(next)
        setNow(Date.now())
        setLoadState('ready')
        setMessage('')
      } catch (error) {
        if (!active) return
        setLoadState('error')
        setMessage(error instanceof Error ? error.message : 'Could not read run history')
      }
    }

    void refresh()
    const clock = window.setInterval(() => setNow(Date.now()), 30_000)
    const poll = window.setInterval(() => void refresh(), 60_000)
    return () => {
      active = false
      window.clearInterval(clock)
      window.clearInterval(poll)
    }
  }, [])

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="#/status" aria-label="Tally status home">
            <span className="serif">tally</span>
            <span className="brand-dot">.</span>
            <span className="brand-name">endpoint record</span>
          </a>
          <nav className="nav" aria-label="Primary navigation">
            {NAV.map((item) => (
              <a
                key={item.route}
                className="nav-link"
                href={`#/${item.route}`}
                aria-current={route === item.route ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="shell page" id="main">
        {loadState === 'loading' && <p className="loading">Reading run history…</p>}
        {loadState === 'error' && (
          <div className="error-state">
            Run history could not be read. {message}
          </div>
        )}
        {loadState === 'ready' && route === 'status' && <StatusScreen runs={runs} now={now} />}
        {loadState === 'ready' && route === 'incidents' && (
          <IncidentsScreen runs={runs} now={now} />
        )}
        {loadState === 'ready' && route === 'method' && <MethodScreen />}
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <span>Tally · a public record of scheduled checks</span>
          <a href="https://github.com/Sachin-Singh-Tanwar/tally/tree/data/runs">
            Run history on the data branch ↗
          </a>
        </div>
      </footer>
    </>
  )
}
