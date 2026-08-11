import { existsSync } from "node:fs";
import { join } from "node:path";
import { HealthItem, HealthResult } from "./types";
import { runProcess } from "./processRunner";

export type CommandResult = { code: number; stdout: string; stderr: string };
export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;
export type CodexLogger = (message: string) => void;

export const runCommand: CommandRunner = async (command, args) => runProcess(command, args, process.cwd(), "execution", message => console.log(`[Kondzio AI] ${message}`));

export async function resolveCodexCli(
  configuredPath = "",
  runner: CommandRunner = runCommand,
  platform = process.platform,
  appData = process.env.APPDATA ?? "",
  fileExists: (path: string) => boolean = existsSync,
): Promise<string | undefined> {
  const configured = configuredPath.trim();
  if (configured) { return fileExists(configured) ? configured : undefined; }

  const lookup = await runner(platform === "win32" ? "where.exe" : "which", ["codex"]);
  const paths = lookup.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (platform === "win32") {
    const wrapper = paths.find(path => /\.cmd$/i.test(path));
    if (wrapper) { return wrapper; }
    if (lookup.code === 0 && paths.length) { return paths[0]; }
    const fallback = appData ? join(appData, "npm", "codex.cmd") : "";
    return fallback && fileExists(fallback) ? fallback : undefined;
  }
  return lookup.code === 0 && paths.length ? paths[0] : undefined;
}

function normalizedVersion(output: string): string {
  return /(?:codex-cli\s+)?(\d+\.\d+\.\d+)/i.exec(output)?.[1] ?? output.trim();
}

export async function detectCodexCli(
  configuredPath = "",
  runner: CommandRunner = runCommand,
  log: CodexLogger = () => {},
  platform = process.platform,
  appData = process.env.APPDATA ?? "",
  fileExists: (path: string) => boolean = existsSync,
): Promise<HealthItem> {
  const candidate = configuredPath.trim();
  if (candidate && !fileExists(candidate)) {
    return { name: "Codex CLI", status: "ERROR", detail: `Skonfigurowany plik nie istnieje: ${candidate}` };
  }
  const resolved = await resolveCodexCli(configuredPath, runner, platform, appData, fileExists);
  if (!resolved) {
    return { name: "Codex CLI", status: "WARNING", detail: "NIE ZAINSTALOWANY — wymagany tylko do zadań wykonywanych przez CODEX." };
  }
  log(`Codex CLI resolved: ${resolved}`);
  const result = await runner(resolved, ["--version"]);
  if (result.code !== 0) {
    return { name: "Codex CLI", status: "ERROR", detail: result.stderr.trim() || "Codex CLI jest zainstalowany, ale nie uruchamia się." };
  }
  const version = normalizedVersion(result.stdout || result.stderr);
  log(`Codex CLI version: ${version}`);
  return { name: "Codex CLI", status: "OK", version };
}

export async function enrichCodexHealth(
  health: HealthResult,
  ideInstalled: boolean,
  configuredPath = "",
  runner: CommandRunner = runCommand,
  log: CodexLogger = () => {},
  platform = process.platform,
  appData = process.env.APPDATA ?? "",
  fileExists: (path: string) => boolean = existsSync,
): Promise<HealthResult> {
  const items = health.items.filter(item => item.name !== "Codex CLI" && item.name !== "Codex IDE");
  items.push({ name: "Codex IDE", status: ideInstalled ? "OK" : "ERROR", detail: ideInstalled ? "Rozszerzenie Codex IDE jest dostępne." : "Nie znaleziono rozszerzenia Codex IDE." });
  items.push(await detectCodexCli(configuredPath, runner, log, platform, appData, fileExists));
  return { ...health, items };
}
