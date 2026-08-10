import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { checksumForAsset, installUpdate } from "../src/updateInstaller";
import { UpdateResult } from "../src/types";

const bytes = new TextEncoder().encode("safe-vsix");
const sha = createHash("sha256").update(bytes).digest("hex");
const release: UpdateResult = { status: "updateAvailable", currentVersion: "0.3.2", latestVersion: "v0.3.3", vsixName: "kondzio-ai-0.3.3.vsix", vsixUrl: "https://github.test/file", checksumUrl: "https://github.test/sums" };
const fetcher = (sum = sha) => async (_url: string) => ({ ok: true, status: 200, async bytes() { return bytes; }, async text() { return `${sum}  kondzio-ai-0.3.3.vsix`; } });

test("checksum correct i install success", async () => {
  const stages: string[] = []; let args: string[] = [];
  const urls: string[] = []; const source = fetcher();
  const result = await installUpdate(release, stage => stages.push(stage), () => {}, async (url, _signal) => { urls.push(url); return source(url); }, async (_command, value) => { args = value; return { code: 0, stderr: "" }; });
  assert.equal(result.sha256, sha); assert.deepEqual(stages, ["Weryfikacja SHA-256...", "Pobieranie aktualizacji...", "Instalowanie..."]);
  assert.deepEqual(urls, [release.checksumUrl, release.vsixUrl]);
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
  await assert.rejects(() => installUpdate({ status: "updateAvailable", currentVersion: "0.3.2", latestVersion: "v0.3.3" }, () => {}, () => {}, async () => { touched = true; throw new Error(); }, async () => { touched = true; return { code: 0, stderr: "" }; }), /brak właściwego assetu VSIX/i);
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
  await assert.rejects(() => installUpdate(release, () => {}, () => {}, wrong, async () => { installed = true; return { code: 0, stderr: "" }; }), /nie zawiera dokładnie jednej/);
  assert.equal(installed, false);
});

test("parser wybiera wyłącznie dokładną nazwę i odrzuca przypadkową lub zduplikowaną linię", () => {
  const other = "1".repeat(64);
  assert.equal(checksumForAsset(`${other}  backup-kondzio-ai-0.3.3.vsix\n${sha.toUpperCase()} *kondzio-ai-0.3.3.vsix`, release.vsixName!), sha);
  assert.equal(checksumForAsset(`${sha}  prefix-kondzio-ai-0.3.3.vsix`, release.vsixName!), undefined);
  assert.equal(checksumForAsset(`${sha}  kondzio-ai-0.3.3.vsix\n${sha} *kondzio-ai-0.3.3.vsix`, release.vsixName!), undefined);
});
