import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ProcessLogger, ProcessStage, runProcess as safeRunProcess } from "./processRunner";

export type ReleaseState = "GOTOWE" | "NIEGOTOWE" | "TESTY" | "BUILD" | "COMMIT" | "TAG" | "PUSH MAIN" | "PUSH TAG" | "RELEASE" | "DONE" | "FAILED";
export interface ReleaseCheck { label: string; pass: boolean; detail: string; }
export interface ReleasePlan { repository: string; branch: string; remote: string; status: string; version: string; tag: string; localTagExists: boolean; remoteTagExists: boolean; commitMessage: string; vsix: string; sha256?: string; checks?: ReleaseCheck[]; state: ReleaseState; log: string[]; }
export type ProcessRunner = (command: string, args: string[], cwd: string, stage?: ProcessStage, log?: ProcessLogger) => Promise<{ code: number; stdout: string; stderr: string }>;
type ReleaseFetcher = (url: string) => Promise<{ ok: boolean; status: number }>;

export class ReleaseService {
  constructor(private readonly repositoryPath: string, private readonly runner: ProcessRunner = safeRunProcess,
              private readonly fetcher: ReleaseFetcher = fetch, private readonly log: ProcessLogger = () => {}) {}
  private async root(): Promise<string> {
    const root = await realpath(resolve(this.repositoryPath));
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { name?: string };
    if (pkg.name !== "kondzio-ai") throw new Error("Release jest dozwolony wyłącznie dla repozytorium rozszerzenia Kondzio AI.");
    return root;
  }
  private async exec(command: string, args: string[], root: string, allowFailure = false, stage: ProcessStage = "release-readiness") {
    const result = await this.runner(command, args, root, stage, this.log);
    if (!allowFailure && result.code !== 0) throw new Error(`${command} ${args.join(" ")}: ${result.stderr.trim() || `code ${result.code}`}`);
    return result.stdout.trim();
  }
  async inspect(runBuild = false): Promise<ReleasePlan> {
    const root = await this.root(); const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version: string };
    const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")) as { version?: string; packages?: Record<string, { version?: string }> };
    const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8"); const tag = `v${pkg.version}`;
    const branch = await this.exec("git", ["branch", "--show-current"], root); const remote = await this.exec("git", ["remote", "get-url", "origin"], root, true);
    const status = await this.exec("git", ["status", "--porcelain"], root); const localTag = await this.exec("git", ["tag", "--list", tag], root);
    const remoteTagResult = remote ? await this.runner("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`], root) : { code: 1, stdout: "", stderr: "Brak origin" };
    const remoteTag = remoteTagResult.stdout.trim();
    const checks: ReleaseCheck[] = [
      { label: "Working tree clean", pass: status === "", detail: status || "clean" }, { label: "Branch main", pass: branch === "main", detail: branch },
      { label: "Origin istnieje", pass: Boolean(remote), detail: remote || "brak" }, { label: "package.json version", pass: Boolean(pkg.version), detail: pkg.version },
      { label: "package-lock zgodny", pass: lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version, detail: lock.version ?? "brak" },
      { label: "CHANGELOG zawiera wersję", pass: changelog.includes(`[${pkg.version}]`), detail: tag }, { label: `${tag} nie istnieje lokalnie`, pass: !localTag, detail: localTag ? "istnieje" : "brak" },
      { label: `${tag} nie istnieje na remote`, pass: remoteTagResult.code === 0 && !remoteTag, detail: remoteTagResult.code !== 0 ? remoteTagResult.stderr.trim() : remoteTag ? "istnieje" : "brak" },
    ];
    const log: string[] = [];
    if (runBuild) for (const [label, command, args] of [["Testy", "npm", ["test"]], ["Compile", "npm", ["run", "compile"]], ["VSIX package", "npm", ["run", "package"]]] as const) {
      const stage: ProcessStage = label === "Testy" ? "tests" : "package";
      const result = await this.runner(command, [...args], root, stage, this.log); const pass = result.code === 0; checks.push({ label, pass, detail: pass ? "PASS" : `[${stage}] ${result.stderr.trim()}` }); log.push(`${label}: ${pass ? "PASS" : "FAIL"}`);
    }
    const vsix = join(root, `kondzio-ai-${pkg.version}.vsix`); let sha256: string | undefined;
    try { sha256 = createHash("sha256").update(await readFile(vsix)).digest("hex").toUpperCase(); } catch {}
    return { repository: root, branch, remote, status: status || "clean", version: pkg.version, tag, localTagExists: Boolean(localTag), remoteTagExists: Boolean(remoteTag), commitMessage: `feat: release Kondzio AI VS Code Extension ${pkg.version}`, vsix, sha256, checks, state: checks.every(x => x.pass) ? "GOTOWE" : "NIEGOTOWE", log };
  }
  async dryRun(): Promise<ReleasePlan> { return this.inspect(true); }
  async fullRelease(report: (state: ReleaseState, line: string) => void): Promise<ReleasePlan> {
    const plan = await this.inspect(false); const root = plan.repository;
    if (plan.branch !== "main" || !plan.remote || plan.localTagExists || plan.remoteTagExists) throw new Error("Repozytorium nie spełnia warunków bezpiecznego wydania lub tag już istnieje.");
    const step = async (state: ReleaseState, command: string, args: string[]) => { report(state, `${command} ${args.join(" ")}`); await this.exec(command, args, root, false, state === "TESTY" ? "tests" : state === "BUILD" ? "package" : "release-readiness"); };
    await step("TESTY", "npm", ["test"]); await step("BUILD", "npm", ["run", "compile"]); await step("BUILD", "npm", ["run", "package"]);
    await step("COMMIT", "git", ["add", "--all", "--", "."]); await step("COMMIT", "git", ["commit", "-m", plan.commitMessage]);
    await step("TAG", "git", ["tag", "-a", plan.tag, "-m", plan.commitMessage]); await step("PUSH MAIN", "git", ["push", "origin", "main"]); await step("PUSH TAG", "git", ["push", "origin", plan.tag]);
    report("RELEASE", "Sprawdzanie GitHub Release"); const release = await this.fetcher(`https://api.github.com/repos/MuniTalp-dev/KondzioAI-VSCode/releases/tags/${plan.tag}`); report("RELEASE", release.ok ? "GitHub Release dostępny" : `GitHub Release HTTP ${release.status}`); report("DONE", "Wydanie zakończone"); return this.inspect(false);
  }
}
