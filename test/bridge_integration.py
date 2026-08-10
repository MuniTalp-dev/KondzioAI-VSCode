from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

EXTENSION = Path(__file__).resolve().parents[1]
ROOT = Path(os.environ.get("KONDZIO_ORCHESTRATOR_ROOT", EXTENSION.parent)).resolve()

process = subprocess.Popen(
    [str(ROOT / ".venv" / "Scripts" / "python.exe"), str(EXTENSION / "python" / "mcp_bridge.py"), str(ROOT)],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8"
)
assert process.stdin and process.stdout
requests = [
    {"id": 1, "tool": "orchestrator_run", "arguments": {"prompt": "Zbadaj i zaplanuj eksport PNG 300 DPI z modułu wizualizacji WPF .NET 10.", "autonomy": 1, "mode": "auto", "dry_run": True}},
    {"id": 2, "tool": "orchestrator_status", "arguments": {}},
    {"id": 3, "tool": "orchestrator_runs", "arguments": {}},
    {"id": 4, "tool": "orchestrator_last_report", "arguments": {}},
    {"id": 5, "tool": "orchestrator_research", "arguments": {"query": "Najlepszy sposób eksportowania zawartości WPF do PNG 300 DPI w .NET 10"}},
    {"id": 6, "tool": "extension_health", "arguments": {}},
]
responses = {}
for request in requests:
    process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
    process.stdin.flush()
    response = json.loads(process.stdout.readline())
    assert response["id"] == request["id"] and "error" not in response, response
    responses[request["id"]] = response["result"]
status = responses[2]
assert status["dry_run"] is True
assert status["routing"]["research_required"] is True
assert status["plan"] and status["risks"] and status["acceptance_criteria"]["items"]
assert status["initial_eta"]["minimum"] <= status["initial_eta"]["typical"] <= status["initial_eta"]["maximum"]
assert status["files_changed"] == []
research = responses[5]
assert research["provider"] in {"SearXNG", "DDGS"}
assert research["source_count"] > 0 and research["sources"] and research["analysis"]
health = responses[6]
assert len(health["items"]) == 9
assert {entry["name"] for entry in health["items"]} == {"Orchestrator", "MCP", "SearXNG", "Ollama", "Qwen", "Aider", "Codex CLI", "Git", ".NET SDK"}
assert all(entry["status"] in {"OK", "WARNING", "ERROR"} for entry in health["items"])
assert any(entry.get("version") for entry in health["items"])
process.terminate()
print(f"BRIDGE_INTEGRATION_OK provider={research['provider']} sources={research['source_count']} health={health['items']}")
