import assert from "node:assert/strict";
import test from "node:test";
import { delimiter } from "node:path";
import { processInvocation, resolveProcess, runProcess, windowsCmdInvocation } from "../src/processRunner";

const pathValue = ["C:\\Program Files\\nodejs", "C:\\Tools\\Git\\cmd", "C:\\Users\\Jan Kowalski\\bin"].join(delimiter);
const existing = new Set([
  "C:\\Program Files\\nodejs\\npm.cmd", "C:\\Program Files\\nodejs\\npx.cmd",
  "C:\\Users\\Jan Kowalski\\bin\\code.cmd", "C:\\Tools\\Git\\cmd\\git.exe",
  "C:\\Users\\Jan Kowalski\\bin\\gh.exe",
].map(value => value.toLowerCase()));
const fileExists = (value: string) => existing.has(value.toLowerCase());

test("Windows rozwiązuje npm.cmd, npx.cmd i code.cmd z PATH", () => {
  assert.equal(resolveProcess("npm", "win32", pathValue, fileExists), "C:\\Program Files\\nodejs\\npm.cmd");
  assert.equal(resolveProcess("npx", "win32", pathValue, fileExists), "C:\\Program Files\\nodejs\\npx.cmd");
  assert.equal(resolveProcess("code", "win32", pathValue, fileExists), "C:\\Users\\Jan Kowalski\\bin\\code.cmd");
});

test("Windows rozwiązuje git.exe i gh.exe zgodnie z PATH", () => {
  assert.equal(resolveProcess("git", "win32", pathValue, fileExists), "C:\\Tools\\Git\\cmd\\git.exe");
  assert.equal(resolveProcess("gh", "win32", pathValue, fileExists), "C:\\Users\\Jan Kowalski\\bin\\gh.exe");
});

test("wrapper .cmd ze spacjami używa ComSpec i shell:false", () => {
  const invocation = processInvocation("npm", ["run", "diagnostics explanations"], "win32", pathValue, fileExists, "C:\\Windows\\System32\\cmd.exe");
  assert.equal(invocation.resolved, "C:\\Program Files\\nodejs\\npm.cmd");
  assert.equal(invocation.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(invocation.args, ["/d", "/s", "/c", '""C:\\Program Files\\nodejs\\npm.cmd" "run" "diagnostics explanations""']);
  assert.equal(invocation.options.shell, false);
});

test("regresja spawn EINVAL: .cmd nigdy nie jest bezpośrednim executable", () => {
  for (const command of ["npm", "npx", "code"]) {
    const invocation = processInvocation(command, ["--version"], "win32", pathValue, fileExists, "cmd.exe");
    assert.equal(invocation.command, "cmd.exe"); assert.doesNotMatch(invocation.command, /\.cmd$/i);
  }
});

test("cmd invocation nie skleja argumentu użytkownika poza cytowaniem", () => {
  const invocation = windowsCmdInvocation("C:\\Tools\\npm.cmd", ["prompt & whoami"], "cmd.exe");
  assert.equal(invocation.args[3], '""C:\\Tools\\npm.cmd" "prompt & whoami""');
  assert.equal(invocation.options.shell, false);
});

test("realny npm wrapper uruchamia się bez spawn EINVAL i zapisuje audyt", { skip: process.platform !== "win32" }, async () => {
  const logs: string[] = [];
  const result = await runProcess("npm", ["--version"], "C:\\Program Files", "tests", value => logs.push(value));
  assert.equal(result.code, 0, result.stderr); assert.doesNotMatch(result.stderr, /EINVAL/);
  assert.ok(logs.some(value => value.startsWith("Process resolved: ") && /npm\.cmd$/i.test(value)));
  assert.ok(logs.includes("Args: --version")); assert.ok(logs.includes("cwd: C:\\Program Files"));
});
