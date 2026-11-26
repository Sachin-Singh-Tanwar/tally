import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRuns } from './data'
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

function stubFetch(months: string[], records: Record<string, RunRecord[]> = {}): string[] {
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      requested.push(input)
      if (input.includes('/index.json')) return { ok: true, json: async () => ({ months }) }
      const key = input.match(/\/runs\/(\d{4}-\d{2})\.json/)?.[1] ?? ''
      return { ok: true, json: async () => records[key] ?? [] }
    }),
  )
  return requested
}

const keys = (urls: string[]) =>
  urls.map((url) => url.match(/\/runs\/(index|\d{4}-\d{2})\.json/)?.[1] ?? '?')

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
})
