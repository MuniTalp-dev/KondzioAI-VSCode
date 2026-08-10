# Development

## Przygotowanie

```powershell
cd E:\AI\Orchestrator\vscode-extension
npm ci
npm run compile
npm test
```

`npm ci` używa `package-lock.json` i jest preferowane w CI. `npm install` służy do świadomej zmiany zależności.

## Extension Development Host

1. Otwórz katalog `vscode-extension` w VS Code.
2. Wybierz konfigurację **Run Kondzio AI Extension**.
3. Naciśnij `F5`.
4. W nowym oknie otwórz ikonę Kondzio AI.

Konfiguracja `.vscode/launch.json` uruchamia kompilację przed startem. Przy pracy ciągłej można użyć `npm run watch`.

## Testy

```powershell
npm test
E:\AI\Orchestrator\.venv\Scripts\python.exe .\test\bridge_integration.py
```

Pierwsze polecenie testuje kontroler, tryby, błędy i mapowanie statusów. Drugie wykonuje prawdziwy dry-run i research przez MCP; może wymagać SearXNG i Qwen.

## Pakowanie

```powershell
npm run package
```

Skrypt uruchamia testy i `vsce package`. Wynik to `kondzio-ai-X.Y.Z.vsix`.

## Struktura katalogów

| Katalog | Zawartość |
|---|---|
| `src` | TypeScript rozszerzenia |
| `python` | cienki adapter MCP |
| `test` | testy jednostkowe i integracyjne |
| `media` | ikona Activity Bar |
| `docs` | dokumentacja polska |
| `dist` | wynik kompilacji, nie edytować ręcznie |

## Zasady nowych funkcji

1. Najpierw ustal, czy funkcja należy do UI czy backendu.
2. Nie duplikuj routingu, researchu, validation ani polityki Git w panelu.
3. Preferuj istniejące narzędzia MCP; zmianę API traktuj jako migrację kontraktu.
4. Dane z backendu renderuj przez `textContent` lub bezpieczne kodowanie.
5. Dodaj test sukcesu, błędu i odpowiedniego statusu.
6. Nie generuj frazy push i nie dodawaj bezpośrednich komend Git.
7. Przed release uruchom test adaptera i ręczny test Extension Development Host.
