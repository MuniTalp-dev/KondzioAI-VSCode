import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { HealthItem, HealthResult } from "./types";

export type CommandResult = { code: number; stdout: string; stderr: string };
export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;
export type CodexLogger = (message: string) => void;

export const runCommand: CommandRunner = (command, args) => new Promise(resolve => {
  const isWindowsWrapper = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
  const executable = isWindowsWrapper ? (process.env.ComSpec || process.env.COMSPEC || "cmd.exe") : command;
  const invocationArgs = isWindowsWrapper ? ["/d", "/s", "/c", command, ...args] : args;
  const child = spawn(executable, invocationArgs, { windowsHide: true, shell: false });
  let stdout = "", stderr = "";
  child.stdout.on("data", data => { stdout += String(data); });
  child.stderr.on("data", data => { stderr += String(data); });
  child.on("error", error => resolve({ code: -1, stdout, stderr: error.message }));
  child.on("close", code => resolve({ code: code ?? -1, stdout, stderr }));
});

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
