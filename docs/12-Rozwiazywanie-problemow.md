# Rozwiązywanie problemów

## SearXNG nie odpowiada

**Objaw:** research zwraca timeout, błąd lub provider `DDGS`. **Przyczyna:** zatrzymany kontener, błędny URL albo port. **Rozwiązanie:** sprawdź Docker i `research.searxng_url`; uruchom test endpointu. DDGS jest dopuszczalnym fallbackiem, ale oznacz wynik jako `WARNING`.

## Ollama nie działa

**Objaw:** LOCAL albo analiza Qwen nie startuje. **Przyczyna:** usługa jest zatrzymana lub URL jest błędny. **Rozwiązanie:** uruchom Ollama, wykonaj `ollama list` i sprawdź `ollama.url`.

## Qwen nie jest dostępny

**Objaw:** Ollama działa, lecz zgłasza brak modelu. **Przyczyna:** model nie został pobrany albo nazwa w konfiguracji jest inna. **Rozwiązanie:** sprawdź `ollama list`, a następnie skonfiguruj lub pobierz `qwen2.5-coder:7b`.

## Aider otwiera przeglądarkę

**Objaw:** pojawia się strona dokumentacji lub pytanie o URL. **Przyczyna:** executor nie używa flag zgodnych z wersją Aider. **Rozwiązanie:** sprawdź `aider --help`; wymagane są m.in. `--no-browser`, `--no-detect-urls`, `--disable-playwright` i tryb nieinteraktywny.

## Codex CLI jest niedostępny

**Objaw:** eskalacja kończy się `failed_executor`. **Przyczyna:** brak polecenia, autoryzacji albo niezgodna flaga. **Rozwiązanie:** wykonaj `codex --version` i `codex exec --help`; nie zakładaj opcji ze starszej wersji.

## LOCAL nic nie zmienił

**Objaw:** kod procesu 0 i pusty diff. **Przyczyna:** zły katalog sandboxu, brak właściwych plików w kontekście albo model tylko opisał zmianę. **Rozwiązanie:** sprawdź `local_sandbox`, wykrywanie plików i historię prób. Validator powinien odrzucić wynik, ponowić LOCAL i eskalować do CODEX.

## `failed_validation`

**Objaw:** executor zakończył pracę, ale run nie jest `completed`. **Przyczyna:** pusty diff, niepotwierdzone testy, pliki poza zakresem lub niedozwolona operacja. **Rozwiązanie:** przeczytaj `validation.reason`, acceptance criteria, diff i log prób.

## `escalating`

**Objaw:** agent zmienia się z LOCAL na CODEX. **Przyczyna:** dwie próby LOCAL nie spełniły kryteriów. **Rozwiązanie:** zwykle zaczekaj; jeżeli CODEX także zawiedzie, sprawdź końcowy raport.

## Testy nie przeszły

**Objaw:** `test_status=failed` albo `failed_or_unconfirmed`. **Przyczyna:** regresja, błędny filtr, brak restore lub SDK. **Rozwiązanie:** uruchom wskazaną komendę testową w sandboxie, napraw przyczynę i nie commituj wyniku.

## Dry-run zmienił plik

**Objaw:** `files_changed` nie jest puste. **Przyczyna:** krytyczny błąd polityki lub pliki pomocnicze zapisane w repo. **Rozwiązanie:** zatrzymaj pracę, zachowaj diff, nie usuwaj cudzych zmian i zgłoś naruszenie; dry-run nie może być uznany za poprawny.

## VS Code nie widzi MCP

**Objaw:** Codex Chat nie ma sześciu narzędzi. **Przyczyna:** błędna konfiguracja MCP lub zatrzymany serwer. **Rozwiązanie:** sprawdź konfigurację Codex, `mcp_server.py` i test integracyjny backendu.

## Rozszerzenie nie widzi Orchestratora

**Objaw:** panel pokazuje błąd backendu. **Przyczyna:** niepoprawny root, Python lub brak pakietu MCP w `.venv`. **Rozwiązanie:** popraw ustawienia, wykonaj Reload Window i uruchom `test\bridge_integration.py`.

## Brak ikony w Activity Bar

**Objaw:** VSIX jest zainstalowany, ale brak Kondzio AI. **Przyczyna:** rozszerzenie wyłączone, brak Reload Window albo kontener widoku ukryty. **Rozwiązanie:** sprawdź Extensions, przeładuj okno i w menu kontekstowym Activity Bar włącz Kondzio AI.

## Update check nie działa

**Objaw:** panel nie informuje o nowej wersji. **Przyczyna:** puste lub błędne `kondzioAi.updateRepository`, limit 24 godzin, brak sieci albo błąd GitHub API. **Rozwiązanie:** ustaw `owner/KondzioAI-VSCode`, użyj ręcznego sprawdzenia i odczytaj szczegóły błędu; w razie potrzeby porównaj wersję oraz SHA-256 ręcznie.
