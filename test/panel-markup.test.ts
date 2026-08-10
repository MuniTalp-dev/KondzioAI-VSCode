import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "node:vm";
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

test("zewnętrzny klient WebView ma poprawną składnię i bezpieczną inicjalizację", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.doesNotThrow(() => new Script(script, { filename: "media/webview.js" }));
  assert.equal((script.match(/acquireVsCodeApi\(\)/g) ?? []).length, 1);
  assert.match(script, /type: "clientReady"/);
  assert.match(script, /window\.onerror/);
  assert.match(script, /unhandledrejection/);
});

test("finalny HTML używa zewnętrznego skryptu i escapuje ścieżki, quotes oraz newlines", () => {
  assert.match(markup, /asWebviewUri/);
  assert.match(markup, /src="\$\{safeScriptUri\}"/);
  assert.match(markup, /replace\(\/\\n\/g, "&#10;"\)/);
  assert.match(markup, /replace\(\/"\/g, "&quot;"\)/);
  assert.doesNotMatch(markup, /return `[^`]*acquireVsCodeApi/s);
  const windowsPath = String.raw`C:\Projekty\Kondzio "AI"\line` + "\nnext</script>";
  const escaped = windowsPath.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;").replace(/\n/g, "&#10;");
  assert.equal(escaped, "C:\\Projekty\\Kondzio &quot;AI&quot;\\line&#10;next&lt;/script&gt;");

  const moduleLoader = require("node:module") as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
  const originalLoad = moduleLoader._load;
  moduleLoader._load = (request, parent, isMain) => request === "vscode" ? {} : originalLoad(request, parent, isMain);
  try {
    const render = (require("../src/panel") as { html: (version: string, settings: Record<string, string>, scriptUri: string, cspSource: string) => string }).html;
    const finalHtml = render("0.3.1", { orchestratorPath: windowsPath }, "vscode-webview://id/media/webview.js", "vscode-webview://id");
    writeFileSync(join(tmpdir(), "kondzio-ai-webview-final.html"), finalHtml, "utf8");
    assert.match(finalHtml, /<script nonce="[^"]+" src="vscode-webview:\/\/id\/media\/webview\.js"><\/script>/);
    assert.doesNotMatch(finalHtml, /<script nonce="[^"]+">[\s\S]+<\/script>/);
    assert.match(finalHtml, /value="C:\\Projekty\\Kondzio &quot;AI&quot;\\line&#10;next&lt;\/script&gt;"/);
  } finally {
    moduleLoader._load = originalLoad;
  }
});
