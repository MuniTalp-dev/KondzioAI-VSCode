import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { checksumForAsset, installUpdate, resolveVsCodeCli, vsCodeCliInvocation } from "../src/updateInstaller";
import { UpdateResult } from "../src/types";

const bytes = new TextEncoder().encode("safe-vsix");
const sha = createHash("sha256").update(bytes).digest("hex");
const release: UpdateResult = { status: "updateAvailable", currentVersion: "0.4.3", latestVersion: "v0.4.4", vsixName: "kondzio-ai-0.4.4.vsix", vsixUrl: "https://github.test/file", checksumUrl: "https://github.test/sums" };
const fetcher = (sum = sha) => async (_url: string) => ({ ok: true, status: 200, async bytes() { return bytes; }, async text() { return `${sum}  kondzio-ai-0.4.4.vsix`; } });
const resolvedCode = "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd";
const resolver = async () => resolvedCode;

test("Windows preferuje code.cmd znaleziony przez where.exe", async () => {
  const runner = async () => ({ code: 0, stdout: "C:\\bin\\code\r\nC:\\bin\\code.cmd\r\n", stderr: "" });
  assert.equal(await resolveVsCodeCli(runner, "win32", "", () => false), "C:\\bin\\code.cmd");
});

test("Windows używa fallbacku LOCALAPPDATA", async () => {
  const runner = async () => ({ code: 1, stdout: "", stderr: "not found" });
  const result = await resolveVsCodeCli(runner, "win32", "C:\\Users\\x\\AppData\\Local", path => path.endsWith("Microsoft VS Code\\bin\\code.cmd"));
  assert.equal(result, "C:\\Users\\x\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd");
});

test("opcjonalny fallback znajduje code-insiders.cmd", async () => {
  const runner = async (_command: string, args: string[]) => args[0] === "code-insiders"
    ? { code: 0, stdout: "C:\\Insiders\\code-insiders.cmd\n", stderr: "" }
    : { code: 1, stdout: "", stderr: "" };
  assert.equal(await resolveVsCodeCli(runner, "win32", "", () => false), "C:\\Insiders\\code-insiders.cmd");
});

test("ścieżki CLI i VSIX ze spacjami pozostają oddzielnymi argumentami bez shell:true", () => {
  const vsix = "C:\\Users\\Jan Kowalski\\Temp Files\\kondzio-ai-0.4.4.vsix";
  const invocation = vsCodeCliInvocation(resolvedCode, ["--install-extension", vsix, "--force"], "win32", "C:\\Windows\\System32\\cmd.exe");
  assert.equal(invocation.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(invocation.args, ["/d", "/s", "/c", `""${resolvedCode}" "--install-extension" "${vsix}" "--force""`]);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsVerbatimArguments, true);
});

test("install success używa resolved CLI i zapisuje wymagane logi", async () => {
  const stages: string[] = [], logs: string[] = []; let command = "", args: string[] = [];
  const urls: string[] = []; const source = fetcher();
  const result = await installUpdate(release, stage => stages.push(stage), value => logs.push(value), async (url, _signal) => { urls.push(url); return source(url); }, async (value, passed) => { command = value; args = passed; return { code: 0, stderr: "" }; }, 30_000, resolver);
  assert.equal(result.sha256, sha); assert.deepEqual(stages, ["Weryfikacja SHA-256...", "Pobieranie aktualizacji...", "Instalowanie..."]);
  assert.deepEqual(urls, [release.checksumUrl, release.vsixUrl]); assert.equal(command, resolvedCode);
  assert.deepEqual(args.slice(0, 1), ["--install-extension"]); assert.match(args[1], /kondzio-ai-0\.4\.4\.vsix$/); assert.equal(args.at(-1), "--force");
  assert.ok(logs.some(value => value === `VS Code CLI resolved: ${resolvedCode}`));
  assert.ok(logs.some(value => value.startsWith("Installing VSIX: "))); assert.ok(logs.includes("VS Code CLI exit code: 0"));
});

test("install non-zero exit raportuje kod i stderr", async () => {
  const logs: string[] = [];
  await assert.rejects(() => installUpdate(release, () => {}, value => logs.push(value), fetcher(), async () => ({ code: 7, stderr: "denied" }), 30_000, resolver), /denied/);
  assert.ok(logs.includes("VS Code CLI exit code: 7"));
});

test("brak VS Code CLI zatrzymuje instalację", async () => {
  let installed = false;
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, fetcher(), async () => { installed = true; return { code: 0, stderr: "" }; }, 30_000, async () => undefined), /VS Code CLI/);
  assert.equal(installed, false);
});

test("checksum incorrect => abort bez instalacji", async () => {
  let installed = false;
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, fetcher("0".repeat(64)), async () => { installed = true; return { code: 0, stderr: "" }; }, 30_000, resolver), /niezgodna/);
  assert.equal(installed, false);
});

test("brak assetu VSIX przerywa przed pobieraniem i instalacją", async () => {
  let touched = false;
  await assert.rejects(() => installUpdate({ status: "updateAvailable", currentVersion: "0.4.3", latestVersion: "v0.4.4" }, () => {}, () => {}, async () => { touched = true; throw new Error(); }, async () => { touched = true; return { code: 0, stderr: "" }; }), /brak właściwego assetu VSIX/i);
  assert.equal(touched, false);
});

test("brak SHA256SUMS.txt blokuje automatyczną instalację", async () => {
  let touched = false;
  await assert.rejects(() => installUpdate({ ...release, checksumUrl: undefined }, () => {}, () => {}, async () => { touched = true; throw new Error(); }, async () => { touched = true; return { code: 0, stderr: "" }; }), /Błąd bezpieczeństwa.*SHA256SUMS\.txt/);
  assert.equal(touched, false);
});

test("inna nazwa VSIX w manifeście jest blokowana", async () => {
  let installed = false;
  const wrong = async () => ({ ok: true, status: 200, async bytes() { return bytes; }, async text() { return `${sha}  kondzio-ai-9.9.9.vsix`; } });
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, wrong, async () => { installed = true; return { code: 0, stderr: "" }; }, 30_000, resolver), /nie zawiera dokładnie jednej/);
  assert.equal(installed, false);
});

test("parser wybiera wyłącznie dokładną nazwę i odrzuca przypadkową lub zduplikowaną linię", () => {
  const other = "1".repeat(64);
  assert.equal(checksumForAsset(`${other}  backup-kondzio-ai-0.4.4.vsix\n${sha.toUpperCase()} *kondzio-ai-0.4.4.vsix`, release.vsixName!), sha);
  assert.equal(checksumForAsset(`${sha}  prefix-kondzio-ai-0.4.4.vsix`, release.vsixName!), undefined);
  assert.equal(checksumForAsset(`${sha}  kondzio-ai-0.4.4.vsix\n${sha} *kondzio-ai-0.4.4.vsix`, release.vsixName!), undefined);
});
