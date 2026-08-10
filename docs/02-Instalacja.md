# Instalacja

## Wymagania systemowe

| Składnik | Zastosowanie |
|---|---|
| Windows 10/11 | środowisko VS Code, WPF i lokalnych executorów |
| VS Code 1.100+ | host rozszerzenia |
| Python i `.venv` | Orchestrator, MCP i cienki adapter |
| .NET SDK 10 | projekty KondzioStudio i ich testy |
| Git | stan repo, diff, sandbox i opcjonalny commit AUTO 3 |
| Ollama | lokalne udostępnianie modelu |
| `qwen2.5-coder:7b` | model LOCAL i analiza researchu |
| Aider 0.86.2 lub zgodny | lokalny executor zmian |
| Docker | uruchomienie usług lokalnych, w tym SearXNG |
| SearXNG | podstawowy dostawca wyszukiwania |
| Codex CLI | wykonawca złożonych zadań i eskalacji |

Sprawdź dostępność podstawowych poleceń:

```powershell
code --version
git --version
dotnet --info
docker version
ollama list
aider --version
codex --version
```

## Ścieżki projektu

Domyślne wartości:

```text
Orchestrator: E:\AI\Orchestrator
Python:       E:\AI\Orchestrator\.venv\Scripts\python.exe
Rozszerzenie: E:\AI\Orchestrator\vscode-extension
Sandbox:      E:\AI\Repos\Project_ORCHESTRATOR
Runy:         E:\AI\Orchestrator\runs
```

Pierwsze dwie ścieżki można zmienić w ustawieniach rozszerzenia. Pozostałe należą do konfiguracji backendu; zobacz [Konfiguracja](03-Konfiguracja.md).

## Przygotowanie usług

1. Uruchom Ollama i sprawdź `ollama list`.
2. Jeżeli modelu nie ma, pobierz go zgodnie z zasadami lokalnego środowiska: `ollama pull qwen2.5-coder:7b`.
3. Uruchom kontener SearXNG i sprawdź adres skonfigurowany w `config.yaml`.
4. Sprawdź Aider przez `aider --help` oraz Codex CLI przez `codex exec --help`.
5. Zweryfikuj MCP istniejącymi testami Orchestratora.

## Instalacja VSIX

1. Otwórz zwykły VS Code.
2. Uruchom **Extensions: Install from VSIX...**.
3. Wskaż `E:\AI\Orchestrator\vscode-extension\kondzio-ai-0.2.0.vsix`.
4. Wykonaj **Developer: Reload Window**.
5. Otwórz ikonę **Kondzio AI** w Activity Bar.

Możliwa jest też instalacja z terminala:

```powershell
code --install-extension "E:\AI\Orchestrator\vscode-extension\kondzio-ai-0.2.0.vsix"
```

## Pierwsze uruchomienie

Wybierz AUTO 1 i Dry-run, wpisz proste zadanie planistyczne i kliknij **URUCHOM**. Sprawdź Run ID, plan, ryzyka, kryteria oraz `Files changed = 0`. Jeżeli panel nie łączy się z backendem, przejdź do [Diagnostyki](11-Diagnostyka.md).
