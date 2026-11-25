import { absoluteTime, formatDuration } from '../lib/format'
import { buildIncidents, type RunRecord } from '../lib/status'

export function IncidentsScreen({ runs, now }: { runs: RunRecord[]; now: number }) {
  const incidents = buildIncidents(runs, now)
  const resolved = incidents.filter((incident) => incident.resolved)
  const averageMttr =
    resolved.length === 0
      ? null
      : resolved.reduce((sum, incident) => sum + (incident.mttrMs ?? 0), 0) / resolved.length

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Incident log</p>
        <h1 className="hero-title">
          <span className="serif">incidents.</span>
        </h1>
        <p className="hero-caption">
          A consecutive run of failed checks for one target. Duration is recovery time minus
          the first failure; an open incident has no MTTR until it closes.
        </p>
        <div className="hero-meta">
          <div className="meta-item">
            <span className="meta-label">Recorded incidents</span>
            <span className="meta-value mono">{incidents.length}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Resolved</span>
            <span className="meta-value mono">{resolved.length}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Average MTTR</span>
            <span className="meta-value mono">{formatDuration(averageMttr)}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Newest first</p>
            <h2>
              Failure <span className="serif">streaks.</span>
            </h2>
          </div>
          <p className="section-note">
            Staged demo failures carry a badge. They are never presented as real outages.
          </p>
        </div>

        {incidents.length === 0 ? (
          <div className="empty-state">
            <strong>No incidents recorded since {runs[0] ? absoluteTime(runs[0].ts) : 'the first run'}.</strong>
          </div>
        ) : (
          <div className="incident-list">
            {incidents.map((incident) => (
              <article className="incident" key={incident.id}>
                <div className="incident-top">
                  <span className="incident-target mono">{incident.target}</span>
                  <span>
                    <span className={`chip ${incident.resolved ? 'chip--operational' : 'chip--down'}`}>
                      {incident.resolved ? 'resolved' : 'ongoing'}
                    </span>
                    {incident.staged && <span className="badge-staged">STAGED DEMO</span>}
                  </span>
                </div>
                <div className="incident-facts">
                  <div>
                    <span>Started</span>
                    <strong className="mono">{absoluteTime(incident.start)}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong className="mono">{formatDuration(incident.durationMs)}</strong>
                  </div>
                  <div>
                    <span>MTTR</span>
                    <strong className="mono">
                      {incident.mttrMs === null ? '—' : formatDuration(incident.mttrMs)}
                    </strong>
                  </div>
                  <div>
                    <span>Affected target</span>
                    <strong>{incident.target}</strong>
                  </div>
                  <div>
                    <span>Failed runs</span>
                    <strong className="mono">{incident.failureCount}</strong>
                  </div>
                  <div>
                    <span>Recovered</span>
                    <strong className="mono">
                      {incident.end === null ? 'not yet' : absoluteTime(incident.end)}
                    </strong>
                  </div>
                </div>
                <p className="incident-reason">{incident.reason}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
