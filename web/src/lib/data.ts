import type { RunRecord } from './status'

const RAW_BASE =
  'https://raw.githubusercontent.com/Sachin-Singh-Tanwar/tally/data/runs/'

// The data branch starts at 2026-11 (first recorded run 25 Nov 2026). Earlier month
// files cannot exist, so do not request them: a handled 404 still paints the console red.
const FIRST_MONTH = '2026-11'
const WINDOW_MONTHS = 3

const pad = (value: number) => String(value).padStart(2, '0')

const monthKey = (month: Date) =>
  `${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`

async function fetchMonth(key: string): Promise<RunRecord[]> {
  try {
    const response = await fetch(`${RAW_BASE}${key}.json?v=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!response.ok) return []
    const payload: unknown = await response.json()
    return Array.isArray(payload) ? (payload as RunRecord[]) : []
  } catch {
    return []
  }
}

export async function loadRuns(now: Date = new Date()): Promise<RunRecord[]> {
  const keys = Array.from({ length: WINDOW_MONTHS }, (_, offset) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))),
  ).filter((key) => key >= FIRST_MONTH)
  const batches = await Promise.all(keys.map(fetchMonth))
  return batches
    .flat()
    .filter((record) => typeof record?.ts === 'string' && typeof record?.target === 'string')
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
}
