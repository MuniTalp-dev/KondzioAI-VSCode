import assert from "node:assert/strict";
import test from "node:test";
import { detectCodexCli, enrichCodexHealth } from "../src/codexHealth";

test("Codex CLI found => OK", async () => {
  const runner = async (command: string) => command.includes("where") ? { code: 0, stdout: "C:\\bin\\codex.exe\n", stderr: "" } : { code: 0, stdout: "codex-cli 1.2.3", stderr: "" };
  assert.deepEqual(await detectCodexCli("", runner), { name: "Codex CLI", status: "OK", version: "codex-cli 1.2.3" });
});

test("Codex CLI missing => WARNING i nie ogólny ERROR", async () => {
  const item = await detectCodexCli("", async () => ({ code: 1, stdout: "", stderr: "not found" }));
  assert.equal(item.status, "WARNING"); assert.match(item.detail ?? "", /wymagany tylko.*CODEX/i);
});

test("Codex IDE i Codex CLI są osobnymi komponentami", async () => {
  const result = await enrichCodexHealth({ checked_at: "now", items: [{ name: "Codex CLI", status: "ERROR" }] }, true, "", async () => ({ code: 1, stdout: "", stderr: "" }));
  assert.equal(result.items.find(item => item.name === "Codex IDE")?.status, "OK");
  assert.equal(result.items.find(item => item.name === "Codex CLI")?.status, "WARNING");
});
