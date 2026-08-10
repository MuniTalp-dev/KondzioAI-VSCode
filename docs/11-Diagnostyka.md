# Diagnostyka

Wersja 0.2.0 ma sekcję **ŚRODOWISKO** z dziewięcioma lekkimi kontrolami. Przycisk **SPRAWDŹ PONOWNIE** wykonuje je ponownie. Poniższe polecenia służą do pogłębionej diagnostyki.

## Znaczenie stanów

| Stan | Znaczenie |
|---|---|
| `CHECKING` | kontrola trwa; nie wyciągaj jeszcze wniosku |
| `OK` | kontrola zakończyła się powodzeniem |
| `WARNING` | składnik działa częściowo lub użyto fallbacku |
| `ERROR` | składnik jest niedostępny albo wynik jest niepoprawny |

## Health check

| Składnik | Kontrola | Typowe błędy |
|---|---|---|
| Orchestrator | `E:\AI\Orchestrator\.venv\Scripts\python.exe E:\AI\Orchestrator\ai.py --dry-run "test"` | błędna ścieżka, brak pakietu YAML |
| MCP | uruchom `tests\test_mcp_integration.py` backendu lub `test\bridge_integration.py` rozszerzenia | niezgodny SDK, błąd stdio |
| SearXNG | otwórz lokalny endpoint lub wywołaj `orchestrator_research` | kontener zatrzymany, zły port |
| Ollama | `ollama list` | usługa nie działa |
| Qwen | sprawdź `qwen2.5-coder:7b` w `ollama list` | model niepobrany, inna nazwa |
| Aider | `aider --version` i `aider --help` | brak PATH, niezgodne flagi |
| Codex CLI | `codex --version` i `codex exec --help` | brak instalacji lub autoryzacji |
| Git | `git status --short` w sandboxie | brudne repo albo brak `.git` |
| .NET SDK | `dotnet --info` | brak SDK 10 lub niezgodny `global.json` |

## Diagnostyka panelu

1. Sprawdź ustawienia `kondzioAi.orchestratorRoot` i `kondzioAi.pythonPath`.
2. Otwórz **Developer: Show Running Extensions**.
3. Sprawdź **Developer: Toggle Developer Tools** oraz log Extension Host.
4. Uruchom z katalogu rozszerzenia `npm test`.
5. Uruchom `python test\bridge_integration.py` właściwym Pythonem Orchestratora.
6. Użyj **Kondzio AI: Reload Panel**, aby odtworzyć WebView bez restartowania VS Code.
7. Użyj **Kondzio AI: Reset WebView State**, aby wyczyścić stan UI bez zmiany konfiguracji użytkownika.

## Logi i artefakty

Kanał **Output → Kondzio AI** pokazuje pełny przepływ sprawdzania aktualizacji: aktywację i wersję rozszerzenia, `updateRepository`, komunikat `checkForUpdates`, start requestu, status HTTP, najnowszy release, wersję zainstalowaną oraz wynik `current`, `update` albo `error`/`timeout`. Kanał nie zapisuje tokenów ani sekretów.

- runy: `E:\AI\Orchestrator\runs`;
- logi MCP: `E:\AI\Orchestrator\mcp\logs`;
- raport konkretnego runu: `runs\<RUN-ID>\report.md`;
- log VS Code: `%APPDATA%\Code\logs` albo katalog profilu testowego.
