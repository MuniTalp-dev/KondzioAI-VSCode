import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CHECK_FOR_UPDATES_MESSAGE, createUpdateCheckMessage, routeUpdateMessage } from "../src/updateFlow";
import { UpdateResult } from "../src/types";

test("click WebView i handler używają literalnie type checkForUpdates", async () => {
  const panelSource = readFileSync(join(__dirname, "..", "..", "src", "panel.ts"), "utf8");
  assert.equal(CHECK_FOR_UPDATES_MESSAGE, "checkForUpdates");
  assert.match(panelSource, /updateCheck'\)\.onclick=.*postMessage\(\{type:\$\{JSON\.stringify\(CHECK_FOR_UPDATES_MESSAGE\)\}\}\)/);

  const sentByClick = createUpdateCheckMessage();
  const posted: UpdateResult[] = [];
  let serviceCalls = 0;
  const handled = await routeUpdateMessage(sentByClick, async () => {
    serviceCalls++;
    return { status: "current", currentVersion: "0.2.1", latestVersion: "v0.2.1" };
  }, result => posted.push(result), "0.2.1");

  assert.equal(handled, true);
  assert.equal(serviceCalls, 1);
  assert.deepEqual(posted.map(result => result.status), ["checking", "current"]);
});

test("rozjechany message.type nie uruchamia UpdateService", async () => {
  let serviceCalls = 0;
  const handled = await routeUpdateMessage({ type: "updateCheck" }, async () => {
    serviceCalls++;
    return { status: "current", currentVersion: "0.2.1" };
  }, () => {});
  assert.equal(handled, false);
  assert.equal(serviceCalls, 0);
});
