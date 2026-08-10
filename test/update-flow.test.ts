import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import { createUpdateCheckMessage, routeUpdateMessage, updateButtonScript, WebviewMessageType } from "../src/updateFlow";
import { UpdateResult } from "../src/types";

test("pełny przepływ WebView click -> postMessage -> handler -> UpdateService -> odpowiedź", async () => {
  assert.equal(WebviewMessageType.CheckForUpdates, "checkForUpdates");
  const listeners = new Map<string, () => void>();
  const messages: Array<{ type?: unknown }> = [];
  const logs: string[] = [];
  const button = {
    disabled: false,
    addEventListener(type: string, listener: () => void) { listeners.set(type, listener); },
  };

  vm.runInNewContext(updateButtonScript(), {
    $: (id: string) => { assert.equal(id, "updateCheck"); return button; },
    vscode: { postMessage(message: { type?: unknown }) { messages.push(message); } },
    console: { log(message: string) { logs.push(message); } },
  });

  assert.equal(button.disabled, false);
  listeners.get("click")?.();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, createUpdateCheckMessage().type);
  assert.deepEqual(logs, [
    "[Kondzio AI WebView] Update button clicked",
    "[Kondzio AI WebView] Sending checkForUpdates",
  ]);

  const posted: UpdateResult[] = [];
  let serviceCalls = 0;
  const handled = await routeUpdateMessage(messages[0], async () => {
    serviceCalls++;
    return { status: "updateAvailable", currentVersion: "0.2.3", latestVersion: "v0.2.4" };
  }, result => posted.push(result), "0.2.3");

  assert.equal(handled, true);
  assert.equal(serviceCalls, 1);
  assert.deepEqual(posted.map(result => result.status), ["checking", "updateAvailable"]);
});

test("rozjechany message.type nie uruchamia UpdateService", async () => {
  let serviceCalls = 0;
  const handled = await routeUpdateMessage({ type: "updateCheck" }, async () => {
    serviceCalls++;
    return { status: "current", currentVersion: "0.2.3" };
  }, () => {});
  assert.equal(handled, false);
  assert.equal(serviceCalls, 0);
});
