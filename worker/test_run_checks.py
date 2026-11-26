import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import run_checks

OK = {"latency_ms": 100, "status_code": 200, "ok": True, "error": None}


class WorkerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = Path(self.tmp.name)
        probe = patch.object(run_checks, "probe", side_effect=lambda url: dict(OK))
        probe.start()
        self.addCleanup(probe.stop)
        self.addCleanup(self.tmp.cleanup)

    def run_worker(self, *args):
        argv = ["run_checks.py", "--data-dir", str(self.data), *args]
        with patch.object(sys, "argv", argv), redirect_stdout(io.StringIO()):
            run_checks.main()

    def test_external_cycle_sets_baseline_and_index(self):
        self.run_worker("--event", "schedule")
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        records = json.loads((self.data / "runs" / f"{month}.json").read_text())

        self.assertEqual(len(records), 3)
        self.assertTrue(all(record["event"] == "schedule" for record in records))
        self.assertFalse(any(record["staged"] for record in records))
        self.assertEqual(
            json.loads((self.data / "meta.json").read_text()),
            {
                "measured_since": records[0]["ts"],
                "trigger": "external",
                "interval_minutes": 30,
            },
        )
        self.assertEqual(
            json.loads((self.data / "runs" / "index.json").read_text()),
            {"months": [month]},
        )

    def test_manual_staged_path_keeps_dispatch_label(self):
        self.run_worker("--event", "workflow_dispatch", "--simulate", "true")
        self.run_worker("--event", "workflow_dispatch", "--simulate", "false")
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        records = json.loads((self.data / "runs" / f"{month}.json").read_text())
        staged = [record for record in records if record["staged"]]

        self.assertEqual(len(staged), 1)
        self.assertEqual(staged[0]["error"], run_checks.STAGED_ERROR)
        self.assertTrue(all(record["event"] == "workflow_dispatch" for record in records))
        self.assertFalse((self.data / "meta.json").exists())


if __name__ == "__main__":
    unittest.main()
