# Release

## Wersjonowanie

Stosuj Semantic Versioning `MAJOR.MINOR.PATCH`:

- PATCH — poprawka bez zmiany kontraktu;
- MINOR — nowa kompatybilna funkcja;
- MAJOR — niekompatybilna zmiana MCP, konfiguracji lub zachowania UI.

## CHANGELOG

Przed wydaniem uzupełnij istniejący `CHANGELOG.md` o zmiany użytkowe, poprawki, bezpieczeństwo, znane ograniczenia i ewentualne migracje.

## Procedura

1. Upewnij się, że repo i sandbox są czyste.
2. Zaktualizuj wersję w `package.json` oraz lockfile.
3. Uruchom `npm ci`, `npm test` i test adaptera MCP.
4. Uruchom Extension Development Host i sprawdź panel.
5. Zbuduj `npm run package`.
6. Oblicz sumę:

```powershell
Get-FileHash .\kondzio-ai-X.Y.Z.vsix -Algorithm SHA256
```

7. Utwórz commit release zgodnie z polityką repozytorium.
8. Utwórz tag `vX.Y.Z` dopiero po zatwierdzeniu.
9. GitHub Actions powinno powtórzyć instalację, kompilację, testy, pakowanie i publikację artefaktu VSIX.
10. Release powinien zawierać VSIX, SHA-256, changelog i instrukcję ręcznej instalacji.

## CI

Minimalny workflow CI powinien używać `npm ci`, `npm test`, sprawdzenia linków Markdown i `npm run package`. Integracja z lokalnym Orchestratorem wymaga runnera Windows z przygotowanym Pythonem, Ollama i usługami; w zwykłym runnerze można użyć kontrolowanego mocka MCP.

## Aktualizacje użytkownika

Wersja 0.2.0 sprawdza GitHub Releases, ale instalacja VSIX pozostaje ręczna i wymaga zgody. Procedurę opisuje [Aktualizacje](10-Aktualizacje.md).

Push, publikacja release i tagowanie wymagają osobnej zgody właściciela projektu.
