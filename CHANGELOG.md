# Changelog

Wszystkie istotne zmiany projektu są dokumentowane w tym pliku. Format opiera się na Keep a Changelog, a wersje stosują Semantic Versioning.

## [Unreleased]

## [0.2.4] - 2026-08-10

### Changed

- Ujednolicono kontrakt komunikatu sprawdzania aktualizacji pomiędzy WebView i Extension Host.
- Pakowanie zawsze usuwa poprzedni katalog `dist` przed kompilacją i testami.

### Fixed

- Dodano diagnostykę każdego komunikatu WebView oraz logi kliknięcia i wysłania żądania aktualizacji.
- Test integracyjny wykonuje rzeczywisty skrypt przycisku, przechwytuje `postMessage` i prowadzi komunikat przez handler do fałszywego UpdateService.

## [0.2.3] - 2026-08-10

### Changed

- Dodano wyraźny, zgodny z motywem VS Code status aktualności oprogramowania w sekcji WERSJA.
- Przycisk otwarcia wydania jest widoczny tylko wtedy, gdy sprawdzanie potwierdzi dostępność nowszej wersji.

### Fixed

- Zielony status „OPROGRAMOWANIE AKTUALNE” nie jest wyświetlany, jeżeli najnowszej wersji nie udało się wiarygodnie ustalić.

## [0.2.2] - 2026-08-10

### Fixed

- Naprawiono zawieszający się UpdateService przez limit czasu 10 sekund i gwarantowane zakończenie stanu sprawdzania.
- Dodano jawne stany aktualizacji: bezczynny, sprawdzanie, wersja aktualna, dostępna aktualizacja, błąd i przekroczenie czasu.
- Dodano kanał Output `Kondzio AI` z diagnostyką komunikatu WebView, wywołania GitHub API, statusu HTTP, wersji i wyniku.
- Dodano test zgodności komunikacji WebView z Extension Host, wykrywający rozjazd `message.type`.

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
