import assert from "node:assert/strict";
import test from "node:test";
import { checkForUpdatesCommand, OPEN_RELEASE, UpdateCommandUi } from "../src/updateCommand";
import { UpdateResult } from "../src/types";

function ui(messages: string[], choice?: string, opened: string[] = []): UpdateCommandUi {
  return {
    async information(message) { messages.push(message); return choice; },
    async warning(message) { messages.push(message); return choice; },
    async openRelease(url) { opened.push(url); },
  };
}

test("command wywołuje UpdateService bez pośrednictwa WebView", async () => {
  let calls = 0;
  const logs: string[] = [];
  await checkForUpdatesCommand({ async check(manual) { calls++; assert.equal(manual, true); return { status: "current", currentVersion: "0.2.5", latestVersion: "v0.2.5" }; } }, ui([]), message => logs.push(message));
  assert.equal(calls, 1);
  assert.deepEqual(logs, ["Command checkForUpdates invoked"]);
});

test("current pokazuje informację o aktualnej wersji", async () => {
  const messages: string[] = [];
  const result = await checkForUpdatesCommand({ async check(): Promise<UpdateResult> { return { status: "current", currentVersion: "0.2.5", latestVersion: "v0.2.5" }; } }, ui(messages), () => {});
  assert.equal(result.status, "current");
  assert.deepEqual(messages, ["Kondzio AI 0.2.5 jest aktualne."]);
});

test("updateAvailable pokazuje wersję i otwiera wydanie po wyborze przycisku", async () => {
  const messages: string[] = [], opened: string[] = [];
  const releaseUrl = "https://github.com/owner/repo/releases/tag/v0.3.0";
  const result = await checkForUpdatesCommand({ async check(): Promise<UpdateResult> { return { status: "updateAvailable", currentVersion: "0.2.5", latestVersion: "v0.3.0", releaseUrl }; } }, ui(messages, OPEN_RELEASE, opened), () => {});
  assert.equal(result.status, "updateAvailable");
  assert.deepEqual(messages, ["Dostępna aktualizacja Kondzio AI v0.3.0"]);
  assert.deepEqual(opened, [releaseUrl]);
});
