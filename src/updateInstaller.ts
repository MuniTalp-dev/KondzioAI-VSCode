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

export async function installUpdate(
  release: UpdateResult,
  progress: (stage: InstallStage) => void,
  log: (message: string) => void,
  fetcher: BinaryFetcher = fetchBinary,
  cli: CliRunner = runCli,
  timeoutMs = 30_000,
): Promise<InstallResult> {
  if (release.status !== "updateAvailable" || !release.latestVersion || !release.vsixUrl || !release.vsixName) throw new Error("Brak assetu VSIX w GitHub Release.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    progress("Pobieranie aktualizacji..."); log(`Pobieranie VSIX: ${release.vsixUrl}`);
    const vsixResponse = await fetcher(release.vsixUrl, controller.signal);
    if (!vsixResponse.ok) throw new Error(`GitHub HTTP ${vsixResponse.status} podczas pobierania VSIX.`);
    const bytes = await vsixResponse.bytes();
    progress("Weryfikacja SHA-256...");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (release.checksumUrl) {
      const checksumResponse = await fetcher(release.checksumUrl, controller.signal);
      if (!checksumResponse.ok) throw new Error(`GitHub HTTP ${checksumResponse.status} podczas pobierania SHA256SUMS.txt.`);
      const sums = await checksumResponse.text();
      const line = sums.split(/\r?\n/).find(value => value.trim().endsWith(release.vsixName!));
      const expected = line?.trim().split(/\s+/)[0]?.toLowerCase();
      if (!expected || expected !== sha256) { log(`Checksum mismatch: expected=${expected ?? "missing"}, actual=${sha256}`); throw new Error("Suma SHA-256 aktualizacji jest niezgodna. Instalacja przerwana."); }
    }
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
