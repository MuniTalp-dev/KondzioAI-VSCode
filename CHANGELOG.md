# Changelog

Wszystkie istotne zmiany projektu są dokumentowane w tym pliku. Format opiera się na Keep a Changelog, a wersje stosują Semantic Versioning.

## [Unreleased]

## [0.2.1] - 2026-08-10

### Added

- Tryb oszczędzania Codexa z niezależnymi opcjami preferowania LOCAL i blokowania automatycznej eskalacji.
- Status `awaiting_codex_approval`, jawna zgoda na CODEX, planowany wykonawca i statystyki runu.
- Metryki użycia LOCAL, RESEARCH i CODEX oraz informacja o oszczędzeniu Codexa.

### Fixed

- Przygotowanie kontekstu LOCAL dla testów: wykrywanie solution i projektów, jednoznaczny wybór istniejącego pliku testowego oraz odrzucanie zmian poza właściwym projektem.

## [0.2.0] - 2026-08-10

### Added

- Dostępne z klawiatury opisy AUTO 1/2/3 oraz AUTO, LOCAL, RESEARCH i CODEX.
- Sekcja ŚRODOWISKO z dziewięcioma rzeczywistymi kontrolami i wersjami narzędzi.
- Preflight wymuszonego LOCAL i CODEX oraz informacje o fallbackach AUTO i DDGS.
- Ręczny i automatyczny (maksymalnie raz na 24 godziny) update check GitHub Releases.
- Workflow CI i release dla osobnego repozytorium `KondzioAI-VSCode`.

### Security

- Aktualizacja nie instaluje się automatycznie; otwarcie release wymaga modalnej zgody użytkownika.

## [0.1.0] - 2026-08-10

### Added

- Pierwszy panel Kondzio AI w Activity Bar.
- Obsługa sześciu narzędzi MCP przez cienki adapter.
- AUTO 1/2/3, wykonawcy, dry-run, status, ETA, historia, raport i research.
- Polska dokumentacja użytkowa i techniczna.
