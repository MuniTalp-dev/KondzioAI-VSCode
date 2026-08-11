import { existsSync } from "node:fs";
import { join } from "node:path";
import { CommandRunner, runCommand } from "./codexHealth";
import { HealthItem, HealthResult } from "./types";

export async function resolveClaudeCli(runner: CommandRunner = runCommand, platform = process.platform, userProfile = process.env.USERPROFILE ?? "", fileExists = existsSync): Promise<string | undefined> {
  const lookup = await runner(platform === "win32" ? "where.exe" : "which", ["claude"]);
  const paths = lookup.stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (platform === "win32") {
    const wrapper = paths.find(path => /\.(?:cmd|exe)$/i.test(path)); if (wrapper) return wrapper;
    for (const candidate of [join(userProfile, ".local", "bin", "claude.exe"), join(userProfile, ".claude", "local", "claude.exe")]) if (fileExists(candidate)) return candidate;
  }
  return lookup.code === 0 ? paths[0] : undefined;
}

export async function detectClaudeCli(runner: CommandRunner = runCommand, log: (message: string) => void = () => {}): Promise<HealthItem> {
  const path = await resolveClaudeCli(runner); if (!path) return { name: "Claude CLI", status: "WARNING", detail: "Claude Code CLI nie jest zainstalowane; executor CLAUDE jest wyłączony." };
  const result = await runner(path, ["--version"]); if (result.code !== 0) return { name: "Claude CLI", status: "WARNING", detail: "Nie udało się odczytać wersji Claude Code CLI." };
  const version = result.stdout.trim().split(/\s+/)[0]; log(`Claude CLI version: ${version}`); return { name: "Claude CLI", status: "OK", version };
}

export async function enrichClaudeHealth(health: HealthResult, runner: CommandRunner = runCommand, log: (message: string) => void = () => {}): Promise<HealthResult> {
  const item = await detectClaudeCli(runner, log); return { ...health, items: [...health.items.filter(value => value.name !== "Claude CLI"), item] };
}
