(() => {
  "use strict";

  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  let runId;
  let releaseUrl;

  const sendClientError = value => {
    const message = value instanceof Error ? `${value.name}: ${value.message}\n${value.stack ?? ""}` : String(value);
    vscode.postMessage({ type: "clientError", value: message });
  };
  window.onerror = (message, source, line, column, error) => {
    sendClientError(error ?? `${message} at ${source}:${line}:${column}`);
  };
  window.addEventListener("unhandledrejection", event => sendClientError(event.reason));

  const autonomyDescriptions = {
    1: "AUTO 1: planowanie, routing, research, ETA, ryzyka i acceptance criteria; brak zmian.",
    2: "AUTO 2: implementacja, testy, validation i diff; bez automatycznego commita.",
    3: "AUTO 3: pełny pipeline, retry i eskalacja; commit dozwolony, push zawsze zatrzymany."
  };
  const modeDescriptions = {
    auto: "AUTO (zalecany): Orchestrator wybiera wykonawcę i może zastosować fallback.",
    local: "LOCAL: Qwen + Ollama + Aider.",
    research: "RESEARCH: SearXNG + Qwen, z fallbackiem DDGS.",
    codex: "CODEX: trudne zadania programistyczne."
  };

  function presentVersionStatus(result) {
    if (result.status === "checking") return { text: "⌛ SPRAWDZANIE AKTUALIZACJI...", tone: "progress", showReleaseButton: false };
    if (result.status === "updateAvailable") return { text: `⚠ DOSTĘPNA AKTUALIZACJA ${String(result.latestVersion ?? "").replace(/^v?/, "v")}`.trim(), tone: "warning", showReleaseButton: true };
    if (result.status === "timeout") return { text: "! TIMEOUT", tone: "warning", showReleaseButton: false };
    if (result.status === "error") return { text: "✕ BŁĄD SPRAWDZANIA", tone: "error", showReleaseButton: false };
    if (result.status === "current" && result.latestVersion) return { text: "✓ OPROGRAMOWANIE AKTUALNE", tone: "success", showReleaseButton: false };
    return { text: "? NIE SPRAWDZONO", tone: "progress", showReleaseButton: false };
  }

  function payloadFor(command, target) {
    if (command === "run") return { type: command, prompt: $("prompt").value, autonomy: Number($("autonomy").value), mode: $("mode").value, dryRun: $("dry").checked, preferLocal: $("preferLocal").checked, blockCodexEscalation: $("blockCodex").checked };
    if (command === "research") return { type: command, query: $("query").value };
    if (command === "status") return { type: command, runId: target.dataset.runId || runId };
    if (command === "openRelease") return { type: command, url: releaseUrl };
    if (command === "choosePath") return { type: command, key: target.dataset.key };
    if (command === "saveSettings") return { type: command, value: JSON.stringify(Object.fromEntries(["orchestratorPath", "researchLabPath", "sandboxPath", "projectsRoot"].map(key => [key, $(key).value]))) };
    if (["autonomyHelp", "modeHelp", "showResearch"].includes(command)) { toggleLocal(command); return undefined; }
    return { type: command, runId };
  }

  function toggleLocal(command) {
    if (command === "showResearch") { $("researchPanel").open = true; $("query").focus(); return; }
    const id = command === "autonomyHelp" ? "autonomyHelp" : "modeHelp";
    const select = $(command === "autonomyHelp" ? "autonomy" : "mode");
    $(id).textContent = (command === "autonomyHelp" ? autonomyDescriptions : modeDescriptions)[select.value];
    $(id).classList.toggle("open");
  }

  const esc = value => String(value ?? "—");
  const label = (name, value) => `<div><span class="muted">${name}</span><div class="value">${esc(value)}</div></div>`;
  function updateInfo() {
    const mode = $("mode").value;
    $("plannedExecutor").innerHTML = mode === "research" ? "RESEARCH<br>SearXNG + lokalny Qwen" : mode === "codex" && !$("preferLocal").checked ? "CODEX" : "LOCAL<br>Qwen 2.5 Coder 7B";
    $("codexBadge").textContent = $("blockCodex").checked ? "CODEX: CHRONIONY" : "CODEX: DOSTĘPNY";
  }
  function showStatus(value) {
    runId = value.run_id || runId;
    const files = Array.isArray(value.files_changed) ? value.files_changed : [];
    $("status").innerHTML = value.run_id && value.status !== "idle" ? `<strong>${esc(value.status)}</strong><div class="progress"><div class="bar" style="width:${esc(value.progress)}%"></div></div><div class="grid">${label("Run ID", value.run_id)}${label("Etap", value.current_stage)}${label("Agent", value.current_agent)}${label("Testy", value.test_status)}${label("Pliki", files.length)}${label("ETA", (value.initial_eta || {}).typical)}</div>` : "<strong>Brak aktywnego zadania</strong>";
    const approval = value.status === "awaiting_codex_approval" && value.codex_required === true;
    $("approval").classList.toggle("hidden", !approval);
    if (approval) $("codexBadge").textContent = "CODEX: WYMAGA ZGODY";
  }
  function showHistory(items) {
    $("historyPanel").open = true;
    const root = $("historyList"); root.innerHTML = "";
    if (!(items || []).length) { root.textContent = "Brak wcześniejszych zadań."; return; }
    items.slice(0, 10).forEach(item => { const button = document.createElement("button"); button.className = "history-item tertiary wide"; button.dataset.command = "status"; button.dataset.runId = item.run_id; button.textContent = [item.status, item.agent, item.prompt].filter(Boolean).join(" · "); root.appendChild(button); });
  }
  function showResearch(value) { $("researchPanel").open = true; $("researchResult").textContent = `Provider: ${esc(value.provider)} | Źródła: ${esc(value.source_count)}\n${esc(value.analysis)}`; }
  function showHealth(value) {
    const root = $("health"); root.innerHTML = "";
    (value.items || []).forEach(item => { const name = document.createElement("div"); name.textContent = `${item.status === "ERROR" ? "✕" : "✓"} ${item.name}`; const state = document.createElement("details"); state.innerHTML = `<summary class="${item.status}">${item.status}</summary><span class="muted">${esc(item.version || item.detail)}</span>`; root.append(name, state); });
  }
  const checking = () => showHealth({ items: ["Orchestrator", "MCP", "SearXNG", "Ollama", "Qwen", "Aider", "Codex", "Git", ".NET"].map(name => ({ name, status: "CHECKING" })) });
  function showUpdate(value) { const presentation = presentVersionStatus(value); releaseUrl = value.releaseUrl; $("versionStatus").className = `status-chip ${presentation.tone}`; $("versionStatus").textContent = presentation.text; $("openRelease").classList.toggle("hidden", !presentation.showReleaseButton); }

  document.querySelectorAll("button").forEach(button => { if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", button.textContent.trim()); });
  document.addEventListener("click", event => { const target = event.target instanceof Element ? event.target.closest("[data-command]") : null; const command = target?.getAttribute("data-command"); if (!command) return; const message = payloadFor(command, target); if (message) vscode.postMessage(message); });
  document.addEventListener("change", updateInfo);
  window.addEventListener("message", event => {
    const message = event.data;
    if (message.type === "status") showStatus(message.value); if (message.type === "history") showHistory(message.value); if (message.type === "research") showResearch(message.value); if (message.type === "health") showHealth(message.value); if (message.type === "healthChecking") checking(); if (message.type === "updateState") showUpdate(message.value);
    if (message.type === "warning") $("warning").textContent = message.value; if (message.type === "error") $("error").textContent = message.value; if (message.type === "busy") document.querySelector('[data-command="run"]').disabled = message.value; if (message.type === "pathSelected") $(message.key).value = message.value; if (message.type === "settings") Object.entries(message.value).forEach(([key, value]) => { $(key).value = value; }); if (message.type === "settingsSaved") $("settingsStatus").textContent = "Ustawienia zapisane.";
    if (message.type === "preset") { if (message.autonomy) $("autonomy").value = String(message.autonomy); if (message.section === "research") { $("researchPanel").open = true; $("query").focus(); } else $("prompt").focus(); }
  });

  updateInfo(); checking();
  vscode.postMessage({ type: "clientReady" });
})();
