# Bezpieczeństwo

## Push jest zablokowany

Rozszerzenie nie implementuje Git push. Orchestrator również nie powinien publikować zmian w zwykłym runie. Publikacja wymaga oddzielnej procedury i dokładnej frazy:

```text
ZATWIERDZAM PUSH
```

UI nie generuje tej frazy automatycznie. Podobne zdanie, zaznaczenie AUTO 3 albo kliknięcie **URUCHOM** nie jest zgodą na push.

## Commity

AUTO 1 nie zmienia plików. AUTO 2 wykonuje zmianę bez automatycznego commita. AUTO 3 może utworzyć lokalny commit po zaliczeniu testów i validation, ale zawsze zatrzymuje się przed push.

## Dry-run

Dry-run ma zwracać routing, plan, ryzyka, kryteria, ETA i oczekiwany zakres, lecz nie może modyfikować repozytorium. Po każdym dry-run warto potwierdzić `files_changed = 0` oraz czysty `git status --short`.

## Sandbox i origin

LOCAL pracuje w osobnej kopii, np. `E:\AI\Repos\Project_ORCHESTRATOR`, a nie w produkcyjnym repozytorium. Sandbox musi być czysty przed zadaniem. LOCAL nie powinien mieć możliwości publikowania do origin; sama obecność remote nie jest powodem do użycia go.

## Postcondition validation

Sukces zależy od dowodów, nie od deklaracji executora. Validator sprawdza:

- czy zadanie oczekiwało zmiany;
- czy wykryto rzeczywisty diff lub nowy plik;
- czy pliki należą do zakresu;
- czy wymagane testy zostały uruchomione i przeszły;
- czy nie wykonano niedozwolonego commita albo push;
- czy mierzalne acceptance criteria są spełnione.

Jeżeli zmiana była wymagana, a `files_changed == 0`, stan nie może być `completed`. Powinien być `failed_validation` albo `incomplete`.

## Ochrona przed pustym sukcesem

Kod wyjścia `0` oznacza tylko zakończenie procesu. Orchestrator odróżnia **PROCESS FINISHED** od **TASK SUCCESSFULLY COMPLETED**. Po dwóch nieskutecznych próbach LOCAL następuje eskalacja do CODEX, a jej wynik również podlega validation.

## Git status

Przed pracą sprawdź czystość właściwego sandboxu, a po pracy przejrzyj status i diff. Nie usuwaj niezidentyfikowanych zmian, nawet jeśli blokują run — mogą należeć do użytkownika.
