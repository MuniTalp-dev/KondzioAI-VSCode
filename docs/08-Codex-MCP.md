# Codex i MCP

MCP jest warstwą narzędziową łączącą Codex i panel z jednym Orchestratorem. Rozszerzenie używa cienkiego `mcp_bridge.py`, który uruchamia istniejący serwer i przekazuje wywołania bez kopiowania logiki biznesowej.

## `orchestrator_run`

Parametry: `prompt`, `autonomy` (`1|2|3`), `mode` (`auto|local|research|codex`) i `dry_run` (`boolean`). Rozpoczyna pipeline i zwraca pierwszy status.

```text
Użyj Kondzio Orchestrator. Uruchom AUTO 1, mode auto, dry_run true dla: „Zaplanuj eksport PNG”.
```

## `orchestrator_status`

Opcjonalny parametr `run_id`. Zwraca etap, próbę, agenta, ETA, elapsed, research, implementację, testy, validation, pliki, commit i push. Bez identyfikatora wybiera ostatni run.

```text
Użyj orchestrator_status i pokaż stan runu 20260810_...
```

## `orchestrator_last_report`

Nie przyjmuje parametrów. Zwraca identyfikator i treść ostatniego raportu Markdown.

```text
Pokaż ostatni raport przez orchestrator_last_report.
```

## `orchestrator_research`

Parametr `query`. Uruchamia istniejący SearXNG, ranking i analizę Qwen; DDGS pozostaje fallbackiem.

```text
Użyj orchestrator_research dla „WPF PNG 300 DPI .NET 10”.
```

## `orchestrator_cancel`

Opcjonalny `run_id`. Przerywa aktywny proces bez usuwania plików runu. Nie cofa automatycznie zmian roboczych.

```text
Anuluj wskazany run przez orchestrator_cancel.
```

## `orchestrator_runs`

Nie przyjmuje parametrów. Zwraca maksymalnie 10 ostatnich runów z promptem, statusem, AUTO, agentem i czasem.

```text
Pokaż historię przez orchestrator_runs.
```

Codex Chat i panel mogą działać równolegle, ale użytkownik powinien unikać uruchamiania dwóch executorów w tym samym sandboxie.
