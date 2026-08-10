# Aktualizacje

Wersja 0.2.0 sprawdza najnowszy GitHub Release ręcznie albo automatycznie maksymalnie raz na 24 godziny. Wymaga ustawienia `kondzioAi.updateRepository` jako `owner/KondzioAI-VSCode`.

Panel pokazuje `Kondzio AI v0.2.0 · Aktualne`, informację o dostępnej wersji albo czytelny błąd API. Nie pobiera i nie instaluje paczki bez zgody.

## Ręczna aktualizacja rozszerzenia

1. Kliknij **AKTUALIZUJ** i potwierdź otwarcie GitHub Release albo przejdź do zaufanego release ręcznie.
2. Porównaj wersję i opublikowaną sumę SHA-256.
3. W VS Code uruchom **Extensions: Install from VSIX...**.
4. Wskaż nową paczkę i wykonaj **Developer: Reload Window**.
5. Uruchom AUTO 1 + Dry-run oraz prosty Research.

Można również użyć:

```powershell
code --install-extension "ścieżka\kondzio-ai-X.Y.Z.vsix" --force
```

Kliknięcie nie instaluje VSIX. Instalacja nadal wymaga świadomego wyboru pliku przez użytkownika.

## Aktualizacja Orchestratora

Backend aktualizuje się niezależnie od VSIX. Przed wymianą sprawdź kompatybilność sześciu narzędzi MCP, wykonaj backup i uruchom test integracyjny adaptera. Nie kopiuj nowego routingu ani Research Engine do rozszerzenia.

## Kompatybilność

Zmiana nazw narzędzi, pól statusu lub wartości enum może wymagać nowej wersji rozszerzenia. Pola dodawane przez backend powinny być ignorowane bez błędu; usunięcie używanego pola wymaga migracji.

Proces wydawniczy opisuje [Release](15-Release.md), a awarie aktualizacji — [Rozwiązywanie problemów](12-Rozwiazywanie-problemow.md).
