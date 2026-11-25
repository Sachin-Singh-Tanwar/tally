#!/usr/bin/env python3
"""Tally worker: probe public endpoints and append run records to the data branch.

No external state lives on a VM. The GitHub Actions runner checks out the `data`
branch, runs this script, and commits the appended monthly JSON file back.
Only stdlib + requests are used.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

TARGETS: dict[str, str] = {
    "portfolio": "https://sachin-singh-tanwar.github.io/",
    "gh_api": "https://api.github.com/rate_limit",
    "apify_api": "https://api.apify.com/v2/store?limit=1",
}

STAGED_ERROR = "STAGED DEMO FAILURE"
STAGED_TARGET = "portfolio"
STAGED_RUNS = 4
STATE_FILE = ".simulate.json"


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def ts_string(moment: datetime) -> str:
    return moment.isoformat().replace("+00:00", "Z")


def state_path(data_dir: Path) -> Path:
    return data_dir / "runs" / STATE_FILE


def load_state(data_dir: Path) -> dict[str, Any] | None:
    path = state_path(data_dir)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None
    except (OSError, ValueError):
        return None


def save_state(data_dir: Path, state: dict[str, Any] | None) -> None:
    path = state_path(data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    if state is None:
        path.unlink(missing_ok=True)
        return
    path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def probe(url: str) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = requests.get(
            url,
            timeout=12,
            headers={"User-Agent": "tally-monitor/1.0", "Accept": "*/*"},
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        ok = response.status_code == 200
        return {
            "latency_ms": latency_ms,
            "status_code": response.status_code,
            "ok": ok,
            "error": None if ok else f"HTTP {response.status_code}",
        }
    except Exception as exc:  # network failure is a real failed check
        latency_ms = int((time.perf_counter() - started) * 1000)
        detail = str(exc).replace("\n", " ")[:180]
        return {
            "latency_ms": latency_ms,
            "status_code": None,
            "ok": False,
            "error": f"{type(exc).__name__}: {detail}",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--event", default=os.getenv("GITHUB_EVENT_NAME", ""))
    parser.add_argument("--simulate", choices=["true", "false"], default=None)
    args = parser.parse_args()

    data_dir: Path = args.data_dir
    now = utc_now()
    stamp = ts_string(now)

    # State captured before any dispatch handling: a dispatch that turns the
    # simulation ON is itself a normal run. The "next 4 runs" are the staged ones.
    current = load_state(data_dir)
    staged_target: str | None = None
    if current and int(current.get("remaining", 0)) > 0:
        staged_target = str(current.get("target", STAGED_TARGET))

    if args.event == "workflow_dispatch":
        if args.simulate == "true":
            save_state(
                data_dir,
                {
                    "remaining": STAGED_RUNS,
                    "target": STAGED_TARGET,
                    "started": stamp,
                },
            )
            staged_target = None
        elif args.simulate == "false":
            # A normal dispatch does not cancel a staged sequence. GitHub passes
            # boolean false for every default dispatch, so cancelling here would
            # make the "next 4 runs" impossible to demonstrate with dispatches.
            pass

    records: list[dict[str, Any]] = []
    for name, url in TARGETS.items():
        result = probe(url)
        staged = name == staged_target
        if staged:
            result["ok"] = False
            result["error"] = STAGED_ERROR
        records.append(
            {
                "ts": stamp,
                "target": name,
                "ok": bool(result["ok"]),
                "latency_ms": int(result["latency_ms"]),
                "status_code": result["status_code"],
                "error": result["error"],
                "staged": staged,
            }
        )

    if staged_target:
        remaining = max(0, int(current.get("remaining", 0)) - 1)
        save_state(
            data_dir,
            None if remaining == 0 else {**current, "remaining": remaining},
        )

    month = f"{now.year:04d}-{now.month:02d}"
    monthly = data_dir / "runs" / f"{month}.json"
    monthly.parent.mkdir(parents=True, exist_ok=True)
    history: list[dict[str, Any]] = []
    if monthly.exists():
        try:
            loaded = json.loads(monthly.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                history = loaded
        except ValueError:
            history = []
    history.extend(records)
    monthly.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")

    for record in records:
        flag = " STAGED" if record["staged"] else ""
        print(
            f"{record['ts']} {record['target']:<10} "
            f"{'ok  ' if record['ok'] else 'FAIL'} "
            f"{record['latency_ms']:>5}ms {record['error'] or ''}{flag}"
        )
    print(f"appended {len(records)} records to {monthly}")


if __name__ == "__main__":
    main()
