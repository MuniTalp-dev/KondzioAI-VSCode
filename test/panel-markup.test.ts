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
  assert.match(markup, /--kondzio-accent:#61993b/);
  assert.match(markup, /:focus-visible/);
  assert.ok((markup.match(/aria-live=/g) ?? []).length >= 4);
  for (const command of ["run", "healthCheck", "research", "documentation"]) assert.match(markup, new RegExp(`data-command="${command}"`));
  assert.match(readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8"), /dataset\.command = "checkForUpdates"/);
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

test("instalacja i reload wymagają osobnych kliknięć użytkownika", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.match(markup, /data-command="installUpdate"/); assert.match(markup, /data-command="reloadWindow"/);
  assert.match(script, /updateActions.*hidden/); assert.match(script, /message\.type === "installSuccess"/);
  assert.doesNotMatch(script, /workbench\.action\.reloadWindow/);
});

test("błąd bezpieczeństwa updatera udostępnia wyłącznie otwarcie tego wydania", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.match(markup, /installSecurityError/);
  assert.match(script, /openReleaseAfterError/);
  assert.match(script, /OTWÓRZ WYDANIE/);
  assert.match(script, /url: update\?\.releaseUrl/);
});

test("0.4.0 ma kompaktowy header, macierz 2x2, switche i zakładki", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.match(markup, /K·AI[\s\S]*Kondzio AI[\s\S]*versionStatus/);
  assert.match(markup, /@media\(min-width:320px\)/);
  assert.equal((markup.match(/role="switch"/g) ?? []).length, 2);
  assert.match(markup, /aria-checked="false"/);
  assert.equal((markup.match(/role="tab"/g) ?? []).length, 5);
  assert.equal((markup.match(/role="tabpanel"/g) ?? []).length, 5);
  assert.match(script, /preferLocal: switchOn\("saveCodex"\)/);
  assert.match(script, /blockCodexEscalation: switchOn\("saveCodex"\)/);
  assert.match(script, /historyLimit = 5/);
  assert.match(script, /CODEX: WYMAGA ZGODY/);
});

test("status aktualizacji pokazuje sam symbol i chowa akcje bez update", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.match(script, /value\.status === "current" \? "✓"/);
  assert.match(script, /Oprogramowanie aktualne/);
  assert.match(script, /updateActions.*toggle\("hidden", !available\)/);
  assert.match(markup, /data-command="showChangelog"/);
  assert.match(markup, /id="releaseNotes"/);
});

test("nazwy narzędzi i statusy mają wspólne pionowe wyrównanie flex", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  assert.match(markup, /\.tool-row\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(markup, /\.tool-status\{display:inline-flex;align-items:center/);
  assert.match(markup, /\.tool-name\{min-width:0;overflow-wrap:anywhere/);
  assert.match(markup, /\.tool-status[^}]*margin:0/);
  assert.doesNotMatch(markup, /\.tool-status[^}]*translateY/);
  assert.match(script, /row\.className = "tool-row"/);
  assert.match(script, /status\.className = `tool-status \$\{state\}`/);
  assert.match(script, /row\.append\(name, status\)/);
});

test("Diagnostyka ma bezpieczną automatyzację Release / Git z potwierdzeniem", () => {
  const script = readFileSync(join(__dirname, "..", "..", "media", "webview.js"), "utf8");
  for (const command of ["releaseReadiness", "releaseDryRun", "prepareFullRelease", "confirmFullRelease"]) assert.match(script, new RegExp(`data-command=\\"${command}\\"`));
  assert.match(script, /ZATWIERDZAM WYDANIE/);
  assert.match(script, /push main\\n- push tag/);
  assert.match(script, /releaseConfirmModal.*hidden/);
  assert.match(markup, /randomUUID/);
  assert.match(markup, /Brak ważnego potwierdzenia wydania/);
});
