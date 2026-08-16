import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { resolveProjectState } from "../src/projectState";

test("activeProjectRoot jest walidowany i zamieniany na jawny stan projektu", () => {
  const root = join(tmpdir(), `kondzio-ai-project-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  writeFileSync(join(root, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/MuniTalp-dev/KondzioAI-VSCode.git\n');
  try {
    assert.deepEqual(resolveProjectState(root), { projectRoot: root, repoRoot: root, projectName: "KondzioAI-VSCode", projectType: "Inny", branch: "—", gitStatus: "CLEAN", githubRemote: "https://github.com/MuniTalp-dev/KondzioAI-VSCode.git" });
    assert.equal(resolveProjectState(join(root, "missing")), undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
