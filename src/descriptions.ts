export const AUTONOMY_DESCRIPTIONS: Record<1 | 2 | 3, string> = {
  1: "AUTO 1: planowanie, routing, research, ETA, ryzyka i acceptance criteria; brak zmian.",
  2: "AUTO 2: implementacja, testy, validation i diff; bez automatycznego commita.",
  3: "AUTO 3: pełny pipeline, retry i eskalacja; commit dozwolony, push zawsze zatrzymany."
};

export const MODE_DESCRIPTIONS = {
  auto: "AUTO (zalecany): Orchestrator wybiera wykonawcę i może zastosować fallback.",
  local: "LOCAL: Qwen + Ollama + Aider.",
  research: "RESEARCH: SearXNG + Qwen, z fallbackiem DDGS.",
  codex: "CODEX: trudne zadania programistyczne.",
  claude: "CLAUDE: oficjalny Claude Code CLI, tylko gdy jest dostępny."
} as const;
