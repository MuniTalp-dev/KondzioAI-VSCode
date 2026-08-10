import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const markup = readFileSync(join(__dirname, "..", "..", "src", "panel.ts"), "utf8");

test("panel jest responsywny od 260 do 500 px bez horizontal overflow", () => {
  assert.match(markup, /overflow-x:hidden/);
  assert.match(markup, /@media\(max-width:300px\)/);
  assert.match(markup, /minmax\(0,1fr\)/);
});

test("panel ma RAL 6018, focus, aria-live i semantyczne przyciski", () => {
  assert.match(markup, /--kondzio-accent:#57A639/);
  assert.match(markup, /:focus-visible/);
  assert.ok((markup.match(/aria-live=/g) ?? []).length >= 4);
  for (const command of ["run", "healthCheck", "checkForUpdates", "research", "history", "documentation"]) assert.match(markup, new RegExp(`data-command="${command}"`));
});
