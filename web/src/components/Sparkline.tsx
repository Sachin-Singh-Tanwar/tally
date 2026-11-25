import type { RunRecord } from '../lib/status'

export function Sparkline({ runs }: { runs: RunRecord[] }) {
  const peak = Math.max(1, ...runs.map((record) => record.latency_ms))
  const failures = runs.filter((record) => !record.ok).length

  return (
    <div className="spark-wrap">
      <div className="spark" aria-hidden="true">
        {runs.map((record, index) => (
          <span
            key={`${record.ts}-${index}`}
            className={`spark-bar${record.ok ? '' : ' spark-bar--fail'}`}
            style={{ height: `${Math.max(14, Math.round((record.latency_ms / peak) * 100))}%` }}
          />
        ))}
      </div>
      <div className="spark-label">
        <span>last {runs.length} runs</span>
        <span>{failures} failed</span>
      </div>
    </div>
  )
}
