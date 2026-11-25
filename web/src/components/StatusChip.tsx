import type { State } from '../lib/status'

const CLASS_BY_STATE: Record<State, string> = {
  OPERATIONAL: 'chip--operational',
  DEGRADED: 'chip--degraded',
  DOWN: 'chip--down',
  NEVER_RAN: 'chip--never',
}

export function StatusChip({ state }: { state: State }) {
  return <span className={`chip ${CLASS_BY_STATE[state]}`}>{state}</span>
}
