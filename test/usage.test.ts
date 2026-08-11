import assert from "node:assert/strict";
import test from "node:test";
import { ClaudeUsageProvider, CodexUsageProvider, parseClaudeRateLimits, UsageService } from "../src/usage";
import { AiUsageProvider } from "../src/types";

test("extension discovery bez publicznego API zwraca unsupported", async () => {
  const result = await new CodexUsageProvider(async () => ({ id: "openai.chatgpt", version: "26.803.61601", active: true, exportsKeys: [], commands: [] })).retrieve();
  assert.equal(result.available, false); assert.equal(result.source, "unsupported"); assert.equal(result.sourceVersion, "26.803.61601");
});

test("brak rozszerzenia Codex jest bezpiecznym fallbackiem", async () => {
  assert.equal((await new CodexUsageProvider(async () => undefined).retrieve()).available, false);
});

test("Claude wybiera najbardziej ograniczające okno i zachowuje wszystkie okna", () => {
  const result = parseClaudeRateLimits({ version: "2.1.90", rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 81.2, resets_at: 1738857600 } } });
  assert.equal(result.available, true); assert.equal(result.usedPercent, 81.2); assert.equal(result.remainingPercent, 18.8); assert.equal(result.windows.length, 2); assert.equal(result.source, "claude-rate-limits");
});

test("malformed usage data nie przecieka wyjątkiem z providera", async () => {
  const result = await new ClaudeUsageProvider("status.json", undefined, async () => "{bad").retrieve();
  assert.equal(result.available, false); assert.match(result.error ?? "", /JSON/);
});

test("brak rate_limits zwraca niedostępne bez zgadywania", async () => {
  const result = await new ClaudeUsageProvider("status.json", undefined, async () => "{}").retrieve();
  assert.equal(result.available, false); assert.equal(result.usedPercent, undefined);
});

test("cache obowiązuje przez pięć minut i force odświeża", async () => {
  let calls = 0, now = 0;
  const provider: AiUsageProvider = { provider: "CODEX", async retrieve() { calls++; return { provider: "CODEX", available: false, windows: [], source: "unsupported", retrievedAt: String(calls) }; } };
  const service = new UsageService([provider], 300_000, () => now);
  await service.getAll(); now = 299_999; await service.getAll(); assert.equal(calls, 1);
  await service.getAll(true); assert.equal(calls, 2); now = 600_000; await service.getAll(); assert.equal(calls, 3);
});

test("public API provider może być podłączony przez wspólny kontrakt", async () => {
  const provider: AiUsageProvider = { provider: "CODEX", async retrieve() { return { provider: "CODEX", available: true, usedPercent: 40, remainingPercent: 60, windows: [], source: "vscode-public-api", retrievedAt: "now" }; } };
  assert.equal((await new UsageService([provider]).getAll())[0].source, "vscode-public-api");
});
