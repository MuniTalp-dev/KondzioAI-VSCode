import { UpdateResult } from "./types";

export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_TIMEOUT_MS = 10_000;
export const UPDATE_REPOSITORY = "MuniTalp-dev/KondzioAI-VSCode";
export const UPDATE_CONFIRMATION = "Otwórz GitHub Release";

export function updateApproved(choice: string | undefined): boolean { return choice === UPDATE_CONFIRMATION; }

export interface UpdateStateStore { get<T>(key: string): T | undefined; update(key: string, value: unknown): Thenable<void> | Promise<void>; }
export type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type UpdateLogger = (message: string) => void;

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
              private readonly store: UpdateStateStore, private readonly fetcher: FetchLike = fetch,
              private readonly log: UpdateLogger = () => {}, private readonly timeoutMs = UPDATE_TIMEOUT_MS) {}

  get installedVersion(): string { return this.currentVersion; }
  get lastCheckedAt(): number | undefined { return this.store.get<number>(UpdateService.checkedKey); }

  shouldAutoCheck(now = Date.now()): boolean {
    const last = this.store.get<number>(UpdateService.checkedKey) ?? 0;
    return now - last >= UPDATE_INTERVAL_MS;
  }

  async check(manual = false, now = Date.now()): Promise<UpdateResult> {
    if (!manual && !this.shouldAutoCheck(now)) { return { status: "current", currentVersion: this.currentVersion, detail: "Sprawdzenie wykonano w ciągu ostatnich 24 godzin." }; }
    await this.store.update(UpdateService.checkedKey, now);
    if (this.repository !== UPDATE_REPOSITORY) {
      this.log("Update result: error");
      return { status: "error", currentVersion: this.currentVersion, detail: `Aktualizacje są dozwolone wyłącznie z ${UPDATE_REPOSITORY}.` };
    }

    const endpoint = `https://api.github.com/repos/${this.repository}/releases/latest`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    this.log("Update check started");
    this.log(`GitHub request started: ${endpoint}`);
    try {
      const response = await this.fetcher(endpoint, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal: controller.signal });
      this.log(`GitHub HTTP status: ${response.status}`);
      if (!response.ok) { this.log("Update result: error"); return { status: "error", currentVersion: this.currentVersion, detail: `GitHub API zwróciło HTTP ${response.status}.` }; }
      const data = await response.json() as { tag_name?: unknown; html_url?: unknown; body?: unknown; published_at?: unknown; assets?: Array<{ name?: unknown; browser_download_url?: unknown }> };
      if (typeof data.tag_name !== "string" || typeof data.html_url !== "string") {
        this.log("Update result: error");
        return { status: "error", currentVersion: this.currentVersion, detail: "Nieprawidłowa odpowiedź GitHub Releases." };
      }
      const updateAvailable = compareVersions(data.tag_name, this.currentVersion) > 0;
      this.log(`Latest release: ${data.tag_name}`);
      this.log(`Installed version: ${this.currentVersion}`);
      this.log(`Update result: ${updateAvailable ? "update" : "current"}`);
      const version = data.tag_name.replace(/^v/i, "");
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const vsixName = `kondzio-ai-${version}.vsix`;
      const vsix = assets.find(asset => asset.name === vsixName && typeof asset.browser_download_url === "string");
      const checksum = assets.find(asset => asset.name === "SHA256SUMS.txt" && typeof asset.browser_download_url === "string");
      return updateAvailable
        ? { status: "updateAvailable", currentVersion: this.currentVersion, latestVersion: data.tag_name, releaseUrl: data.html_url,
            releaseNotes: typeof data.body === "string" ? data.body : "Brak informacji o wydaniu.", publishedAt: typeof data.published_at === "string" ? data.published_at : undefined,
            vsixName, vsixUrl: vsix?.browser_download_url as string | undefined, checksumUrl: checksum?.browser_download_url as string | undefined }
        : { status: "current", currentVersion: this.currentVersion, latestVersion: data.tag_name };
    } catch (error) {
      if (controller.signal.aborted) { this.log("Update result: timeout"); return { status: "timeout", currentVersion: this.currentVersion }; }
      this.log("Update result: error");
      return { status: "error", currentVersion: this.currentVersion, detail: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
}
