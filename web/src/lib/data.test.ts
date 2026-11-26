import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRuns } from './data'

const record = {
  ts: '2026-11-25T16:57:06Z',
  target: 'portfolio',
  ok: true,
  latency_ms: 120,
  status_code: 200,
  error: null,
  staged: false,
}

describe('loadRuns', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not request months before the data branch starts', async () => {
    const requested: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        requested.push(input)
        return { ok: true, json: async () => [record] }
      }),
    )

    const runs = await loadRuns(new Date('2026-11-26T10:00:00Z'))

    expect(requested).toHaveLength(1)
    expect(requested[0]).toContain('/runs/2026-11.json')
    expect(runs).toHaveLength(1)
  })

  it('keeps the three-month window once later months exist', async () => {
    const requested: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        requested.push(input)
        return { ok: false, json: async () => [] }
      }),
    )

    await loadRuns(new Date('2027-01-02T10:00:00Z'))

    expect(requested.map((url) => url.match(/\/runs\/(\d{4}-\d{2})\.json/)?.[1])).toEqual([
      '2027-01',
      '2026-12',
      '2026-11',
    ])
  })
})
