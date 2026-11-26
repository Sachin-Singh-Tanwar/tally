import { Sparkline } from './Sparkline'
import { StatusChip } from './StatusChip'
import { absoluteTime, formatDuration, formatUptime, relativeTime } from '../lib/format'
import {
  averageLatency,
  buildIncidents,
  lastOkAt,
  lastRuns,
  measuredFrom,
  overallState,
  TARGETS,
  targetState,
  uptimePercent,
  type RunRecord,
} from '../lib/status'

const WINDOWS = [
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
]

const URLS: Record<string, string> = {
  portfolio: 'sachin-singh-tanwar.github.io',
  gh_api: 'api.github.com/rate_limit',
  apify_api: 'api.apify.com/v2/store',
}

export function StatusScreen({ runs, now }: { runs: RunRecord[]; now: number }) {
  const overall = overallState(runs, now)
  const latest = runs[runs.length - 1] ?? null
  const first = runs[0] ?? null
  const incidents = buildIncidents(runs, now)
  const openIncidents = incidents.filter((incident) => !incident.resolved)
  const baseline = measuredFrom(runs)
  const measuredRuns =
    baseline === null ? [] : runs.filter((record) => Date.parse(record.ts) >= baseline)

  const titleClass =
    overall === 'DOWN'
      ? 'is-down'
      : overall === 'DEGRADED'
        ? 'is-degraded'
        : overall === 'NEVER_RAN'
          ? 'is-never'
          : ''

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Public endpoint record</p>
        <h1 className={`hero-title ${titleClass}`}>
          <span className="serif">{overall.toLowerCase()}</span>
        </h1>
        <p className="hero-caption">
          Last recorded run{' '}
          <strong className="hero-relative mono">
            {latest ? relativeTime(Date.parse(latest.ts), now) : 'no runs recorded'}
          </strong>
          . Every figure on this page is calculated from the run history, not set by hand.
        </p>
        <div className="hero-meta">
          <div className="meta-item">
            <span className="meta-label">Last run at</span>
            <span className="meta-value mono">
              {latest ? absoluteTime(latest.ts) : '—'}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">First run at</span>
            <span className="meta-value mono">{first ? absoluteTime(first.ts) : '—'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Open incidents</span>
            <span className="meta-value">{openIncidents.length}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Expected interval</span>
            <span className="meta-value">30 min · external trigger</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Uptime</p>
            <h2>
              Success rate by <span className="serif">window.</span>
            </h2>
          </div>
          <p className="section-note">
            ok records divided by all records inside each window since measured_since, counted
            from the data branch.
          </p>
        </div>
        <div className="panel uptime-scroll">
          <table className="uptime-table">
            <thead>
              <tr>
                <th scope="col">Target</th>
                {WINDOWS.map((window) => (
                  <th key={window.label} scope="col">
                    {window.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TARGETS.map((target) => (
                <tr key={target}>
                  <td>{target}</td>
                  {WINDOWS.map((window) => (
                    <td key={window.label} className="mono">
                      {formatUptime(uptimePercent(measuredRuns, target, window.ms, now))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Targets</p>
            <h2>
              Three endpoints, <span className="serif">one record.</span>
            </h2>
          </div>
          <p className="section-note">
            State comes from the age of the most recent successful check. Bars show the last
            48 runs for each target; red bars are failures.
          </p>
        </div>
        <div className="panel">
          {TARGETS.map((target) => {
            const state = targetState(runs, target, now)
            const lastOk = lastOkAt(runs, target)
            const latency = averageLatency(runs, target, now)
            const history = lastRuns(runs, target, 48)
            return (
              <div className="target-row" key={target}>
                <div className="target-name">
                  <strong>{target}</strong>
                  <span className="mono">{URLS[target]}</span>
                </div>
                <StatusChip state={state} />
                <div className="target-fact">
                  <span>Last ok</span>
                  <strong className="mono">
                    {lastOk === null ? 'never' : relativeTime(lastOk, now)}
                  </strong>
                </div>
                <div className="target-fact">
                  <span>Avg latency · 24h</span>
                  <strong className="mono">
                    {latency === null ? '—' : `${latency} ms`}
                  </strong>
                </div>
                <Sparkline runs={history} />
                {history.some((record) => record.staged) && (
                  <span className="badge-staged">STAGED DEMO</span>
                )}
              </div>
            )
          })}
        </div>
        {openIncidents.some((incident) => !incident.resolved && incident.durationMs !== null) && (
          <p className="section-note" style={{ marginTop: 14 }}>
            Open incident duration: {formatDuration(openIncidents[0].durationMs)} · see the
            incidents page for the full record.
          </p>
        )}
      </section>
    </>
  )
}
