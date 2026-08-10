import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("release automation nie używa force i wymaga osobnych push main/tag", () => {
  const source = readFileSync(join(__dirname, "..", "..", "src", "releaseService.ts"), "utf8");
  assert.doesNotMatch(source, /--force(?:-with-lease)?/);
  assert.match(source, /\["push", "origin", "main"\]/);
  assert.match(source, /\["push", "origin", plan\.tag\]/);
  assert.match(source, /pkg\.name !== "kondzio-ai"/);
  assert.match(source, /remoteTagExists/);
  assert.match(source, /api\.github\.com\/repos\/MuniTalp-dev\/KondzioAI-VSCode\/releases\/tags/);
});

test("readiness obejmuje wymagane kontrole", () => {
  const source = readFileSync(join(__dirname, "..", "..", "src", "releaseService.ts"), "utf8");
  for (const value of ["Working tree clean", "Branch main", "Origin istnieje", "package-lock zgodny", "CHANGELOG zawiera wersję", "VSIX package"]) assert.match(source, new RegExp(value));
});
