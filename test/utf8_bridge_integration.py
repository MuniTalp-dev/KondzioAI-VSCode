from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

EXTENSION = Path(__file__).resolve().parents[1]
ROOT = Path(os.environ.get("KONDZIO_ORCHESTRATOR_ROOT", EXTENSION.parent)).resolve()
PROMPT = "Zażółć gęślą jaźń. Możliwość, błędy, użytkownik, ścieżka."

process = subprocess.Popen(
    [str(ROOT / ".venv" / "Scripts" / "python.exe"), str(EXTENSION / "python" / "mcp_bridge.py"), str(ROOT)],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding="utf-8",
)
assert process.stdin and process.stdout
try:
    request = {
        "id": 1,
        "tool": "orchestrator_run",
        "arguments": {"prompt": PROMPT, "autonomy": 1, "mode": "local", "dry_run": True},
    }
    process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
    process.stdin.flush()
    response = json.loads(process.stdout.readline())
    assert response["id"] == 1 and "error" not in response, response
    run_id = response["result"]["run_id"]
    run = ROOT / "runs" / run_id
    task_bytes = (run / "task.json").read_bytes()
    report_bytes = (run / "report.md").read_bytes()
    task = json.loads(task_bytes.decode("utf-8", errors="strict"))
    report = report_bytes.decode("utf-8", errors="strict")
    assert task["prompt"] == PROMPT
    assert PROMPT in report
    assert "moĹ" not in task["prompt"] and "poczÄ" not in report
    print(f"UTF8_BRIDGE_OK run_id={run_id}")
finally:
    process.terminate()
    process.wait(timeout=5)
