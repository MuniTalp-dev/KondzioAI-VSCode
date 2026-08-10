import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { installUpdate } from "../src/updateInstaller";
import { UpdateResult } from "../src/types";

const bytes = new TextEncoder().encode("safe-vsix");
const sha = createHash("sha256").update(bytes).digest("hex");
const release: UpdateResult = { status: "updateAvailable", currentVersion: "0.3.2", latestVersion: "v0.3.3", vsixName: "kondzio-ai-0.3.3.vsix", vsixUrl: "https://github.test/file", checksumUrl: "https://github.test/sums" };
const fetcher = (sum = sha) => async (_url: string) => ({ ok: true, status: 200, async bytes() { return bytes; }, async text() { return `${sum}  kondzio-ai-0.3.3.vsix`; } });

test("checksum correct i install success", async () => {
  const stages: string[] = []; let args: string[] = [];
  const result = await installUpdate(release, stage => stages.push(stage), () => {}, fetcher(), async (_command, value) => { args = value; return { code: 0, stderr: "" }; });
  assert.equal(result.sha256, sha); assert.deepEqual(stages, ["Pobieranie aktualizacji...", "Weryfikacja SHA-256...", "Instalowanie..."]);
  assert.deepEqual(args.slice(0, 1), ["--install-extension"]); assert.equal(args.at(-1), "--force");
});

test("checksum incorrect => abort bez instalacji", async () => {
  let installed = false;
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, fetcher("0".repeat(64)), async () => { installed = true; return { code: 0, stderr: "" }; }), /niezgodna/);
  assert.equal(installed, false);
});

test("install failure", async () => {
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, fetcher(), async () => ({ code: 7, stderr: "denied" })), /denied/);
});

test("brak code CLI", async () => {
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, fetcher(), async () => ({ code: -1, stderr: "ENOENT" })), /VS Code CLI/);
});

test("brak assetu VSIX przerywa przed pobieraniem i instalacją", async () => {
  let touched = false;
  await assert.rejects(() => installUpdate({ status: "updateAvailable", currentVersion: "0.3.2", latestVersion: "v0.3.3" }, () => {}, () => {}, async () => { touched = true; throw new Error(); }, async () => { touched = true; return { code: 0, stderr: "" }; }), /Brak assetu VSIX/);
  assert.equal(touched, false);
});
