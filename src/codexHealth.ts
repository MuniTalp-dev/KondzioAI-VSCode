import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { HealthItem, HealthResult } from "./types";

export type CommandRunner = (command: string, args: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;

export const runCommand: CommandRunner = (command, args) => new Promise(resolve => {
  const child = spawn(command, args, { windowsHide: true });
  let stdout = "", stderr = "";
  child.stdout.on("data", data => { stdout += String(data); });
  child.stderr.on("data", data => { stderr += String(data); });
  child.on("error", error => resolve({ code: -1, stdout, stderr: error.message }));
  child.on("close", code => resolve({ code: code ?? -1, stdout, stderr }));
});

export async function detectCodexCli(configuredPath = "", runner: CommandRunner = runCommand): Promise<HealthItem> {
  const candidate = configuredPath.trim();
  if (candidate && !existsSync(candidate)) {
    return { name: "Codex CLI", status: "ERROR", detail: `Skonfigurowany plik nie istnieje: ${candidate}` };
  }
  const command = candidate || "codex";
  const lookup = candidate ? { code: 0, stdout: candidate, stderr: "" }
    : await runner(process.platform === "win32" ? "where.exe" : "which", ["codex"]);
  if (lookup.code !== 0 || !lookup.stdout.trim()) {
    return { name: "Codex CLI", status: "WARNING", detail: "NIE ZAINSTALOWANY — wymagany tylko do zadań wykonywanych przez CODEX." };
  }
  const version = await runner(command, ["--version"]);
  if (version.code !== 0) {
    return { name: "Codex CLI", status: "ERROR", detail: version.stderr.trim() || "Codex CLI jest zainstalowany, ale nie uruchamia się." };
  }
  return { name: "Codex CLI", status: "OK", version: version.stdout.trim() || lookup.stdout.trim().split(/\r?\n/)[0] };
}

export async function enrichCodexHealth(
  health: HealthResult,
  ideInstalled: boolean,
  configuredPath = "",
  runner: CommandRunner = runCommand,
): Promise<HealthResult> {
  const items = health.items.filter(item => item.name !== "Codex CLI" && item.name !== "Codex IDE");
  items.push({ name: "Codex IDE", status: ideInstalled ? "OK" : "ERROR", detail: ideInstalled ? "Rozszerzenie Codex IDE jest dostępne." : "Nie znaleziono rozszerzenia Codex IDE." });
  items.push(await detectCodexCli(configuredPath, runner));
  return { ...health, items };
}
