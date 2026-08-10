# Research

Research Engine jest częścią backendu, a panel jedynie wywołuje `orchestrator_research` i prezentuje wynik.

```text
SearXNG
   ↓
wyniki
   ↓
deduplikacja
   ↓
ranking
   ↓
wybór źródeł
   ↓
Qwen
   ↓
raport
```

## Wyszukiwanie i fallback

Podstawowym dostawcą jest lokalny SearXNG. Gdy nie odpowiada, backend może użyć DDGS. Informacja o providerze i ewentualnym ostrzeżeniu powinna być widoczna w wyniku.

## Deduplikacja i ranking

Adresy są normalizowane, aby ten sam dokument z parametrami zapytania nie zajmował kilku pozycji. Ranking premiuje źródła oficjalne i pierwotne, np. dokumentację producenta, repozytorium projektu albo standard. Ocena jest heurystyką, nie gwarancją trafności: strona na zaufanej domenie może być tematycznie poboczna.

## Marketingowe wyniki i wtórne porady

Materiały producentów bibliotek mogą opisywać wyłącznie ich produkt. Fora i blogi bywają użyteczne diagnostycznie, ale nie powinny zastępować dokumentacji API. W raporcie należy oddzielać fakty ze źródeł od rekomendacji i wniosków.

## Rola Qwen

Qwen analizuje wyłącznie zebrany materiał. Nie powinien wymyślać URL-i, tytułów ani twierdzeń bez oparcia. Model nadal może błędnie połączyć informacje lub pominąć warunek brzegowy, dlatego rekomendację trzeba skonfrontować z najlepszym źródłem i testem.

## Przykład

```text
Najlepszy sposób eksportowania zawartości WPF do PNG 300 DPI w .NET 10. Preferuj oficjalną dokumentację Microsoft i źródła pierwotne.
```

Wynik powinien pokazać provider, liczbę źródeł, TOP źródła z rankingiem oraz analizę Qwen obejmującą rekomendację i ryzyka.
