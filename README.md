# Tally

Tally answers one question: did the scheduled job actually run? It records real runs, derives uptime and incidents from that record, and shows the proof publicly. If a check has not succeeded on schedule, the page says so — it does not hide it.

- Repo: https://github.com/Sachin-Singh-Tanwar/tally
- Live: https://sachin-singh-tanwar.github.io/tally/
- Run history: https://github.com/Sachin-Singh-Tanwar/tally/tree/data/runs

## Architecture

- **Scheduler** — GitHub Actions cron, every 30 minutes, in `.github/workflows/checks.yml`.
- **Worker** — `worker/run_checks.py`. Standard library plus `requests`. It probes three
  public endpoints and appends one record per target to `runs/YYYY-MM.json` on the `data`
  branch. History is appended, never rewritten.
- **Storage** — the `data` branch. The frontend reads
  `https://raw.githubusercontent.com/Sachin-Singh-Tanwar/tally/data/runs/YYYY-MM.json`.
- **Frontend** — Vite + React + TypeScript + Tailwind in `web/`, deployed to GitHub Pages by
  `.github/workflows/deploy.yml`.
- **Alerts** — not included in this build. They were the first item cut from the spec.

Record schema:

```json
{ "ts": "2026-11-25T14:30:00Z", "target": "portfolio", "ok": true,
  "latency_ms": 412, "status_code": 200, "error": null, "staged": false }
```

Targets: `portfolio` (https://sachin-singh-tanwar.github.io/), `gh_api`
(https://api.github.com/rate_limit), `apify_api` (https://api.apify.com/v2/store?limit=1).

## Status rules

Expected interval: 30 minutes. For each target, `age = now - last_ok`, where `last_ok` is the
newest record with `ok=true`.

| State | Rule |
| --- | --- |
| `OPERATIONAL` | `age <= 1.5 * interval` (45 min) |
| `DEGRADED` | `1.5 * interval < age <= 3 * interval` (45–90 min) |
| `DOWN` | `age > 3 * interval` (90 min) |
| `NEVER_RAN` | no `ok=true` record |

An incident is a consecutive streak of `ok=false` records. Its start is the first failure, its
duration is the first recovery minus the start (or ongoing), and MTTR is the duration of a
resolved incident. Uptime is `ok_count / total_count` over 24h, 7d and 30d windows. All of it
is computed from records in `src/lib/status.ts`; nothing is hardcoded.

## Staged demo

Trigger a workflow dispatch on `Tally checks` with `simulate_failure=true`. That dispatch run
is a normal check; the **next four runs** record `ok=false`, `staged=true` and
`error="STAGED DEMO FAILURE"` for the `portfolio` target. Any of the next four runs counts,
whether it comes from the cron or from a normal dispatch; the counter clears itself after the
fourth. Let the cron space those runs out to see the state move through `DEGRADED` and `DOWN`
and an incident open. Because GitHub passes boolean `false` for every default dispatch, a normal
dispatch no longer cancels a staged sequence; to cancel early, delete `runs/.simulate.json` from
the `data` branch. The next run after the counter clears recovers, closing the incident with a
measured MTTR.

**A staged run is never presented as a real outage.** Every record with `staged=true` renders a
`STAGED DEMO` badge on the status and incident screens. The same sentence appears on the
Method screen.

## Local checks

```bash
cd web
npm ci
npm test          # incident and status transition unit test
npm run build     # type check + production bundle
npm run preview
```

## Honesty note

Tally runs on GitHub Actions. GitHub can delay scheduled runs; a late run is shown as late, not
as a success.
