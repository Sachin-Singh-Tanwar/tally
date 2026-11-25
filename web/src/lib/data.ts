import type { RunRecord } from './status'

const RAW_BASE =
  'https://raw.githubusercontent.com/Sachin-Singh-Tanwar/tally/data/runs/'

const pad = (value: number) => String(value).padStart(2, '0')

async function fetchMonth(month: Date): Promise<RunRecord[]> {
  const key = `${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`
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
  const months = [0, 1, 2].map(
    (offset) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)),
  )
  const batches = await Promise.all(months.map(fetchMonth))
  return batches
    .flat()
    .filter((record) => typeof record?.ts === 'string' && typeof record?.target === 'string')
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
}
