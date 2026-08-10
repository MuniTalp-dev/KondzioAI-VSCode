# Konfiguracja

## Ustawienia rozszerzenia

W VS Code otwórz Settings i wyszukaj `Kondzio AI`.

| Ustawienie | Domyślnie | Znaczenie |
|---|---|---|
| `kondzioAi.orchestratorRoot` | `E:\AI\Orchestrator` | katalog backendu |
| `kondzioAi.pythonPath` | `E:\AI\Orchestrator\.venv\Scripts\python.exe` | Python zawierający pakiet MCP |
| `kondzioAi.updateRepository` | `MuniTalp-dev/KondzioAI-VSCode` | repo GitHub Releases w formacie `owner/KondzioAI-VSCode` |

Po zmianie ustawień wykonaj **Developer: Reload Window**, ponieważ adapter jest tworzony przy aktywacji rozszerzenia.

## Konfiguracja backendu

Plik `E:\AI\Orchestrator\config.yaml` określa m.in. katalog runów, sandbox LOCAL, URL SearXNG, adres Ollama, model Qwen i limity prób. Zmieniaj go tylko świadomie; UI nie powinno kopiować tej logiki.

Przykładowe obszary:

```yaml
paths:
  local_sandbox: 'E:\AI\Repos\Project_ORCHESTRATOR'
research:
  searxng_url: 'http://localhost:8080'
ollama:
  url: 'http://localhost:11434'
  model: 'qwen2.5-coder:7b'
```

## Zmiana repozytorium lub modelu

Repozytorium robocze LOCAL zmienia się w konfiguracji Orchestratora, nie w panelu. Przed przełączeniem upewnij się, że jest to kopia lub sandbox, a `git status --short` jest pusty. Model Ollama również zmienia się w backendzie; najpierw potwierdź jego dostępność poleceniem `ollama list`.

## Czego panel nie konfiguruje

Panel nie zarządza Dockerem, origin Git, uprawnieniami Codex CLI, polityką commitów ani frazą push. Szczegóły opisuje rozdział [Bezpieczeństwo](09-Bezpieczenstwo.md).
