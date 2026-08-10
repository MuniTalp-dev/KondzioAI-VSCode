(() => {
  "use strict";
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  let runId;
  let update;
  let history = [];
  let historyLimit = 5;
  let releaseConfirmationToken;

  const sendClientError = value => vscode.postMessage({ type: "clientError", value: value instanceof Error ? `${value.name}: ${value.message}\n${value.stack ?? ""}` : String(value) });
  window.onerror = (message, source, line, column, error) => sendClientError(error ?? `${message} at ${source}:${line}:${column}`);
  window.addEventListener("unhandledrejection", event => sendClientError(event.reason));
  const esc = value => String(value ?? "—");
  const htmlEsc = value => esc(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const autonomyDescriptions = { 1: "AUTO 1: plan, ETA, ryzyka i analiza; bez zmian.", 2: "AUTO 2: implementacja, testy i walidacja; bez automatycznego commita.", 3: "AUTO 3: pełny pipeline i retry; push zawsze zatrzymany." };
  const modeDescriptions = { auto: "AUTO (zalecany): Orchestrator wybiera wykonawcę.", local: "LOCAL: Qwen + Ollama + Aider.", research: "RESEARCH: SearXNG + Qwen, z fallbackiem DDGS.", codex: "CODEX: trudne zadania programistyczne." };
  const switchOn = id => $(id).getAttribute("aria-checked") === "true";

  function toggleSwitch(button) {
    const next = !switchOn(button.id);
    button.setAttribute("aria-checked", String(next));
    $(button.id === "dry" ? "dryState" : "codexState").textContent = next ? "ON" : "OFF";
    updateSummary();
  }
  function updateSummary() {
    const mode = $("mode").value;
    const save = switchOn("saveCodex");
    const dry = switchOn("dry");
    const executor = mode === "research" ? "RESEARCH • SearXNG + lokalny Qwen" : mode === "codex" ? "CODEX" : "LOCAL • Qwen 2.5 Coder 7B";
    const action = dry ? "TRYB PRÓBNY" : "Zmiany plików: TAK";
    const codex = mode === "codex" ? (save ? "CODEX: WYMAGA ZGODY" : "Wymaga użycia Codexa") : `CODEX: ${save ? "CHRONIONY" : "DOSTĘPNY"}`;
    $("taskSummary").innerHTML = `${executor}<br>AUTO ${$("autonomy").value} • ${action} • <span class="badge">${codex}</span>`;
  }
  function showHelp(command, target) {
    const map = { autonomyHelp: ["autonomyHelp", autonomyDescriptions[$("autonomy").value]], modeHelp: ["modeHelp", modeDescriptions[$("mode").value]], dryHelp: ["dryHelp"], codexHelp: ["codexHelp"] };
    const item = map[command]; if (!item) return false;
    const node = $(item[0]); if (item[1]) node.textContent = item[1]; node.classList.toggle("open"); target.setAttribute("aria-expanded", String(node.classList.contains("open"))); return true;
  }
  function activateTab(id) {
    document.querySelectorAll('[role="tab"]').forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.tab === id)));
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== id; });
    if (id === "historyPanel") vscode.postMessage({ type: "history" });
  }
  function payloadFor(command, target) {
    if (command === "run") return { type: command, prompt: $("prompt").value, autonomy: Number($("autonomy").value), mode: $("mode").value, dryRun: switchOn("dry"), preferLocal: switchOn("saveCodex"), blockCodexEscalation: switchOn("saveCodex") };
    if (command === "research") return { type: command, query: $("query").value };
    if (command === "status") return { type: command, runId: target.dataset.runId || runId };
    if (command === "choosePath") return { type: command, key: target.dataset.key };
    if (command === "saveSettings") return { type: command, value: JSON.stringify(Object.fromEntries(["orchestratorPath", "researchLabPath", "sandboxPath", "projectsRoot"].map(key => [key, $(key).value]))) };
    if (command === "openRelease") return { type: command, url: update?.releaseUrl };
    if (command === "confirmFullRelease") return { type: command, value: releaseConfirmationToken };
    return { type: command, runId };
  }
  function showStatus(value) {
    runId = value.run_id || runId;
    if (!value.run_id || value.status === "idle") { $("status").innerHTML = "<strong>Brak aktywnego zadania.</strong>"; return; }
    const active = ["queued", "routing", "researching", "planning", "implementing", "testing", "validating", "escalating"].includes(value.status);
    const completed = value.status === "completed";
    const files = Array.isArray(value.files_changed) ? value.files_changed.length : 0;
    const title = active ? "● W TRAKCIE" : completed ? "✓ ZAKOŃCZONE" : esc(value.status).toUpperCase();
    const detail = completed ? `${esc(value.current_agent)} • Testy ${esc(value.test_status)} • ${files} plik(i) • ${esc(value.elapsed_seconds)} s` : `${esc(value.current_agent)} • ${esc(value.current_stage)}<br>${esc(value.elapsed_seconds)} s • ETA ${esc((value.remaining_eta || {}).seconds)} s`;
    $("status").innerHTML = `<strong>${title}</strong><div>${detail}</div>${active ? `<div class="progress"><div class="bar" style="width:${esc(value.progress)}%"></div></div><button data-command="cancel">ANULUJ</button>` : `<button data-command="status" data-run-id="${esc(value.run_id)}">SZCZEGÓŁY</button>`}`;
    $("approval").classList.toggle("hidden", !(value.status === "awaiting_codex_approval" && value.codex_required === true));
  }
  function renderHistory() {
    const root = $("historyList"); root.innerHTML = "";
    if (!history.length) { root.textContent = "Brak wcześniejszych zadań."; return; }
    history.slice(0, historyLimit).forEach(item => { const button = document.createElement("button"); button.className = "history-item"; button.dataset.command = "status"; button.dataset.runId = item.run_id; button.textContent = [item.status, item.agent, item.prompt, item.started_at].filter(Boolean).join(" • "); root.appendChild(button); });
    $("moreHistory").classList.toggle("hidden", historyLimit >= history.length);
  }
  function showHealth(value) {
    const root = $("health"); root.innerHTML = "";
    (value.items || []).forEach(item => { const warning = item.name === "Codex CLI" && item.status === "ERROR"; const state = warning ? "WARNING" : item.status; const icon = state === "ERROR" ? "✕" : state === "WARNING" ? "⚠" : "✓"; const row = document.createElement("div"); row.className = "tool-row"; const name = document.createElement("span"); name.className = "tool-name"; name.textContent = item.name; const status = document.createElement("span"); status.className = `tool-status ${state}`; status.textContent = `${icon} ${warning ? "WARNING" : state}`; status.title = warning ? `Codex CLI — opcjonalny. ${esc(item.version || item.detail)}` : esc(item.version || item.detail); row.append(name, status); root.appendChild(row); });
  }
  function showUpdate(value) {
    update = value; const status = $("versionStatus"); const available = value.status === "updateAvailable";
    status.textContent = value.status === "current" ? "✓" : available ? "!" : value.status === "checking" ? "…" : "?";
    status.className = `status-chip ${value.status === "current" ? "success" : available ? "warning" : ""}`;
    status.title = value.status === "current" ? "Oprogramowanie aktualne" : available ? "Dostępna aktualizacja" : "Nie sprawdzono aktualności";
    $("updateActions").classList.toggle("hidden", !available);
  }
  function showRelease(value) {
    $("releaseState").textContent = value.state;
    $("releaseMetaPanel").textContent = `Repozytorium: ${esc(value.repository)}\nBranch: ${esc(value.branch)}\nOrigin: ${esc(value.remote)}\nGit status: ${esc(value.status)}\nWersja: ${esc(value.version)}\nTag lokalny: ${value.tag} — ${value.localTagExists ? "ISTNIEJE" : "BRAK"}\nTag na remote: ${value.remoteTagExists ? "ISTNIEJE" : "BRAK"}`;
    $("releaseChecks").innerHTML = (value.checks || []).map(check => `<div class="tool-row"><span class="tool-name">${check.pass ? "✓" : "✕"} ${htmlEsc(check.label)}</span><span class="tool-status ${check.pass ? "OK" : "ERROR"}">${htmlEsc(check.detail)}</span></div>`).join("");
    $("releasePlan").textContent = `COMMIT: ${esc(value.commitMessage)}\nTAG: ${esc(value.tag)}\nREMOTE: ${esc(value.remote)}\nBRANCH: ${esc(value.branch)}\nWERSJA: ${esc(value.version)}\nVSIX: ${esc(value.vsix)}\nSHA-256: ${esc(value.sha256)}`;
    (value.log || []).forEach(line => { $("releaseLog").textContent += `${line}\n`; });
  }
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest("button") : null; if (!target) return;
    if (target.classList.contains("switch")) { toggleSwitch(target); return; }
    if (target.dataset.tab) { activateTab(target.dataset.tab); return; }
    const command = target.dataset.command; if (!command) return;
    if (showHelp(command, target)) return;
    if (command === "showChangelog") { $("releaseMeta").textContent = `${esc(update.latestVersion)} • ${esc(update.publishedAt)}`; $("releaseNotes").textContent = esc(update.releaseNotes); $("changelogModal").classList.remove("hidden"); return; }
    if (command === "closeChangelog") { $("changelogModal").classList.add("hidden"); return; }
    if (command === "moreHistory") { historyLimit += 5; renderHistory(); return; }
    if (command === "cancelRelease") { $("releaseConfirmModal").classList.add("hidden"); return; }
    if (command === "confirmFullRelease") $("releaseConfirmModal").classList.add("hidden");
    vscode.postMessage(payloadFor(command, target));
  });
  document.addEventListener("keydown", event => { if (event.target instanceof Element && event.target.classList.contains("switch") && (event.key === " " || event.key === "Enter")) { event.preventDefault(); toggleSwitch(event.target); } });
  document.addEventListener("change", updateSummary);
  window.addEventListener("message", event => { const message = event.data;
    if (message.type === "installSecurityError") { $("installStatus").textContent = message.value.message; $("openReleaseAfterError").classList.remove("hidden"); }
    if (message.type === "releaseResult") showRelease(message.value); if (message.type === "releaseLog") { $("releaseState").textContent = message.value.state; $("releaseLog").textContent += `${message.value.state}: ${message.value.line}\n`; } if (message.type === "releaseConfirm") { const value = message.value; releaseConfirmationToken = value.confirmationToken; $("releaseConfirmText").textContent = `WERSJA: ${value.version}\nBRANCH: ${value.branch}\nREMOTE: ${value.remote}\nCOMMIT: ${value.commitMessage}\nTAG: ${value.tag}\n\nOperacje:\n- push main\n- push tag`; $("releaseConfirmModal").classList.remove("hidden"); }
    if (message.type === "status") showStatus(message.value); if (message.type === "history") { history = message.value || []; historyLimit = 5; renderHistory(); } if (message.type === "research") $("researchResult").textContent = `Provider: ${esc(message.value.provider)} | Źródła: ${esc(message.value.source_count)}\n${esc(message.value.analysis)}`; if (message.type === "health") showHealth(message.value); if (message.type === "healthChecking") showHealth({ items: ["Orchestrator", "MCP", "SearXNG", "Ollama", "Qwen", "Aider", "Git", ".NET", "Codex IDE", "Codex CLI"].map(name => ({ name, status: "CHECKING" })) }); if (message.type === "updateState") showUpdate(message.value);
    if (message.type === "warning") $("warning").textContent = message.value; if (message.type === "error") $("error").textContent = message.value; if (message.type === "installState") $("installStatus").textContent = message.value; if (message.type === "installSuccess") { $("installStatus").textContent = message.value; $("updateActions").classList.add("hidden"); $("changelogModal").classList.add("hidden"); $("reloadWindow").classList.remove("hidden"); } if (message.type === "busy") document.querySelector('[data-command="run"]').disabled = message.value; if (message.type === "pathSelected") $(message.key).value = message.value; if (message.type === "settings") Object.entries(message.value).forEach(([key, value]) => { $(key).value = value; }); if (message.type === "settingsSaved") { $("settingsStatus").textContent = "Ustawienia zapisane."; vscode.postMessage({ type: "healthCheck" }); } if (message.type === "preset") { if (message.autonomy) $("autonomy").value = String(message.autonomy); activateTab(message.section === "research" ? "researchPanel" : "taskPanel"); }
  });
  const releaseSection = document.createElement("section"); releaseSection.className = "card";
  releaseSection.innerHTML = `<strong>RELEASE / GIT</strong> <span id="releaseState" class="status-chip">NIEGOTOWE</span><pre id="releaseMetaPanel">Kliknij SPRAWDŹ GOTOWOŚĆ.</pre><div id="releaseChecks"></div><pre id="releasePlan"></pre><div class="actions"><button data-command="releaseReadiness">SPRAWDŹ GOTOWOŚĆ</button><button data-command="releaseDryRun">DRY-RUN WYDANIA</button></div><button class="primary wide" data-command="prepareFullRelease">PEŁNE WYDANIE</button><pre id="releaseLog" aria-live="polite"></pre>`; $("diagnosticsPanel").appendChild(releaseSection);
  const releaseModal = document.createElement("div"); releaseModal.id = "releaseConfirmModal"; releaseModal.className = "modal hidden"; releaseModal.setAttribute("role", "dialog"); releaseModal.setAttribute("aria-modal", "true"); releaseModal.innerHTML = `<div class="modal-card"><h2>POTWIERDZENIE WYDANIA</h2><pre id="releaseConfirmText"></pre><div class="actions"><button data-command="cancelRelease">ANULUJ</button><button class="primary" data-command="confirmFullRelease">ZATWIERDZAM WYDANIE</button></div></div>`; document.body.appendChild(releaseModal);
  const manualUpdate = document.createElement("button");
  manualUpdate.dataset.command = "checkForUpdates";
  manualUpdate.textContent = "SPRAWDŹ AKTUALIZACJĘ";
  $("diagnosticsPanel").insertBefore(manualUpdate, $("diagnosticsPanel").children[2] ?? null);
  const openReleaseAfterError = document.createElement("button"); openReleaseAfterError.id = "openReleaseAfterError"; openReleaseAfterError.className = "hidden"; openReleaseAfterError.dataset.command = "openRelease"; openReleaseAfterError.textContent = "OTWÓRZ WYDANIE"; $("installStatus").after(openReleaseAfterError);
  updateSummary();
  vscode.postMessage({ type: "clientReady" });
})();
