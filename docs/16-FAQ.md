# FAQ

## 1. Czy Kondzio AI działa bez internetu?

Panel, LOCAL i część funkcji backendu mogą działać lokalnie. Research wymaga dostępu do źródeł przez SearXNG albo DDGS, a Codex może wymagać połączenia zależnie od konfiguracji.

## 2. Czy LOCAL działa bez Codexa?

Tak, jeśli Ollama, Qwen i Aider działają. Codex jest jednak potrzebny do automatycznej eskalacji trudnego lub nieskutecznego zadania.

## 3. Czy Research wymaga internetu?

Zwykle tak. Sam SearXNG może działać lokalnie, lecz musi pobrać wyniki z zewnętrznych wyszukiwarek i stron.

## 4. Czy AUTO 3 może zrobić push?

Nie. AUTO 3 może dopuścić lokalny commit, ale zawsze zatrzymuje się przed push.

## 5. Czy mogę używać tylko Codexa?

Tak. Wybierz wykonawcę CODEX albo używaj Codex Chat z narzędziami MCP.

## 6. Czy mogę wyłączyć LOCAL?

W pojedynczym zadaniu wybierz CODEX. Trwałą zmianę polityki routingu wykonuje się w backendzie, nie w UI.

## 7. Co się dzieje po `failed_validation`?

Run nie jest sukcesem. Przeczytaj `validation.reason`, diff, testy i log prób, a następnie popraw przyczynę albo uruchom nowe zadanie.

## 8. Czy mogę zmienić model Ollama?

Tak, w `config.yaml` Orchestratora. Najpierw potwierdź dokładną nazwę przez `ollama list` i przetestuj zgodność Aider.

## 9. Czy mogę zmienić ścieżkę repozytorium?

Tak, ale konfiguruj bezpieczny sandbox backendu. Nie wskazuj produkcyjnego repo dla eksperymentalnego LOCAL.

## 10. Czy rozszerzenie działa bez SearXNG?

Zadania bez researchu mogą działać. Research może przełączyć się na DDGS, jeżeli fallback jest skonfigurowany.

## 11. Jak działa fallback DDGS?

Backend używa go po niepowodzeniu SearXNG i oznacza dostawcę w wyniku. Ranking i analiza Qwen nadal działają na zebranych źródłach.

## 12. Gdzie są logi?

Logi MCP są w `E:\AI\Orchestrator\mcp\logs`, a logi VS Code w `%APPDATA%\Code\logs` lub katalogu profilu developerskiego.

## 13. Gdzie są runy?

Domyślnie w `E:\AI\Orchestrator\runs\<RUN-ID>`.

## 14. Jak sprawdzić ostatni raport?

Kliknij **OSTATNI RAPORT**, użyj komendy **Kondzio AI: Last Report** albo narzędzia `orchestrator_last_report` w Codex Chat.

## 15. Czy można anulować run?

Tak, przyciskiem **ANULUJ** lub `orchestrator_cancel`. Anulowanie nie cofa automatycznie zmian już zapisanych w sandboxie.

## 16. Co oznacza `escalating`?

LOCAL nie spełnił kryteriów po dozwolonych próbach i zadanie jest przekazywane do CODEX.

## 17. Jak działa ETA?

Backend zwraca MIN, TYPICAL i MAX na podstawie złożoności, wykonawcy, autonomii i historii. To estymacja, nie termin gwarantowany.

## 18. Czy historia ETA się kalibruje?

Tak, Orchestrator zapisuje rzeczywiste czasy i może używać ich do kolejnych estymacji.

## 19. Czy rozszerzenie aktualizuje Orchestrator?

Nie. VSIX i backend są aktualizowane oddzielnie.

## 20. Czy aktualizacja VSIX jest automatyczna?

Nie. Wersja 0.2.0 może sprawdzić GitHub Releases najwyżej raz na 24 godziny, ale nowy VSIX instaluje się ręcznie po zgodzie oraz weryfikacji wersji i SHA-256.

## 21. Czy dry-run zawsze oznacza zero zmian?

Tak, to warunek bezpieczeństwa. Każda wykryta zmiana oznacza błąd wymagający wyjaśnienia.

## 22. Czy panel może wykonać commit?

Panel nie wykonuje Git. W AUTO 3 backend może dopuścić commit po validation.

## 23. Czy panel generuje frazę zatwierdzającą push?

Nie. Fraza `ZATWIERDZAM PUSH` nie jest generowana ani wysyłana przez UI.

## 24. Dlaczego pasek postępu nie rośnie płynnie?

Backend udostępnia etapy, a nie dokładny procent. Panel mapuje je orientacyjnie, aby nie udawać precyzji.

## 25. Czy można uruchomić dwa zadania jednocześnie?

Technicznie dwa klienty mogą wywołać MCP, ale nie należy uruchamiać równoległych executorów w tym samym sandboxie. Grozi to mieszaniem diffów i niewiarygodną walidacją.
