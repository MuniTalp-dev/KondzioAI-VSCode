from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

sys.stdin.reconfigure(encoding="utf-8", errors="replace")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def item(name: str, status: str, version: str = "", detail: str = "") -> dict:
    return {"name": name, "status": status, "version": version, "detail": detail}


def command_health(name: str, command: list[str], cwd: Path, timeout: int = 5) -> dict:
    executable = shutil.which(command[0])
    if not executable:
        return item(name, "ERROR", detail=f"Nie znaleziono polecenia {command[0]} w PATH.")
    try:
        result = subprocess.run(command, cwd=cwd, text=True, encoding="utf-8", errors="replace",
                                capture_output=True, timeout=timeout, check=False,
                                env={**os.environ, "NO_COLOR": "1"})
        output = (result.stdout or result.stderr).strip().splitlines()
        version = output[0][:160] if output else ""
        return item(name, "OK" if result.returncode == 0 else "ERROR", version,
                    "" if result.returncode == 0 else f"Kod wyjścia {result.returncode}.")
    except subprocess.TimeoutExpired:
        return item(name, "ERROR", detail=f"Przekroczono limit {timeout} s.")
    except OSError as error:
        return item(name, "ERROR", detail=str(error))


def http_json(url: str, timeout: int = 4) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "KondzioAI-VSCode/health"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def health_check(root: Path) -> dict:
    config = yaml.safe_load((root / "config.yaml").read_text(encoding="utf-8"))
    results = []
    python = root / ".venv" / "Scripts" / "python.exe"
    if python.is_file() and (root / "ai.py").is_file():
        probe = subprocess.run([str(python), "-c", "from orchestrator.app import load_config; load_config(); print('config OK')"],
                               cwd=root, text=True, encoding="utf-8", errors="replace", capture_output=True,
                               timeout=8, check=False)
        results.append(item("Orchestrator", "OK" if probe.returncode == 0 else "ERROR",
                            probe.stdout.strip(), probe.stderr.strip()))
    else:
        results.append(item("Orchestrator", "ERROR", detail="Brak ai.py lub Pythona .venv."))
    results.append(item("MCP", "OK", detail="Sesja MCP została zainicjalizowana przez adapter."))

    searx_url = str(config["research"]["searxng_url"]).rstrip("/")
    try:
        data = http_json(f"{searx_url}/search?q=health&format=json")
        results.append(item("SearXNG", "OK", detail=f"Odpowiedź zawiera {len(data.get('results', []))} wyników."))
    except (OSError, ValueError, urllib.error.URLError) as error:
        fallback = config.get("research", {}).get("fallback")
        status = "WARNING" if fallback == "ddgs" else "ERROR"
        detail = f"SearXNG niedostępny: {error}." + (" Orchestrator użyje fallbacku DDGS." if fallback == "ddgs" else "")
        results.append(item("SearXNG", status, detail=detail))

    ollama_url = str(config["ollama"]["url"]).rstrip("/")
    model = str(config["ollama"]["model"])
    try:
        version_data = http_json(f"{ollama_url}/api/version")
        results.append(item("Ollama", "OK", str(version_data.get("version", ""))))
        tags = http_json(f"{ollama_url}/api/tags")
        names = [entry.get("name", "") for entry in tags.get("models", [])]
        present = model in names or any(name.split(":")[0] == model.split(":")[0] for name in names)
        results.append(item("Qwen", "OK" if present else "ERROR", model,
                            "Model jest dostępny." if present else "Modelu nie ma na liście Ollama."))
    except (OSError, ValueError, urllib.error.URLError) as error:
        results += [item("Ollama", "ERROR", detail=str(error)), item("Qwen", "ERROR", model, "Nie można odpytać Ollama.")]

    results.append(command_health("Aider", ["aider", "--version"], root))
    results.append(command_health("Codex CLI", ["codex", "--version"], root))
    results.append(command_health("Git", ["git", "--version"], root))
    results.append(command_health(".NET SDK", ["dotnet", "--version"], root))
    return {"checked_at": __import__("datetime").datetime.now().astimezone().isoformat(), "items": results}


async def run(root: Path) -> None:
    server = StdioServerParameters(
        command=str(root / ".venv" / "Scripts" / "python.exe"),
        args=[str(root / "mcp_server.py")],
        cwd=str(root),
    )
    async with stdio_client(server) as streams:
        async with ClientSession(*streams) as session:
            await session.initialize()
            while True:
                line = await asyncio.to_thread(sys.stdin.readline)
                if not line:
                    return
                request = {}
                try:
                    request = json.loads(line)
                    if request["tool"] == "extension_health":
                        payload = await asyncio.to_thread(health_check, root)
                        print(json.dumps({"id": request["id"], "result": payload}, ensure_ascii=False), flush=True)
                        continue
                    response = await session.call_tool(request["tool"], request.get("arguments", {}))
                    payload = getattr(response, "structured_content", None)
                    if payload is None:
                        payload = getattr(response, "structuredContent", None)
                    if payload is None:
                        texts = [item.text for item in response.content if getattr(item, "type", None) == "text"]
                        payload = json.loads(texts[0]) if len(texts) == 1 else {"content": texts}
                    result = {"id": request["id"], "result": payload}
                except Exception as error:
                    result = {"id": request.get("id") if isinstance(request, dict) else None,
                              "error": f"{type(error).__name__}: {error}"}
                print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Użycie: mcp_bridge.py <orchestrator-root>")
    asyncio.run(run(Path(sys.argv[1]).resolve()))
