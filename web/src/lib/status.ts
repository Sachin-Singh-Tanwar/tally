export const INTERVAL_MS = 30 * 60 * 1000
// GitHub Actions cron is best-effort: a late or dropped scheduled run is not an outage.
// Allow four 30-minute slots (2h) before DOWN; ~3 missed slot boundaries is the same window.
export const DEGRADED_AFTER_MS = 2 * INTERVAL_MS
export const DOWN_AFTER_MS = 4 * INTERVAL_MS
export const STAGED_ERROR = 'STAGED DEMO FAILURE'

export const TARGETS = ['portfolio', 'gh_api', 'apify_api'] as const

export interface RunRecord {
  ts: string
  target: string
  ok: boolean
  latency_ms: number
  status_code: number | null
  error: string | null
  staged: boolean
  event?: string
}

export type State = 'OPERATIONAL' | 'DEGRADED' | 'DOWN' | 'NEVER_RAN'

export interface Incident {
  id: string
  target: string
  start: number
  end: number | null
  durationMs: number | null
  mttrMs: number | null
  failureCount: number
  reason: string
  staged: boolean
  resolved: boolean
}

function recordedAt(record: RunRecord): number {
  return Date.parse(record.ts)
}

export function measuredFrom(runs: RunRecord[]): number | null {
  let earliest: number | null = null
  for (const record of runs) {
    if (record.event !== 'schedule') continue
    const at = recordedAt(record)
    if (Number.isNaN(at)) continue
    if (earliest === null || at < earliest) earliest = at
  }
  return earliest
}

export function lastOkAt(runs: RunRecord[], target: string): number | null {
  let latest: number | null = null
  for (const record of runs) {
    if (record.target !== target || !record.ok) continue
    const at = recordedAt(record)
    if (Number.isNaN(at)) continue
    if (latest === null || at > latest) latest = at
  }
  return latest
}

export function targetState(runs: RunRecord[], target: string, now: number): State {
  const lastOk = lastOkAt(runs, target)
  if (lastOk === null) return 'NEVER_RAN'
  const age = Math.max(0, now - lastOk)
  if (age <= DEGRADED_AFTER_MS) return 'OPERATIONAL'
  if (age <= DOWN_AFTER_MS) return 'DEGRADED'
  return 'DOWN'
}

export function overallState(runs: RunRecord[], now: number): State {
  const states = TARGETS.map((target) => targetState(runs, target, now))
  if (states.every((state) => state === 'NEVER_RAN')) return 'NEVER_RAN'
  const comparable = states.map((state) => (state === 'NEVER_RAN' ? 'DEGRADED' : state))
  if (comparable.includes('DOWN')) return 'DOWN'
  if (comparable.includes('DEGRADED')) return 'DEGRADED'
  return 'OPERATIONAL'
}

export function uptimePercent(
  runs: RunRecord[],
  target: string | null,
  windowMs: number,
  now: number,
): number | null {
  const from = now - windowMs
  let total = 0
  let successes = 0
  for (const record of runs) {
    if (record.staged) continue
    if (target !== null && record.target !== target) continue
    const at = recordedAt(record)
    if (Number.isNaN(at) || at < from || at > now) continue
    total += 1
    if (record.ok) successes += 1
  }
  return total === 0 ? null : (successes / total) * 100
}

export function averageLatency(runs: RunRecord[], target: string, now: number): number | null {
  const from = now - 24 * 60 * 60 * 1000
  let total = 0
  let sum = 0
  for (const record of runs) {
    if (record.target !== target || !record.ok) continue
    const at = recordedAt(record)
    if (Number.isNaN(at) || at < from || at > now) continue
    total += 1
    sum += record.latency_ms
  }
  return total === 0 ? null : Math.round(sum / total)
}

export function lastRuns(runs: RunRecord[], target: string, count: number): RunRecord[] {
  return runs
    .filter((record) => record.target === target)
    .sort((a, b) => recordedAt(a) - recordedAt(b))
    .slice(-count)
}

export function buildIncidents(runs: RunRecord[], now: number): Incident[] {
  const byTarget = new Map<string, RunRecord[]>()
  for (const record of runs) {
    const bucket = byTarget.get(record.target) ?? []
    bucket.push(record)
    byTarget.set(record.target, bucket)
  }

  const incidents: Incident[] = []
  for (const [target, history] of byTarget) {
    const ordered = [...history].sort((a, b) => recordedAt(a) - recordedAt(b))
    let streak: RunRecord[] = []

    const close = (recovery: number | null) => {
      if (streak.length === 0) return
      const start = recordedAt(streak[0])
      const end = recovery
      const durationMs = end === null ? Math.max(0, now - start) : Math.max(0, end - start)
      const reason =
        streak.find((record) => Boolean(record.error))?.error ?? 'No failure reason recorded'
      incidents.push({
        id: `${target}-${start}`,
        target,
        start,
        end,
        durationMs,
        mttrMs: end === null ? null : durationMs,
        failureCount: streak.length,
        reason,
        staged: streak.some((record) => record.staged),
        resolved: end !== null,
      })
      streak = []
    }

    for (const record of ordered) {
      if (!record.ok) {
        streak.push(record)
        continue
      }
      close(recordedAt(record))
    }
    close(null)
  }

  return incidents.sort((a, b) => b.start - a.start)
}
