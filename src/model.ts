import { Autonomy, ExecutorMode, HealthResult, OrchestratorBackend, RunRequest, StatusResult } from "./types";

export const ACTIVE_STATES = new Set(["starting", "running", "researching", "implementing", "testing", "validating", "escalating"]);
export const FAILURE_STATES = new Set(["failed_executor", "failed_validation", "incomplete", "cancelled"]);

export function progressFor(stage = ""): number {
  const normalized = stage.toLowerCase();
  if (["finished", "completed", "failed_executor", "failed_validation", "incomplete", "cancelled", "awaiting_codex_approval"].includes(normalized)) { return 100; }
  if (normalized.includes("escalat")) { return 55; }
  if (normalized.includes("research")) { return 25; }
  if (normalized.includes("plan")) { return 35; }
  if (normalized.includes("implement")) { return 60; }
  if (normalized.includes("test")) { return 80; }
  if (normalized.includes("valid")) { return 90; }
  return 10;
}

export function statusBarText(status?: StatusResult): string {
  if (!status) { return "Kondzio AI: IDLE"; }
  if (FAILURE_STATES.has(status.status)) { return "Kondzio AI: FAILED"; }
  if (status.status === "completed") { return "Kondzio AI: DONE"; }
  if (status.status === "awaiting_codex_approval") { return "Kondzio AI: CODEX WYMAGA ZGODY"; }
  return `Kondzio AI: ${(status.current_agent ?? status.status ?? "IDLE").toUpperCase()}`;
}

export class OrchestratorController {
  constructor(private readonly backend: OrchestratorBackend, private readonly healthTransform: (health: HealthResult) => Promise<HealthResult> = async health => health) {}
  run(prompt: string, autonomy: Autonomy = 2, mode: ExecutorMode = "auto", dryRun = false,
      preferLocal = false, blockCodexEscalation = false, codexApproved = false,
      sandboxPath?: string, projectsRoot?: string) {
    const request: RunRequest = { prompt, autonomy, mode, dry_run: dryRun, prefer_local: preferLocal,
                                  block_codex_escalation: blockCodexEscalation, codex_approved: codexApproved,
                                  ...(sandboxPath ? { sandbox_path: sandboxPath } : {}),
                                  ...(projectsRoot ? { projects_root: projectsRoot } : {}) };
    return this.backend.call<StatusResult>("orchestrator_run", request as unknown as Record<string, unknown>);
  }
  status(runId?: string) { return this.backend.call<StatusResult>("orchestrator_status", runId ? { run_id: runId } : {}); }
  history() { return this.backend.call<{ runs: unknown[] }>("orchestrator_runs"); }
  lastReport() { return this.backend.call<{ run_id?: string; report: string }>("orchestrator_last_report"); }
  research(query: string) { return this.backend.call<Record<string, unknown>>("orchestrator_research", { query }); }
  cancel(runId?: string) { return this.backend.call<Record<string, unknown>>("orchestrator_cancel", runId ? { run_id: runId } : {}); }
  async health() { return this.healthTransform(await this.backend.call<HealthResult>("extension_health")); }
  async preflight(mode: ExecutorMode): Promise<{ health: HealthResult; warnings: string[] }> {
    const health = await this.health();
    const byName = new Map(health.items.map(value => [value.name, value]));
    const unavailable = (names: string[]) => names.filter(name => byName.get(name)?.status === "ERROR");
    if (mode === "local") {
      const missing = unavailable(["Ollama", "Qwen", "Aider"]);
      if (missing.length) { throw new Error(`LOCAL jest niedostępny: ${missing.join(", ")}. Wybierz AUTO albo napraw środowisko.`); }
    }
    if (mode === "codex" && byName.get("Codex CLI")?.status !== "OK") {
      throw new Error("CODEX jest niedostępny. Wybierz AUTO albo napraw Codex CLI.");
    }
    const warnings: string[] = [];
    if (mode === "research" && byName.get("SearXNG")?.status !== "OK") {
      warnings.push(byName.get("SearXNG")?.detail ?? "SearXNG jest niedostępny; sprawdź fallback DDGS.");
    }
    if (mode === "auto") {
      for (const item of health.items.filter(value => value.status !== "OK")) { warnings.push(`${item.name}: ${item.detail ?? item.status}`); }
    }
    return { health, warnings };
  }
}
