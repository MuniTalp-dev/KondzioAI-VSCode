# Wykonawcy

## Oszczędzanie CODEX

Opcja **Preferuj LOCAL** kieruje najpierw do Qwen + Ollama + Aider. Opcja **Nie eskaluj automatycznie do CODEX** zatrzymuje run po dwóch nieudanych próbach jako `awaiting_codex_approval`. Dopiero przycisk **URUCHOM PRZEZ CODEX** udziela jednorazowej zgody.

## AUTO

AUTO deleguje wybór routerowi. Jest najlepszym ustawieniem domyślnym, gdy użytkownik opisuje cel, ale nie chce wybierać narzędzia. Router bierze pod uwagę złożoność, temat, niepewność i potrzebę aktualnych źródeł.

Mocną stroną jest spójna polityka. Ograniczeniem pozostaje regułowy charakter routingu, dlatego wynik dry-run należy przeczytać przed większą zmianą.

## LOCAL

LOCAL używa `qwen2.5-coder:7b` przez Ollama i Aider. Nadaje się do małych, ograniczonych zmian, prostych testów i pracy w znanym fragmencie repozytorium.

Zalety: praca lokalna, niski koszt zewnętrzny i szybkie próby. Ograniczenia: mniejszy kontekst i skłonność do proszenia o pliki, jeśli zakres nie został wykryty. Aider działa bez przeglądarki, URL-i, interaktywnych pytań i auto-commitów.

Polityka wykonania:

```text
LOCAL próba 1 → validation
        ↓ fail
LOCAL próba 2 → validation
        ↓ fail
CODEX → validation
```

## RESEARCH

RESEARCH zbiera aktualne źródła przez SearXNG, deduplikuje i rankuje wyniki, a następnie przekazuje je Qwen do analizy. DDGS jest fallbackiem wyszukiwarki. Tryb nie służy do samodzielnej implementacji kodu.

Wybieraj go dla dokumentacji frameworków, API, licencji, standardów, bezpieczeństwa, renderowania, DPI i niepewnych integracji.

## CODEX

CODEX obsługuje trudne zadania programistyczne: WPF, rendering, EF Core, migracje, architekturę, bezpieczeństwo i zmiany wieloplikowe. Jest również fallbackiem po dwóch nieskutecznych próbach LOCAL.

Jego mocną stroną jest szersze rozumowanie i praca w repozytorium. Nadal podlega sandboxowi, kryteriom akceptacji, testom i blokadzie push.

## Ręczny wybór i fallback

Ręczny tryb jest przydatny podczas diagnostyki lub świadomego testu wykonawcy. Nie omija validation. W AUTO 2/3 eskalacja nie wymaga dodatkowego pytania, lecz nigdy nie rozszerza zakresu poza zadanie użytkownika.
