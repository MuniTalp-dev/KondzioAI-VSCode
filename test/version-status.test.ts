import assert from "node:assert/strict";
import test from "node:test";
import { versionStatusPresentation } from "../src/versionStatus";

test("installed == latest pokazuje zielony status aktualności", () => {
  const view = versionStatusPresentation({ status: "current", currentVersion: "0.2.3", latestVersion: "0.2.3" });
  assert.equal(view.text, "✓ OPROGRAMOWANIE AKTUALNE");
  assert.equal(view.tone, "success");
  assert.equal(view.showReleaseButton, false);
});

test("latest > installed pokazuje dostępną aktualizację i przycisk wydania", () => {
  const view = versionStatusPresentation({ status: "updateAvailable", currentVersion: "0.2.3", latestVersion: "0.2.4", releaseUrl: "https://example.test/release" });
  assert.equal(view.text, "⚠ DOSTĘPNA AKTUALIZACJA v0.2.4");
  assert.equal(view.showReleaseButton, true);
});

test("checking pokazuje status sprawdzania", () => {
  assert.equal(versionStatusPresentation({ status: "checking", currentVersion: "0.2.3" }).text, "⟳ SPRAWDZANIE AKTUALIZACJI...");
});

test("error pokazuje status błędu", () => {
  assert.equal(versionStatusPresentation({ status: "error", currentVersion: "0.2.3" }).text, "✕ BŁĄD SPRAWDZANIA");
});

test("timeout pokazuje status przekroczenia czasu", () => {
  assert.equal(versionStatusPresentation({ status: "timeout", currentVersion: "0.2.3" }).text, "! TIMEOUT");
});

test("zielony status nie pojawia się bez wiarygodnej najnowszej wersji", () => {
  const view = versionStatusPresentation({ status: "current", currentVersion: "0.2.3" });
  assert.notEqual(view.tone, "success");
  assert.doesNotMatch(view.text, /OPROGRAMOWANIE AKTUALNE/);
});
