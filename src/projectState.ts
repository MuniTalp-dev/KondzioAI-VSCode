import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface ProjectState {
  projectName: string;
  projectRoot: string;
  repoRoot: string;
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
  return { projectRoot, repoRoot, projectName: repositoryName(repoRoot) };
}
