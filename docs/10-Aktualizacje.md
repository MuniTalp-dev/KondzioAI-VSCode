# Aktualizacje

Wersja 0.2.3 sprawdza najnowszy GitHub Release ręcznie albo automatycznie maksymalnie raz na 24 godziny. Wymaga ustawienia `kondzioAi.updateRepository` jako `owner/KondzioAI-VSCode`.

Panel pokazuje wersję zainstalowaną, najnowszą wiarygodnie sprawdzoną wersję i jeden wyraźny status:

- `✓ OPROGRAMOWANIE AKTUALNE` po potwierdzeniu zgodności wersji;
- `⚠ DOSTĘPNA AKTUALIZACJA vX.Y.Z` wraz z przyciskiem otwarcia wydania;
- status sprawdzania, błędu albo przekroczenia czasu.

Zielony status nie pojawia się, jeżeli najnowszej wersji nie udało się wiarygodnie sprawdzić. Rozszerzenie nie pobiera ani nie instaluje paczki bez zgody.

## Ręczna aktualizacja rozszerzenia

1. Kliknij **SPRAWDŹ / OTWÓRZ WYDANIE** i potwierdź otwarcie GitHub Release albo przejdź do zaufanego release ręcznie.
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
