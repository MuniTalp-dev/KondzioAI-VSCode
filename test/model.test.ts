import assert from "node:assert/strict";
import test from "node:test";
import { OrchestratorController, progressFor, statusBarText } from "../src/model";
import { AUTONOMY_DESCRIPTIONS, MODE_DESCRIPTIONS } from "../src/descriptions";
import { HealthResult, OrchestratorBackend } from "../src/types";

class FakeBackend implements OrchestratorBackend {
  calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  fail = false;
  health: HealthResult = { checked_at: "now", items: [
    { name: "Ollama", status: "OK", version: "0.11" }, { name: "Qwen", status: "OK", version: "qwen2.5-coder:7b" },
    { name: "Aider", status: "OK", version: "0.86.2" }, { name: "Codex CLI", status: "OK", version: "codex" },
    { name: "SearXNG", status: "OK" }
  ] };
  async call<T>(tool: string, args: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ tool, args });
    if (this.fail) { throw new Error("backend unavailable"); }
    if (tool === "extension_health") { return this.health as T; }
    return ({ run_id: "r1", status: "planned", runs: [], report: "# Raport", provider: "SearXNG" } as T);
  }
  dispose(): void {}
}

test("uruchamia AUTO 1", async () => {
  const backend = new FakeBackend();
  await new OrchestratorController(backend).run("plan", 1);
  assert.deepEqual(backend.calls[0], { tool: "orchestrator_run", args: { prompt: "plan", autonomy: 1, mode: "auto", dry_run: false, prefer_local: false, block_codex_escalation: false, codex_approved: false } });
});

test("uruchamia AUTO 2", async () => {
  const backend = new FakeBackend();
  await new OrchestratorController(backend).run("test", 2, "local");
  assert.equal(backend.calls[0].args.autonomy, 2); assert.equal(backend.calls[0].args.mode, "local");
});

<<<<<<< HEAD
for (const mode of ["auto", "local", "codex", "claude", "research"] as const) {
  test(`przekazuje wykonawcę ${mode.toUpperCase()}`, async () => {
    const backend = new FakeBackend();
    await new OrchestratorController(backend).run("test", 2, mode);
    assert.equal(backend.calls[0].args.mode, mode);
  });
}

=======
>>>>>>> origin/main
test("przekazuje polskie znaki do MCP bez zmiany", async () => {
  const backend = new FakeBackend();
  const prompt = "Zażółć gęślą jaźń. Możliwość, błędy, użytkownik, ścieżka.";
  await new OrchestratorController(backend).run(prompt, 2, "local", false, true, true);
  assert.equal(backend.calls[0].args.prompt, prompt);
});

test("przekazuje dry-run", async () => {
  const backend = new FakeBackend();
  await new OrchestratorController(backend).run("plan", 1, "auto", true);
  assert.equal(backend.calls[0].args.dry_run, true);
});

test("przekazuje jawny projekt przez MCP", async () => {
  const backend = new FakeBackend();
  await new OrchestratorController(backend).run("wersja", 2, "local", false, false, false, false,
    "E:\\AI\\Repos", "C:\\Projekty\\VCode", "E:\\AI\\Orchestrator\\vscode-extension", "KondzioAI-VSCode");
  assert.equal(backend.calls[0].args.projectRoot, "E:\\AI\\Orchestrator\\vscode-extension");
  assert.equal(backend.calls[0].args.repoRoot, "E:\\AI\\Orchestrator\\vscode-extension");
  assert.equal(backend.calls[0].args.projectName, "KondzioAI-VSCode");
});

test("przekazuje ochronę CODEX", async () => {
  const backend = new FakeBackend();
  await new OrchestratorController(backend).run("test", 2, "auto", false, true, true);
  assert.equal(backend.calls[0].args.prefer_local, true); assert.equal(backend.calls[0].args.block_codex_escalation, true);
});

test("awaiting_codex_approval nie jest błędem", () => {
  assert.equal(statusBarText({ run_id: "r", status: "awaiting_codex_approval" }), "Kondzio AI: CODEX WYMAGA ZGODY");
  assert.equal(progressFor("awaiting_codex_approval"), 100);
});

test("wywołuje status, historię, raport, research i cancel", async () => {
  const backend = new FakeBackend(); const controller = new OrchestratorController(backend);
  await controller.status("r1"); await controller.history(); await controller.lastReport(); await controller.research("dpi"); await controller.cancel("r1");
  assert.deepEqual(backend.calls.map(x => x.tool), ["orchestrator_status", "orchestrator_runs", "orchestrator_last_report", "orchestrator_research", "orchestrator_cancel"]);
});

test("propaguje błąd backendu", async () => {
  const backend = new FakeBackend(); backend.fail = true;
  await assert.rejects(() => new OrchestratorController(backend).status(), /backend unavailable/);
});

test("wyświetla failed_validation jako FAILED", () => {
  assert.equal(statusBarText({ run_id: "r", status: "failed_validation" }), "Kondzio AI: FAILED");
  assert.equal(progressFor("failed_validation"), 100);
});

test("wyświetla escalating jako aktywny etap", () => {
  assert.equal(statusBarText({ run_id: "r", status: "escalating", current_agent: "CODEX" }), "Kondzio AI: CODEX");
  assert.equal(progressFor("escalating"), 55);
});

test("udostępnia opisy AUTO 1/2/3 i wykonawców", () => {
  assert.match(AUTONOMY_DESCRIPTIONS[1], /brak zmian/); assert.match(AUTONOMY_DESCRIPTIONS[2], /bez automatycznego commita/);
  assert.match(AUTONOMY_DESCRIPTIONS[3], /push zawsze zatrzymany/); assert.match(MODE_DESCRIPTIONS.auto, /zalecany/);
  assert.match(MODE_DESCRIPTIONS.local, /Qwen.*Ollama.*Aider/); assert.match(MODE_DESCRIPTIONS.research, /SearXNG.*DDGS/); assert.match(MODE_DESCRIPTIONS.codex, /trudne zadania/);
});

test("health zwraca stany OK i wersje", async () => {
  const backend = new FakeBackend(); const result = await new OrchestratorController(backend).health();
  assert.equal(result.items[0].status, "OK"); assert.equal(result.items[0].version, "0.11");
});

test("health zachowuje stan ERROR i jego szczegóły", async () => {
  const backend = new FakeBackend(); backend.health.items[0] = { name: "Ollama", status: "ERROR", detail: "connection refused" };
  const result = await new OrchestratorController(backend).health();
  assert.equal(result.items[0].status, "ERROR"); assert.match(result.items[0].detail ?? "", /refused/);
});

test("AUTO dopuszcza fallback i zwraca ostrzeżenia", async () => {
  const backend = new FakeBackend(); backend.health.items[0].status = "ERROR";
  const result = await new OrchestratorController(backend).preflight("auto");
  assert.ok(result.warnings.some(value => value.includes("Ollama")));
});

test("wymuszony niedostępny LOCAL jest blokowany", async () => {
  const backend = new FakeBackend(); backend.health.items[0].status = "ERROR";
  await assert.rejects(() => new OrchestratorController(backend).preflight("local"), /LOCAL jest niedostępny/);
});

test("wymuszony niedostępny CODEX jest blokowany", async () => {
  const backend = new FakeBackend(); backend.health.items.find(x => x.name === "Codex CLI")!.status = "ERROR";
  await assert.rejects(() => new OrchestratorController(backend).preflight("codex"), /CODEX jest niedostępny/);
});

test("wymuszony niedostępny CLAUDE jest blokowany", async () => {
  const backend = new FakeBackend(); backend.health.items.push({ name: "Claude CLI", status: "WARNING" });
  await assert.rejects(() => new OrchestratorController(backend).preflight("claude"), /CLAUDE jest niedostępny/);
});

test("RESEARCH pokazuje fallback DDGS", async () => {
  const backend = new FakeBackend(); const searx = backend.health.items.find(x => x.name === "SearXNG")!;
  searx.status = "WARNING"; searx.detail = "Orchestrator użyje fallbacku DDGS.";
  const result = await new OrchestratorController(backend).preflight("research");
  assert.match(result.warnings[0], /DDGS/);
});
