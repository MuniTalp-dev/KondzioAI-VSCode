# Kondzio AI — rozszerzenie VS Code

Kondzio AI jest lokalnym interfejsem VS Code do istniejącego Kondzio AI Orchestrator. Panel pozwala planować zadania, uruchamiać wykonawców, śledzić status, przeglądać historię i wykonywać research bez codziennej pracy w terminalu.

Rozszerzenie jest wyłącznie warstwą UI. Routing, wykonanie, research, walidacja i raporty pozostają w Orchestratorze.

## Możliwości

- tryby autonomii AUTO 1, AUTO 2 i AUTO 3;
- routing AUTO albo ręczny wybór LOCAL, RESEARCH lub CODEX;
- bezpieczny dry-run;
- status runu, ETA, próby, testy, validation i lista zmienionych plików;
- historia 10 runów, raport Markdown i research SearXNG + Qwen;
- rzeczywisty health check Orchestratora, MCP, SearXNG, Ollama, Qwen, Aider, Codex CLI, Git i .NET SDK;
- kontrola dostępności wymuszonego wykonawcy oraz ręczny/24-godzinny update check GitHub Releases;
- obsługa tego samego backendu z panelu i z Codex Chat przez MCP.

## Wymagania

Windows, VS Code 1.100+, działający `E:\AI\Orchestrator` z Pythonem i MCP. Zadania programistyczne wymagają także Git i właściwego SDK projektu; LOCAL używa Ollama, Qwen i Aider, a Research — SearXNG lub awaryjnie DDGS.

## Szybki start

1. W VS Code uruchom **Extensions: Install from VSIX...**.
2. Wskaż `kondzio-ai-0.2.0.vsix`.
3. Wykonaj **Developer: Reload Window**.
4. Otwórz ikonę **Kondzio AI** w Activity Bar.
5. Wpisz zadanie, wybierz AUTO 1–3 i kliknij **URUCHOM**.

Przykład bez zmian w repozytorium:

```text
AUTO 1 + Dry-run
Zbadaj i zaplanuj eksport PNG 300 DPI z modułu wizualizacji WPF .NET 10.
```

## Autonomia

- **AUTO 1** — analiza, routing, opcjonalny research, plan, ETA, ryzyka i kryteria; bez implementacji.
- **AUTO 2** — implementacja, właściwe testy, diff i validation; bez automatycznego commita.
- **AUTO 3** — pełny pipeline z retry i możliwością lokalnego commita; zawsze stop przed push.

## Wykonawcy

- **AUTO** — router wybiera właściwą ścieżkę.
- **LOCAL** — Qwen przez Ollama i Aider dla ograniczonych zadań.
- **RESEARCH** — SearXNG, ranking źródeł i analiza Qwen; DDGS jest fallbackiem.
- **CODEX** — złożone zadania programistyczne i eskalacje.

## Bezpieczeństwo

UI nie wykonuje samodzielnie operacji Git. Dry-run nie może zmieniać repozytorium, AUTO 2 nie commituję, a push pozostaje zablokowany. Fraza `ZATWIERDZAM PUSH` nigdy nie jest generowana przez rozszerzenie.

## Dokumentacja

Pełny spis treści: [docs/README.md](docs/README.md). Zacznij od [wprowadzenia](docs/01-Wprowadzenie.md), [instalacji](docs/02-Instalacja.md) i [opisu panelu](docs/07-Panel-VS-Code.md).
