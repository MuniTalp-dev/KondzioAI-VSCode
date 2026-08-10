# Architektura

Rozszerzenie jest cienką warstwą prezentacji. Nie zawiera routera, validatora ani drugiego Research Engine.

```text
VS Code Webview
       ↓ postMessage
TypeScript BackendClient
       ↓ JSONL / stdio
mcp_bridge.py
       ↓ MCP ClientSession
mcp_server.py
       ↓
Orchestrator
 ├─ Router
 ├─ Research
 ├─ Executors: LOCAL / CODEX
 ├─ Validator
 ├─ Tests
 └─ Reports
```

## Warstwa VS Code

`extension.ts` rejestruje WebviewView, osiem komend i status bar. `panel.ts` generuje HTML, odbiera komunikaty UI i odświeża aktywny run co 2 sekundy. `model.ts` zawiera kontroler wywołań oraz mapowanie statusów i orientacyjnego postępu. `types.ts` definiuje kontrakty danych.

## BackendClient i adapter

`backend.ts` uruchamia ukryty proces Python i wymienia komunikaty JSONL z `mcp_bridge.py`. Adapter tworzy standardowy `ClientSession`, uruchamia istniejący `mcp_server.py`, a następnie przekazuje nazwy narzędzi i argumenty. Nie interpretuje promptu i nie wykonuje Git.

## Backend Orchestratora

Router klasyfikuje zadanie, określa research i wykonawcę. Research zbiera źródła. Executor pracuje w sandboxie. Validator decyduje o sukcesie na podstawie kryteriów, diffu i testów. Każdy run zapisuje dane wejściowe, routing, plan, log, wynik i raport.

## Granice odpowiedzialności

- UI prezentuje i przekazuje dane.
- MCP zapewnia stabilny kontrakt sześciu narzędzi.
- Orchestrator podejmuje decyzje i egzekwuje politykę.
- Executor proponuje lub wykonuje zmianę, ale nie deklaruje ostatecznego sukcesu.
- Validator jest źródłem statusu `completed`.

Takie rozdzielenie pozwala używać tego samego backendu z panelu i Codex Chat.
