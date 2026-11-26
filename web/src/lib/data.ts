import { measuredFrom, type RunRecord } from './status'

const RAW_BASE =
  'https://raw.githubusercontent.com/Sachin-Singh-Tanwar/tally/data/runs/'
const META_URL =
  'https://raw.githubusercontent.com/Sachin-Singh-Tanwar/tally/data/meta.json'

// The data branch starts at 2026-11. index.json is authoritative for which month
// files exist; the floor only guards against an older manifest.
const FIRST_MONTH = '2026-11'

async function fetchMonths(): Promise<string[]> {
  try {
    const response = await fetch(`${RAW_BASE}index.json?v=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!response.ok) return []
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return []
    const months = (payload as { months?: unknown }).months
    if (!Array.isArray(months)) return []
    return months.filter((key): key is string => typeof key === 'string' && key >= FIRST_MONTH)
  } catch {
    return []
  }
}

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

export async function loadBaseline(runs: RunRecord[]): Promise<number | null> {
  const derived = measuredFrom(runs)
  if (derived === null) return null
  try {
    const response = await fetch(`${META_URL}?v=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return derived
    const payload: unknown = await response.json()
    const since = (payload as { measured_since?: unknown }).measured_since
    if (typeof since !== 'string') return derived
    const at = Date.parse(since)
    return Number.isNaN(at) ? derived : at
  } catch {
    return derived
  }
}

export async function loadRuns(): Promise<RunRecord[]> {
  const keys = await fetchMonths()
  const batches = await Promise.all(keys.map(fetchMonth))
  return batches
    .flat()
    .filter((record) => typeof record?.ts === 'string' && typeof record?.target === 'string')
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
}
