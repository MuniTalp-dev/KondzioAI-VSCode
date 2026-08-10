# Changelog

Wszystkie istotne zmiany projektu są dokumentowane w tym pliku. Format opiera się na Keep a Changelog, a wersje stosują Semantic Versioning.

## [Unreleased]

## [0.3.3] - 2026-08-10

### Added

- Rozdzielono diagnostykę Codex IDE i opcjonalnego Codex CLI, dodając wykrywanie przez PATH, `where.exe` oraz własną ścieżkę.
- Dodano aktualizację jednym kliknięciem wyłącznie z GitHub Releases `MuniTalp-dev/KondzioAI-VSCode`, z weryfikacją SHA-256, instalacją przez oficjalne VS Code CLI i jawnym przeładowaniem okna.

### Tests

- Dodano testy wykrywania Codex CLI, assetów release, sum kontrolnych, sukcesu i błędów instalacji oraz wymaganych kliknięć.

## [0.3.2] - 2026-08-10

### Fixed

- Przekazywanie `sandboxPath` i `projectsRoot` z panelu do backendu oraz rozwiązywanie właściwego repozytorium dla realnych runów LOCAL.

### Tests

- Potwierdzono realny run LOCAL: status `completed`, jeden zmieniony plik, `dotnet test` 5/5, spełnione kryteria akceptacji i zero wykonań CODEX.

## [0.3.1] - 2026-08-10

### Fixed

- Naprawiono błąd składni klienta WebView wywołany przez surowy znak nowej linii w literałach JavaScript.
- Przeniesiono klienta panelu do `media/webview.js`, dodano CSP/nonce, bezpieczne escapowanie danych oraz raportowanie błędów klienta.

### Tests

- Dodano kontrolę składni zewnętrznego skryptu oraz regresje dla ścieżek Windows, cudzysłowów, nowych linii i sekwencji `</script>`.

## [0.3.0] - 2026-08-10

### Added

- Dodano jeden centralny message bus WebView dla uruchamiania zadań, researchu, historii, kontroli narzędzi i aktualizacji.
- Dodano diagnostykę utworzenia panelu i inicjalizacji klienta WebView oraz ustawienia czterech ścieżek z wyborem katalogu.

### Changed

- Panel jest bardziej kompaktowy, responsywny od 260 do 500 px, dostępny z klawiatury i używa akcentu RAL 6018.
- Uporządkowano nazwy, statusy, przyciski i informacje o autonomii, wykonawcy, trybie próbnym, narzędziach, wersji, historii i researchu.

### Tests

- Dodano testy centralnego busa dla `run`, `healthCheck`, `research`, `history` i `checkForUpdates` oraz inicjalizacji klienta.

## [0.2.5] - 2026-08-10

### Added

- Dodano niezależną od WebView komendę `Kondzio AI: Check for Updates` z komunikatami VS Code i diagnostyką w kanale Output.
- Dodano komendy `Reload Panel` oraz `Reset WebView State` do awaryjnego odtworzenia panelu i wyczyszczenia wyłącznie jego stanu UI.
- W panelu dodano widoczną instrukcję użycia sprawdzania aktualizacji z palety poleceń.

### Tests

- Dodano test bezpośredniego przepływu command → UpdateService oraz przypadków `current` i `updateAvailable`.

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
