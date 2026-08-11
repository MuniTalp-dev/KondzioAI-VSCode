import assert from "node:assert/strict";
import test from "node:test";
import { detectClaudeCli, resolveClaudeCli } from "../src/claudeHealth";

test("Claude executor detection rozpoznaje brak CLI", async () => {
  const result = await detectClaudeCli(async () => ({ code: 1, stdout: "", stderr: "not found" }));
  assert.equal(result.status, "WARNING"); assert.match(result.detail ?? "", /wyłączony/);
});

test("Windows wykrywa oficjalny wrapper Claude CLI", async () => {
  const runner = async () => ({ code: 0, stdout: "C:\\bin\\claude.cmd\n", stderr: "" });
  assert.equal(await resolveClaudeCli(runner, "win32", "", () => false), "C:\\bin\\claude.cmd");
});
