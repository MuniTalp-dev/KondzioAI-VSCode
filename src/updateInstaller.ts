import { createHash } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { UpdateResult } from "./types";

export type InstallStage = "Pobieranie aktualizacji..." | "Weryfikacja SHA-256..." | "Instalowanie...";
export interface InstallResult { version: string; path: string; sha256: string; }
type BinaryFetcher = (url: string, signal: AbortSignal) => Promise<{ ok: boolean; status: number; bytes(): Promise<Uint8Array>; text(): Promise<string> }>;
type CliRunner = (command: string, args: string[]) => Promise<{ code: number; stderr: string }>;

const fetchBinary: BinaryFetcher = async (url, signal) => {
  const response = await fetch(url, { signal });
  return { ok: response.ok, status: response.status, bytes: async () => new Uint8Array(await response.arrayBuffer()), text: () => response.text() };
};
const runCli: CliRunner = (command, args) => new Promise(resolve => {
  const child = spawn(command, args, { windowsHide: true }); let stderr = "";
  child.stderr.on("data", data => { stderr += String(data); });
  child.on("error", error => resolve({ code: -1, stderr: error.message }));
  child.on("close", code => resolve({ code: code ?? -1, stderr }));
});

export function checksumForAsset(manifest: string, assetName: string): string | undefined {
  const matches = manifest.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})\s+[ *]?(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match) && match![2] === assetName);
  return matches.length === 1 ? matches[0][1].toLowerCase() : undefined;
}

export async function installUpdate(
  release: UpdateResult,
  progress: (stage: InstallStage) => void,
  log: (message: string) => void,
  fetcher: BinaryFetcher = fetchBinary,
  cli: CliRunner = runCli,
  timeoutMs = 30_000,
): Promise<InstallResult> {
  if (release.status !== "updateAvailable" || !release.latestVersion || !release.vsixUrl || !release.vsixName) throw new Error("Błąd bezpieczeństwa: brak właściwego assetu VSIX w GitHub Release.");
  if (!release.checksumUrl) throw new Error("Błąd bezpieczeństwa: ten GitHub Release nie zawiera SHA256SUMS.txt. Automatyczna instalacja została zablokowana.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    progress("Weryfikacja SHA-256...");
    const checksumResponse = await fetcher(release.checksumUrl, controller.signal);
    if (!checksumResponse.ok) throw new Error(`Błąd bezpieczeństwa: GitHub HTTP ${checksumResponse.status} podczas pobierania SHA256SUMS.txt.`);
    const expected = checksumForAsset(await checksumResponse.text(), release.vsixName);
    if (!expected) throw new Error(`Błąd bezpieczeństwa: SHA256SUMS.txt nie zawiera dokładnie jednej poprawnej sumy dla ${release.vsixName}. Automatyczna instalacja została zablokowana.`);
    progress("Pobieranie aktualizacji..."); log(`Pobieranie VSIX: ${release.vsixUrl}`);
    const vsixResponse = await fetcher(release.vsixUrl, controller.signal);
    if (!vsixResponse.ok) throw new Error(`GitHub HTTP ${vsixResponse.status} podczas pobierania VSIX.`);
    const bytes = await vsixResponse.bytes();
    const sha256 = createHash("sha256").update(bytes).digest("hex").toLowerCase();
    if (expected.toLowerCase() !== sha256.toLowerCase()) { log(`Checksum mismatch: expected=${expected}, actual=${sha256}`); throw new Error("Błąd bezpieczeństwa: suma SHA-256 pobranego VSIX jest niezgodna z SHA256SUMS.txt tego wydania. Instalacja przerwana."); }
    const directory = await mkdtemp(join(tmpdir(), "kondzio-ai-update-"));
    const path = join(directory, release.vsixName); await writeFile(path, bytes);
    progress("Instalowanie...");
    const code = process.platform === "win32" ? "code.cmd" : "code";
    const result = await cli(code, ["--install-extension", path, "--force"]);
    if (result.code === -1) throw new Error("Nie znaleziono oficjalnego VS Code CLI (code).");
    if (result.code !== 0) throw new Error(`Instalacja rozszerzenia nie powiodła się: ${result.stderr.trim() || `code ${result.code}`}`);
    log(`Zainstalowano ${release.latestVersion}; SHA-256 ${sha256}`);
    return { version: release.latestVersion.replace(/^v/i, ""), path, sha256 };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Przekroczono czas pobierania aktualizacji.");
    throw error;
  } finally { clearTimeout(timer); }
}
