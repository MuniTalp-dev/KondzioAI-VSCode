import assert from "node:assert/strict";
import test from "node:test";
import { dispatchWebviewClick, WEBVIEW_CLIENT_INITIALIZED, webviewClientScript } from "../src/webviewBus";

const target = (command: string) => ({ closest: (selector: string) => selector === "[data-command]" ? { getAttribute: (name: string) => name === "data-command" ? command : null } : null });

for (const command of ["run", "healthCheck", "research", "history", "checkForUpdates"]) {
  test(`centralny message bus wysyła ${command}`, () => {
    const messages: Array<Record<string, unknown>> = [];
    const handled = dispatchWebviewClick(target(command), type => ({ type }), message => messages.push(message));
    assert.equal(handled, true);
    assert.deepEqual(messages, [{ type: command }]);
  });
}

test("klient loguje i zgłasza inicjalizację", () => {
  const script = webviewClientScript();
  assert.match(script, new RegExp(WEBVIEW_CLIENT_INITIALIZED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(script, /clientInitialized/);
  assert.equal((script.match(/document\.addEventListener\("click"/g) ?? []).length, 1);
});
