# Panel VS Code

Panel otwiera się ikoną **Kondzio AI** w Activity Bar albo komendą **Kondzio AI: New Task**.

## Formularz zadania

- **Co mam zrobić?** — wielowierszowy opis celu, ograniczeń i oczekiwanego wyniku.
- **AUTONOMIA** — AUTO 1, AUTO 2 lub AUTO 3; domyślnie AUTO 2.
- **WYKONAWCA** — AUTO, LOCAL, RESEARCH albo CODEX; domyślnie AUTO.
- **TRYB PRÓBNY** — dostępny switch tworzący plan i analizę bez zmiany plików.
- **OSZCZĘDZAJ CODEX** — jednym switchem preferuje LOCAL i blokuje automatyczną eskalację do CODEX.
- **URUCHOM ZADANIE** — wysyła zadanie do `orchestrator_run`.

## Zakładki i akcje

- **ANULUJ** wywołuje `orchestrator_cancel` dla aktywnego runu.
- **OSTATNI RAPORT** otwiera wynik jako dokument Markdown w VS Code.
- **HISTORIA** pobiera 10 ostatnich runów; kliknięcie wpisu pobiera jego status.
- **RESEARCH** rozwija formularz z polem „Czego szukamy?” i przyciskiem **SZUKAJ**.

## Status i ETA

Panel pokazuje Run ID, status, etap, agenta, numer próby, research, testy, validation, liczbę plików, commit i push. ETA obejmuje MIN/TYPICAL/MAX, elapsed time oraz remaining ETA. Aktywny run jest odświeżany co około 2 sekundy.

Pasek postępu jest orientacyjny: routing 10%, research 25%, planning 35%, implementing 60%, testing 80%, validating 90%, koniec 100%. Nie przedstawia dokładnego procentu pracy.

## Status bar

Status bar pokazuje `Kondzio AI: IDLE`, aktualnego agenta podczas pracy, `DONE` po sukcesie albo `FAILED` dla stanów niepowodzenia. Kliknięcie otwiera panel.

## Stan narzędzi

Sekcja **STAN NARZĘDZI** wykonuje rzeczywiste lekkie kontrole Orchestratora, sesji MCP, SearXNG, Ollama, modelu Qwen, Aider, Codex CLI, Git i .NET SDK. Lista pozostaje kompaktowa, a wersje i szczegóły są dostępne po rozwinięciu. **SPRAWDŹ STAN** uruchamia kontrolę ręcznie.

Przed wymuszonym LOCAL panel blokuje run, jeśli brakuje Ollama, Qwen albo Aider. Analogicznie blokuje niedostępny CODEX. AUTO nie jest blokowany i pozostawia fallback Orchestratorowi. RESEARCH pokazuje informację o DDGS, gdy SearXNG ma problem.

## Aktualizacje

Wersja i symbol aktualności są wyłącznie w nagłówku. Przy dostępnej aktualizacji **CHANGELOG** pokazuje release notes w panelu, a **AKTUALIZUJ** uruchamia istniejący bezpieczny updater.

Panel używa jednego delegowanego mechanizmu komunikacji dla wszystkich przycisków. Układ nie ma poziomego przewijania przy szerokościach 260, 320, 400 i 500 px; wszystkie akcje mają widoczny focus i etykiety dostępności, a statusy korzystają z `aria-live`.

## Pierwsze zadanie

1. Wybierz AUTO 1.
2. Zaznacz Dry-run.
3. Wpisz:

```text
Zbadaj i zaplanuj eksport PNG 300 DPI z modułu wizualizacji WPF .NET 10.
```

4. Kliknij **URUCHOM**.
5. Sprawdź `research_required`, plan, ryzyka, kryteria, ETA i `Files changed = 0`.

Lista planowanych screenshotów znajduje się w [docs/images](images/README.md).
