import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

export interface ProjectState {
  projectName: string;
  projectRoot: string;
  repoRoot: string;
  projectType: string;
  branch: string;
  gitStatus: "CLEAN" | "DIRTY" | "UNKNOWN";
  githubRemote?: string;
}

function git(repoRoot: string, args: string[]): string {
  try { return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { return ""; }
}

function projectType(projectRoot: string): string {
  if (existsSync(join(projectRoot, "package.json"))) { return "Node / TypeScript"; }
  if (existsSync(join(projectRoot, "pyproject.toml")) || existsSync(join(projectRoot, "requirements.txt"))) { return "Python"; }
  if (existsSync(join(projectRoot, "Cargo.toml"))) { return "Rust"; }
  return "Inny";
}

function repositoryName(repoRoot: string): string {
  try {
    const config = readFileSync(join(repoRoot, ".git", "config"), "utf8");
    const origin = config.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/)?.[1]?.trim();
    const name = origin?.replace(/\\/g, "/").split("/").pop()?.replace(/\.git$/i, "");
    if (name) { return name; }
  } catch { /* Fall back to the repository directory name. */ }
  return basename(repoRoot);
}

function repositoryRemote(repoRoot: string): string | undefined {
  const commandValue = git(repoRoot, ["remote", "get-url", "origin"]);
  if (commandValue) return commandValue;
  try { return readFileSync(join(repoRoot, ".git", "config"), "utf8").match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/)?.[1]?.trim(); }
  catch { return undefined; }
}

export function resolveProjectState(configuredRoot?: string): ProjectState | undefined {
  const value = configuredRoot?.trim();
  if (!value || !existsSync(value) || !statSync(value).isDirectory()) { return undefined; }
  const projectRoot = realpathSync(value);
  let repoRoot = projectRoot;
  while (!existsSync(join(repoRoot, ".git"))) {
    const parent = dirname(repoRoot);
    if (parent === repoRoot) { return undefined; }
    repoRoot = parent;
  }
  const remote = repositoryRemote(repoRoot);
  const status = git(repoRoot, ["status", "--porcelain"]);
  return { projectRoot, repoRoot, projectName: repositoryName(repoRoot), projectType: projectType(projectRoot),
    branch: git(repoRoot, ["branch", "--show-current"]) || "—", gitStatus: status ? "DIRTY" : "CLEAN",
    githubRemote: remote || undefined };
}
