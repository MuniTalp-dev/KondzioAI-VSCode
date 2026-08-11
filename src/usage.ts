import { readFile } from "node:fs/promises";
import { AiUsage, AiUsageProvider, UsageWindow } from "./types";

export interface PublicExtensionInfo { id: string; version?: string; active: boolean; exportsKeys: string[]; commands: string[]; }
export const unavailableUsage = (provider: "CODEX" | "CLAUDE", sourceVersion?: string, error?: string): AiUsage => ({ provider, available: false, source: "unsupported", sourceVersion, retrievedAt: new Date().toISOString(), windows: [], error });

export class CodexUsageProvider implements AiUsageProvider {
  readonly provider = "CODEX" as const;
  constructor(private readonly discover: () => Promise<PublicExtensionInfo | undefined>) {}
  async retrieve(): Promise<AiUsage> { const extension = await this.discover(); return unavailableUsage("CODEX", extension?.version, extension ? "Oficjalne rozszerzenie i Codex CLI nie udostępniają publicznego API usage." : "Oficjalne rozszerzenie Codex nie jest dostępne."); }
}

function usageWindow(value: unknown, type: string): UsageWindow | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>, used = typeof item.used_percentage === "number" ? item.used_percentage : undefined;
  const reset = typeof item.resets_at === "number" ? new Date(item.resets_at * 1000) : undefined;
  if (used === undefined || !Number.isFinite(used) || used < 0 || used > 100 || (reset && Number.isNaN(reset.getTime()))) return undefined;
  return { type, usedPercent: used, remainingPercent: Math.round((100 - used) * 100) / 100, resetAt: reset?.toISOString() };
}

export function parseClaudeRateLimits(input: unknown, sourceVersion?: string): AiUsage {
  if (!input || typeof input !== "object") throw new Error("Nieprawidłowy JSON Claude rate_limits.");
  const root = input as Record<string, unknown>, limits = root.rate_limits;
  if (!limits || typeof limits !== "object") return unavailableUsage("CLAUDE", sourceVersion, "JSON nie zawiera rate_limits.");
  const values = limits as Record<string, unknown>;
  const windows = [usageWindow(values.five_hour, "5-hour"), usageWindow(values.seven_day, "7-day")].filter((value): value is UsageWindow => Boolean(value));
  if (!windows.length) throw new Error("Claude rate_limits nie zawiera poprawnych okien.");
  const limiting = [...windows].sort((a, b) => b.usedPercent - a.usedPercent)[0];
  return { provider: "CLAUDE", available: true, usedPercent: limiting.usedPercent, remainingPercent: limiting.remainingPercent, resetAt: limiting.resetAt, windows, source: "claude-rate-limits", sourceVersion: typeof root.version === "string" ? root.version : sourceVersion, retrievedAt: new Date().toISOString() };
}

export class ClaudeUsageProvider implements AiUsageProvider {
  readonly provider = "CLAUDE" as const;
  constructor(private readonly statusPath: string, private readonly version?: string, private readonly load: (path: string) => Promise<string> = path => readFile(path, "utf8")) {}
  async retrieve(): Promise<AiUsage> { if (!this.statusPath) return unavailableUsage("CLAUDE", this.version, "Nie skonfigurowano źródła statusLine."); try { return parseClaudeRateLimits(JSON.parse(await this.load(this.statusPath)), this.version); } catch (error) { return unavailableUsage("CLAUDE", this.version, error instanceof Error ? error.message : String(error)); } }
}

export class UsageService {
  private readonly cache = new Map<string, { at: number; value: AiUsage }>();
  constructor(private readonly providers: AiUsageProvider[], private readonly ttlMs = 300_000, private readonly now = () => Date.now()) {}
  async getAll(force = false): Promise<AiUsage[]> { return Promise.all(this.providers.map(async provider => { const cached = this.cache.get(provider.provider); if (!force && cached && this.now() - cached.at < this.ttlMs) return cached.value; const value = await provider.retrieve(); this.cache.set(provider.provider, { at: this.now(), value }); return value; })); }
}
