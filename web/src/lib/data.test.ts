import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadBaseline, loadRuns } from './data'
import type { RunRecord } from './status'

const record: RunRecord = {
  ts: '2026-11-25T16:57:06Z',
  target: 'portfolio',
  ok: true,
  latency_ms: 120,
  status_code: 200,
  error: null,
  staged: false,
  event: 'schedule',
}

function stubFetch(
  months: string[],
  records: Record<string, RunRecord[]> = {},
  meta: { measured_since: string } | null = null,
): string[] {
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      requested.push(input)
      if (input.includes('/index.json')) return { ok: true, json: async () => ({ months }) }
      if (input.includes('/meta.json')) {
        return meta === null
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => meta }
      }
      const key = input.match(/\/runs\/(\d{4}-\d{2})\.json/)?.[1] ?? ''
      return { ok: true, json: async () => records[key] ?? [] }
    }),
  )
  return requested
}

const keys = (urls: string[]) =>
  urls.map((url) => url.match(/\/(index|meta|\d{4}-\d{2})\.json/)?.[1] ?? '?')

describe('loadRuns', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the manifest first, then only the months it lists', async () => {
    const requested = stubFetch(['2026-11'], { '2026-11': [record] })

    const runs = await loadRuns()

    expect(keys(requested)).toEqual(['index', '2026-11'])
    expect(runs).toEqual([record])
  })

  it('never derives months from the clock and honours the floor', async () => {
    const requested = stubFetch(['2026-09', '2026-11'])

    await loadRuns()

    expect(keys(requested)).toEqual(['index', '2026-11'])
  })

  it('requests a new month only once the worker has listed it', async () => {
    const requested = stubFetch(['2026-11', '2026-12'])

    await loadRuns()

    expect(keys(requested)).toEqual(['index', '2026-11', '2026-12'])
  })

  it('does not request meta.json before the first external cycle', async () => {
    const manual = { ...record, event: 'workflow_dispatch' }
    const requested = stubFetch(['2026-11'], { '2026-11': [manual] })

    const baseline = await loadBaseline(await loadRuns())

    expect(baseline).toBeNull()
    expect(keys(requested)).toEqual(['index', '2026-11'])
  })

  it('reads the measured timestamp from meta.json once present', async () => {
    const scheduled = { ...record, event: 'schedule' }
    const requested = stubFetch(
      ['2026-11'],
      { '2026-11': [scheduled] },
      { measured_since: '2026-11-26T13:35:00Z' },
    )

    const baseline = await loadBaseline(await loadRuns())

    expect(baseline).toBe(Date.parse('2026-11-26T13:35:00Z'))
    expect(keys(requested)).toEqual(['index', '2026-11', 'meta'])
  })
})
