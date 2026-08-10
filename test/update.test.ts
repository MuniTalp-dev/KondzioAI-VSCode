import assert from "node:assert/strict";
import test from "node:test";
import { UPDATE_CONFIRMATION, UpdateService, updateApproved } from "../src/update";

class Store {
  values = new Map<string, unknown>();
  get<T>(key: string): T | undefined { return this.values.get(key) as T | undefined; }
  async update(key: string, value: unknown): Promise<void> { this.values.set(key, value); }
}

const response = (body: unknown, ok = true, status = 200) => async () => ({ ok, status, async json() { return body; } });

test("update unavailable oznacza wersję aktualną", async () => {
  const service = new UpdateService("0.2.0", "owner/KondzioAI-VSCode", new Store(), response({ tag_name: "v0.2.0", html_url: "https://github.com/owner/repo/releases/tag/v0.2.0" }));
  assert.equal((await service.check(true)).status, "current");
});

test("update available zwraca wersję i URL, ale niczego nie instaluje", async () => {
  let fetches = 0; const fetcher = async () => { fetches++; return { ok: true, status: 200, async json() { return { tag_name: "v0.3.0", html_url: "https://github.com/owner/repo/releases/tag/v0.3.0" }; } }; };
  const result = await new UpdateService("0.2.0", "owner/KondzioAI-VSCode", new Store(), fetcher).check(true);
  assert.equal(result.status, "updateAvailable"); assert.equal(result.latestVersion, "v0.3.0"); assert.equal(fetches, 1);
  assert.equal("install" in result, false);
});

test("błędna odpowiedź GitHub jest raportowana", async () => {
  const service = new UpdateService("0.2.0", "owner/KondzioAI-VSCode", new Store(), response({ unexpected: true }));
  const result = await service.check(true); assert.equal(result.status, "error"); assert.match(result.detail ?? "", /Nieprawidłowa/);
});

test("automatyczne sprawdzenie odbywa się maksymalnie raz na 24 godziny", async () => {
  const store = new Store(); let calls = 0; const fetcher = async () => { calls++; return { ok: true, status: 200, async json() { return { tag_name: "v0.2.0", html_url: "https://github.com/x/y" }; } }; };
  const service = new UpdateService("0.2.0", "owner/KondzioAI-VSCode", store, fetcher);
  await service.check(false, 100_000_000); await service.check(false, 100_000_001); assert.equal(calls, 1);
});

test("brak konfiguracji repo nie wysyła zapytania", async () => {
  let called = false; const service = new UpdateService("0.2.0", "", new Store(), async () => { called = true; throw new Error(); });
  assert.equal((await service.check(true)).status, "error"); assert.equal(called, false);
});

test("aktualizacja wymaga dokładnej zgody użytkownika", () => {
  assert.equal(updateApproved(undefined), false); assert.equal(updateApproved("Później"), false);
  assert.equal(updateApproved(UPDATE_CONFIRMATION), true);
});

test("update check kończy się stanem timeout i przekazuje AbortSignal", async () => {
  let signal: AbortSignal | undefined;
  const fetcher = (_input: string, init?: RequestInit) => new Promise<never>((_resolve, reject) => {
    signal = init?.signal ?? undefined;
    signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
  const result = await new UpdateService("0.2.1", "owner/repo", new Store(), fetcher, () => {}, 5).check(true);
  assert.equal(result.status, "timeout");
  assert.equal(signal?.aborted, true);
});
