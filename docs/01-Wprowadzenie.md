# Wprowadzenie

Kondzio AI łączy panel VS Code i Codex Chat z lokalnym Kondzio AI Orchestrator. Użytkownik opisuje cel, a backend klasyfikuje zadanie, dobiera wykonawcę, ocenia potrzebę researchu, szacuje czas i sprawdza wynik.

```text
Użytkownik
    ↓
VS Code / Codex
    ↓
MCP
    ↓
Orchestrator
    ↓
LOCAL / RESEARCH / CODEX
    ↓
Validation
    ↓
Testy
    ↓
Raport
```

## Jakie problemy rozwiązuje

- ujednolica uruchamianie zadań lokalnych i złożonych;
- oddziela zakończenie procesu od faktycznego spełnienia zadania;
- wymusza kryteria akceptacji, testy i kontrolę diffu;
- zapewnia widoczny status, ETA, historię prób i raport;
- ogranicza przypadkowe commity oraz blokuje push;
- wykonuje research na zebranych źródłach zamiast polegać wyłącznie na pamięci modelu.

## Panel czy Codex Chat

Panel jest wygodny przy powtarzalnej pracy: szybki dry-run, obserwacja statusu, historia i research. Codex Chat sprawdza się, gdy zadanie wymaga rozmowy, interpretacji wyniku albo dalszej pracy z kodem. Obie ścieżki używają tego samego MCP i backendu.

## Kiedy używać Research

Research jest właściwy dla aktualnych frameworków, API, renderowania, DPI, formatów, licencji, standardów, bezpieczeństwa i integracji zewnętrznych. Prosty rename, korekta tekstu albo test istniejącej walidacji zwykle nie wymaga źródeł zewnętrznych.

Następnie przeczytaj [instalację](02-Instalacja.md) i [opis poziomów AUTO](04-AUTO-1-2-3.md).
