import assert from "node:assert/strict";
import test from "node:test";
import { detectCodexCli, enrichCodexHealth, resolveCodexCli } from "../src/codexHealth";

test("Windows preferuje codex.cmd znaleziony przez where.exe", async () => {
  const runner = async () => ({ code: 0, stdout: "C:\\bin\\codex\r\nC:\\bin\\codex.cmd\r\n", stderr: "" });
  assert.equal(await resolveCodexCli("", runner, "win32", "", () => false), "C:\\bin\\codex.cmd");
});

test("własna codexCliPath ma pierwszeństwo", async () => {
  let called = false;
  const runner = async () => { called = true; return { code: 1, stdout: "", stderr: "" }; };
  assert.equal(await resolveCodexCli("C:\\Program Files\\Codex\\codex.cmd", runner, "win32", "", () => true), "C:\\Program Files\\Codex\\codex.cmd");
  assert.equal(called, false);
});

test("PATH fallback działa poza Windows", async () => {
  const runner = async (command: string) => ({ code: 0, stdout: command === "which" ? "/usr/local/bin/codex\n" : "", stderr: "" });
  assert.equal(await resolveCodexCli("", runner, "linux", "", () => false), "/usr/local/bin/codex");
});

test("Windows używa fallbacku APPDATA npm", async () => {
  const runner = async () => ({ code: 1, stdout: "", stderr: "not found" });
  assert.equal(await resolveCodexCli("", runner, "win32", "C:\\Users\\x\\AppData\\Roaming", path => path.endsWith("npm\\codex.cmd")), "C:\\Users\\x\\AppData\\Roaming\\npm\\codex.cmd");
});

test("brak Codex CLI daje WARNING", async () => {
  const item = await detectCodexCli("", async () => ({ code: 1, stdout: "", stderr: "not found" }), () => {}, "win32", "", () => false);
  assert.equal(item.status, "WARNING");
  assert.match(item.detail ?? "", /wymagany tylko.*CODEX/i);
});

test("health wywołuje --version na resolved codex.cmd i loguje bez sekretów", async () => {
  const calls: Array<[string, string[]]> = [], logs: string[] = [];
  const runner = async (command: string, args: string[]) => {
    calls.push([command, args]);
    return command === "where.exe"
      ? { code: 0, stdout: "C:\\Tools With Spaces\\codex.cmd\n", stderr: "" }
      : { code: 0, stdout: "codex-cli 0.147.0", stderr: "" };
  };
  assert.deepEqual(await detectCodexCli("", runner, value => logs.push(value)), { name: "Codex CLI", status: "OK", version: "0.147.0" });
  assert.deepEqual(calls[1], ["C:\\Tools With Spaces\\codex.cmd", ["--version"]]);
  assert.deepEqual(logs, ["Codex CLI resolved: C:\\Tools With Spaces\\codex.cmd", "Codex CLI version: 0.147.0"]);
});

test("ścieżka i argument z odstępami oraz cudzysłowami pozostają oddzielnymi wartościami", async () => {
  const calls: Array<[string, string[]]> = [];
  const runner = async (command: string, args: string[]) => { calls.push([command, args]); return { code: 0, stdout: "codex-cli 1.2.3", stderr: "" }; };
  const path = "C:\\Codex CLI\\codex.cmd";
  await detectCodexCli(path, runner, () => {}, "win32", "", () => true);
  assert.deepEqual(calls, [[path, ["--version"]]]);
  assert.deepEqual([path, 'argument ze spacjami i "cudzysłowami"'], [path, 'argument ze spacjami i "cudzysłowami"']);
});

test("Codex IDE i Codex CLI są osobnymi komponentami", async () => {
  const result = await enrichCodexHealth({ checked_at: "now", items: [{ name: "Codex CLI", status: "ERROR" }] }, true, "", async () => ({ code: 1, stdout: "", stderr: "" }), () => {}, "linux", "", () => false);
  assert.equal(result.items.find(item => item.name === "Codex IDE")?.status, "OK");
  assert.equal(result.items.find(item => item.name === "Codex CLI")?.status, "WARNING");
});
