import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";
import test from "node:test";

const root = join(__dirname, "..", "..");
const markup = readFileSync(join(root, "src", "panelHtml.ts"), "utf8");
const panel = readFileSync(join(root, "src", "panel.ts"), "utf8");
const script = readFileSync(join(root, "media", "webview.js"), "utf8");

test("0.5.5 ma cztery główne zakładki i domyślną kartę PRACA", () => {
  assert.equal((markup.match(/role=\\?"tab\\?"/g) ?? []).length, 4);
  assert.equal((markup.match(/role=\\?"tabpanel\\?"/g) ?? []).length, 4);
  assert.match(markup, /workTab[\s\S]*aria-selected=\"true\"[\s\S]*>PRACA</);
  for (const label of ["PRACA", "PROJEKT", "USTAWIENIA", "O PROGRAMIE"]) assert.match(markup, new RegExp(`>${label}<`));
});

test("ostatnia karta jest zapamiętywana w stanie WebView", () => {
  assert.match(script, /vscode\.getState\(\)/); assert.match(script, /vscode\.setState\(/);
  assert.match(script, /activeTab/); assert.match(script, /saved\.activeTab \|\| "workPanel"/);
});

test("status aktualizacji jest klikalny, dostępny i pokazuje akcje tylko dla update", () => {
  assert.match(markup, /id=\"versionStatus\"[^>]*data-command=\"checkForUpdates\"[^>]*aria-label=/);
  assert.match(script, /value\.status === "checking"/); assert.match(script, /updateActions.*available/);
  assert.match(markup, /data-command=\"showChangelog\"/); assert.match(markup, /data-command=\"installUpdate\"/);
});

test("PRACA zawiera usage, pole zadania, macierz 2x2 i bezpieczny run", () => {
  assert.match(markup, /id=\"workPanel\"[\s\S]*id=\"usageLines\"/);
  assert.match(markup, /Opisz zadanie dla Kondzio AI/); assert.doesNotMatch(markup, /Opisz zadanie dla Orchestratora/);
  assert.match(markup, /class=\"matrix\"/); assert.equal((markup.match(/role=\"switch\"/g) ?? []).length, 3);
  for (const value of ["AUTONOMIA", "WYKONAWCA", "TRYB PRÓBNY", "OSZCZĘDZAJ AI"]) assert.match(markup, new RegExp(value));
  assert.match(script, /preferLocal: switchOn\("saveCodex"\)/); assert.match(script, /if \(!projectState\) return/);
});

test("Activity renderuje etapy, elapsed, fallback ETA, podsumowania i auto-scroll", () => {
  for (const label of ["Analiza zadania", "Routing", "Analizuję projekt", "Wprowadzenie zmian", "Testy", "Walidacja"]) assert.match(script, new RegExp(label));
  assert.match(script, /setInterval\([\s\S]*1000\)/); assert.match(script, /ETA:.*"—"/);
  assert.match(script, /ZAKOŃCZONO •/); assert.match(script, /ZAKOŃCZONO Z BŁĘDEM/);
  assert.match(script, /autoScroll/); assert.match(markup, /↓ NAJNOWSZE/); assert.match(markup, /aria-live=\"polite\"/);
});

test("PROJEKT pokazuje activeProject i zapowiedź przyszłych funkcji", () => {
  for (const value of ["AKTYWNY PROJEKT", "Typ", "Branch", "Git", "GitHub", "ODŚWIEŻ", "OTWÓRZ FOLDER", "NOWY PROJEKT", "ZMIEŃ PROJEKT", "0.5.6 / 0.6.0"]) assert.match(markup, new RegExp(value));
  assert.match(panel, /type: "projectState", value: this\.activeProject/);
});

test("USTAWIENIA zachowują diagnostykę, sekcje i Release Git", () => {
  for (const value of ["ŚCIEŻKI", "AI / WYKONAWCY", "RESEARCH", "GIT / GITHUB", "AKTUALIZACJE", "DIAGNOSTYKA", "RELEASE / GIT", "ZAAWANSOWANE"]) assert.match(markup, new RegExp(value));
  for (const command of ["healthCheck", "releaseReadiness", "releaseDryRun", "prepareFullRelease", "confirmFullRelease"]) assert.match(markup, new RegExp(`data-command="${command}`));
  assert.match(script, /Problem:.*Wpływ:.*Rozwiązanie:/s); assert.match(script, /push main\\n- push tag/);
});

test("O PROGRAMIE pokazuje informacje, dokumenty i licencję bez wymyślania Buy Me a Coffee", () => {
  assert.match(markup, /Local-first AI development assistant/); assert.match(markup, /Konrad \/ KONDZIO\.PL/);
  assert.match(markup, /Buy Me a Coffee/); assert.match(markup, /<button disabled[^>]*>Buy Me a Coffee/);
  assert.match(markup, /LICENCJA/); assert.match(markup, /Licencja nie została jeszcze określona/);
  assert.match(markup, /POKAŻ LICENCJĘ/); assert.match(markup, /DOKUMENTACJA/); assert.match(markup, /CHANGELOG/);
});

test("panel jest responsywny dla 260, 320, 400 i 500 px bez overflow", () => {
  assert.match(markup, /overflow-x:hidden/); assert.match(markup, /@media\(max-width:300px\)/); assert.match(markup, /@media\(min-width:400px\)/);
  assert.match(markup, /minmax\(0,1fr\)/); assert.match(markup, /grid-template-columns:repeat\(4/);
});

test("accessibility i RAL 6018 są częścią finalnego panelu", () => {
  assert.match(markup, /--accent:#61993b/); assert.match(markup, /:focus-visible/);
  assert.equal((markup.match(/aria-controls=/g) ?? []).length >= 8, true);
  assert.match(markup, /aria-selected=/); assert.match(markup, /aria-checked=/); assert.match(markup, /aria-live=/);
});

test("zewnętrzny klient WebView ma poprawną składnię i jedną inicjalizację API", () => {
  assert.doesNotThrow(() => new Script(script)); assert.equal((script.match(/acquireVsCodeApi\(\)/g) ?? []).length, 1);
  assert.match(script, /type: "clientReady"/); assert.match(script, /unhandledrejection/);
});
