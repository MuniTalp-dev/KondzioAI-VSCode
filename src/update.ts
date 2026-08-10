import { UpdateResult } from "./types";

export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_CONFIRMATION = "Otwórz GitHub Release";

export function updateApproved(choice: string | undefined): boolean { return choice === UPDATE_CONFIRMATION; }

export interface UpdateStateStore { get<T>(key: string): T | undefined; update(key: string, value: unknown): Thenable<void> | Promise<void>; }
export type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function versionParts(value: string): number[] {
  return value.replace(/^v/i, "").split(".").map(part => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left), b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) { return difference; }
  }
  return 0;
}

export class UpdateService {
  private static readonly checkedKey = "kondzioAi.lastUpdateCheck";
  constructor(private readonly currentVersion: string, private readonly repository: string,
              private readonly store: UpdateStateStore, private readonly fetcher: FetchLike = fetch) {}

  shouldAutoCheck(now = Date.now()): boolean {
    const last = this.store.get<number>(UpdateService.checkedKey) ?? 0;
    return now - last >= UPDATE_INTERVAL_MS;
  }

  async check(manual = false, now = Date.now()): Promise<UpdateResult> {
    if (!manual && !this.shouldAutoCheck(now)) { return { status: "current", currentVersion: this.currentVersion, detail: "Sprawdzenie wykonano w ciągu ostatnich 24 godzin." }; }
    await this.store.update(UpdateService.checkedKey, now);
    if (!/^[\w.-]+\/[\w.-]+$/.test(this.repository)) {
      return { status: "not_configured", currentVersion: this.currentVersion, detail: "Ustaw kondzioAi.updateRepository jako owner/KondzioAI-VSCode." };
    }
    try {
      const response = await this.fetcher(`https://api.github.com/repos/${this.repository}/releases/latest`, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
      if (!response.ok) { return { status: "error", currentVersion: this.currentVersion, detail: `GitHub API zwróciło HTTP ${response.status}.` }; }
      const data = await response.json() as { tag_name?: unknown; html_url?: unknown };
      if (typeof data.tag_name !== "string" || typeof data.html_url !== "string") {
        return { status: "error", currentVersion: this.currentVersion, detail: "Nieprawidłowa odpowiedź GitHub Releases." };
      }
      const latest = data.tag_name.replace(/^v/i, "");
      return compareVersions(latest, this.currentVersion) > 0
        ? { status: "available", currentVersion: this.currentVersion, latestVersion: latest, releaseUrl: data.html_url }
        : { status: "current", currentVersion: this.currentVersion, latestVersion: latest };
    } catch (error) {
      return { status: "error", currentVersion: this.currentVersion, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}
