import { describe, expect, it } from 'vitest'
import {
  buildIncidents,
  lastOkAt,
  measuredFrom,
  overallState,
  STAGED_ERROR,
  targetState,
  uptimePercent,
  type RunRecord,
} from './status'

const T0 = Date.parse('2026-11-25T00:00:00Z')
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function record(offsetMinutes: number, ok: boolean, staged = false): RunRecord {
  const at = new Date(T0 + offsetMinutes * MINUTE).toISOString().replace('.000Z', 'Z')
  return {
    ts: at,
    target: 'portfolio',
    ok,
    latency_ms: 220,
    status_code: ok ? 200 : 500,
    error: ok ? null : staged ? STAGED_ERROR : 'HTTP 500',
    staged,
  }
}

describe('status from recorded runs', () => {
  it('moves OPERATIONAL -> DEGRADED -> DOWN from the most recent ok record', () => {
    const runs = [record(0, true)]

    const observed = [
      targetState(runs, 'portfolio', T0 + 10 * MINUTE),
      targetState(runs, 'portfolio', T0 + 70 * MINUTE),
      targetState(runs, 'portfolio', T0 + 125 * MINUTE),
    ]

    expect(observed).toEqual(['OPERATIONAL', 'DEGRADED', 'DOWN'])
    expect(targetState([], 'portfolio', T0)).toBe('NEVER_RAN')
    expect(lastOkAt(runs, 'portfolio')).toBe(T0)
  })

  it('computes incident duration and MTTR from the failure streak', () => {
    const runs = [
      record(0, true),
      record(30, false),
      record(60, false),
      record(90, true),
    ]

    const [incident] = buildIncidents(runs, T0 + 2 * HOUR)

    expect(buildIncidents(runs, T0 + 2 * HOUR)).toHaveLength(1)
    expect(incident.start).toBe(T0 + 30 * MINUTE)
    expect(incident.end).toBe(T0 + 90 * MINUTE)
    expect(incident.durationMs).toBe(60 * MINUTE)
    expect(incident.mttrMs).toBe(60 * MINUTE)
    expect(incident.resolved).toBe(true)
    expect(incident.failureCount).toBe(2)
  })

  it('reports an unresolved streak as ongoing with no MTTR', () => {
    const runs = [record(0, true), record(30, false, true), record(60, false, true)]
    const [incident] = buildIncidents(runs, T0 + 75 * MINUTE)

    expect(incident.resolved).toBe(false)
    expect(incident.durationMs).toBe(45 * MINUTE)
    expect(incident.mttrMs).toBeNull()
    expect(incident.staged).toBe(true)
    expect(incident.reason).toBe(STAGED_ERROR)
  })

  it('derives overall state and uptime from records only', () => {
    const runs = [
      { ...record(0, true), target: 'portfolio' },
      { ...record(30, false), target: 'portfolio' },
      { ...record(0, true), target: 'gh_api' },
      { ...record(30, true), target: 'apify_api' },
    ]
    const now = T0 + 40 * MINUTE

    expect(targetState(runs, 'portfolio', now)).toBe('OPERATIONAL')
    expect(overallState(runs, now)).toBe('OPERATIONAL')
    expect(uptimePercent(runs, 'portfolio', HOUR, now)).toBe(50)
    expect(uptimePercent(runs, null, HOUR, now)).toBe(75)
    expect(uptimePercent([], null, HOUR, now)).toBeNull()
  })

  it('pins the measured window to the first externally scheduled cycle', () => {
    const runs = [record(0, true), { ...record(30, true), event: 'schedule' }]

    expect(measuredFrom(runs)).toBe(T0 + 30 * MINUTE)
    expect(measuredFrom([record(0, true)])).toBeNull()
  })
})
