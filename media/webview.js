(() => {
  "use strict";
  const vscode = acquireVsCodeApi(), $ = id => document.getElementById(id);
  const saved = vscode.getState() || {};
  let runId, update, projectState, history = [], historyLimit = 5, releaseConfirmationToken;
  let currentStatus, elapsedTimer, autoScroll = true;
  const esc = value => String(value ?? "—");
  const htmlEsc = value => esc(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const activeStates = new Set(["queued", "routing", "researching", "planning", "implementing", "testing", "validating", "escalating"]);
  const autonomyDescriptions = { 1: "AUTO 1: plan, ETA, ryzyka i analiza; bez zmian.", 2: "AUTO 2: implementacja, testy i walidacja; bez automatycznego commita.", 3: "AUTO 3: pełny pipeline i retry; push zawsze zatrzymany." };
  const modeDescriptions = { auto: "AUTO: Silnik Kondzio AI wybiera wykonawcę.", local: "LOCAL: Qwen + Ollama + Aider.", research: "RESEARCH: SearXNG + Qwen.", codex: "CODEX: trudne zadania programistyczne.", claude: "CLAUDE: oficjalny Claude CLI." };
  const switchOn = id => $(id)?.getAttribute("aria-checked") === "true";
  const clientError = value => vscode.postMessage({ type: "clientError", value: value instanceof Error ? `${value.name}: ${value.message}\n${value.stack || ""}` : String(value) });
  window.onerror = (message, source, line, column, error) => clientError(error || `${message} at ${source}:${line}:${column}`);
  window.addEventListener("unhandledrejection", event => clientError(event.reason));

  function activateTab(id, persist = true) {
    const safe = $(id) ? id : "workPanel";
    document.querySelectorAll('[role="tab"]').forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.tab === safe)));
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== safe; });
    if (persist) vscode.setState({ ...vscode.getState(), activeTab: safe });
  }
  function toggleSwitch(button) {
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(next));
    if (button.id === "dry") $("dryState").textContent = next ? "ON" : "OFF";
    if (button.id === "saveCodex") $("codexState").textContent = next ? "ON" : "OFF";
    if (button.id === "autoUpdates") vscode.postMessage({ type: "toggleAutoUpdates", value: next });
    updateSummary();
  }
  function updateSummary() {
    const mode = $("mode").value, save = switchOn("saveCodex"), dry = switchOn("dry");
    const plan = mode === "research" ? "RESEARCH • SearXNG + Qwen" : mode === "codex" ? "CODEX" : mode === "claude" ? "CLAUDE" : "LOCAL • Qwen 2.5 Coder";
    $("taskSummary").innerHTML = `Plan: ${plan}<br>${dry ? "TRYB PRÓBNY" : "Zmiany plików: TAK"}${save ? "<br>Premium AI: CHRONIONE" : ""}`;
  }
  function showHelp(command, target) {
    const map = { autonomyHelp: ["autonomyHelp", autonomyDescriptions[$("autonomy").value]], modeHelp: ["modeHelp", modeDescriptions[$("mode").value]], dryHelp: ["dryHelp"], codexHelp: ["codexHelp"] };
    const item = map[command]; if (!item) return false;
    const node = $(item[0]); if (item[1]) node.textContent = item[1]; node.classList.toggle("open"); target.setAttribute("aria-expanded", String(node.classList.contains("open"))); return true;
  }
  function payloadFor(command, target) {
    if (command === "run") { if (!projectState) return; return { type: "run", prompt: $("prompt").value, autonomy: Number($("autonomy").value), mode: $("mode").value, dryRun: switchOn("dry"), preferLocal: switchOn("saveCodex"), blockCodexEscalation: switchOn("saveCodex"), ...projectState }; }
    if (command === "research") return { type: command, query: $("query").value };
    if (command === "status") return { type: command, runId: target.dataset.runId || runId };
    if (command === "choosePath") return { type: command, key: target.dataset.key };
    if (command === "saveSettings") return { type: command, value: JSON.stringify(Object.fromEntries(["orchestratorPath", "researchLabPath", "sandboxPath", "projectsRoot", "activeProjectRoot"].map(key => [key, $(key).value]))) };
    if (command === "openRelease") return { type: command, url: update?.releaseUrl };
    if (command === "confirmFullRelease") return { type: command, value: releaseConfirmationToken };
    return { type: command, runId };
  }
  const clock = seconds => { const s = Math.max(0, Math.floor(Number(seconds) || 0)); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };
  const timer = seconds => { const s = Math.max(0, Math.floor(Number(seconds) || 0)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const startTime = value => value.started_at ? new Date(value.started_at) : new Date(Date.now() - (Number(value.elapsed_seconds) || 0) * 1000);
  function operationalStages(value) {
    const active = activeStates.has(value.status), done = value.status === "completed", failed = /^failed/.test(value.status);
    const current = value.current_stage || value.status;
    const labels = ["Analiza zadania", `Projekt: ${value.project_name || projectState?.projectName || "—"}`, "Routing", "Analizuję projekt", "Wprowadzenie zmian", "Testy", "Walidacja"];
    const stageIndex = value.status === "queued" ? 0 : value.status === "routing" ? 2 : ["researching", "planning"].includes(value.status) ? 3 : value.status === "implementing" ? 4 : value.status === "testing" ? 5 : value.status === "validating" ? 6 : done || failed ? 6 : 0;
    return labels.map((name, index) => ({ name, state: failed && index === stageIndex ? "failed" : index < stageIndex || done ? "completed" : index === stageIndex && active ? "active" : "waiting", current }));
  }
  function renderActivity(value) {
    currentStatus = value; runId = value.run_id || runId;
    const base = startTime(value), elapsed = Math.max(Number(value.elapsed_seconds) || 0, (Date.now() - base.getTime()) / 1000);
    const etaSeconds = value.remaining_eta && typeof value.remaining_eta.seconds === "number" ? value.remaining_eta.seconds : undefined;
    const icons = { waiting: "○", active: "●", completed: "✓", warning: "⚠", failed: "✕" };
    $("activityList").innerHTML = operationalStages(value).map((stage, index) => {
      const time = new Date(base.getTime() + Math.min(index, elapsed) * 1000).toLocaleTimeString("pl-PL", { hour12: false });
      const detail = stage.state === "active" ? `Czas: ${timer(elapsed)}\nETA: ${etaSeconds === undefined ? "—" : `~${timer(etaSeconds)}`}\n${value.current_agent ? `Wykonawca: ${htmlEsc(value.current_agent)}` : ""}` : stage.state === "completed" ? clock(Math.min(elapsed, Math.max(1, index + 1))) : "";
      return `<div class="activity-row"><time>${time}</time><span class="${stage.state === "failed" ? "error" : stage.state === "active" || stage.state === "completed" ? "success" : "muted"}">${icons[stage.state]}</span><b>${htmlEsc(stage.name)}</b>${detail ? `<span class="activity-meta">${detail}</span>` : ""}</div>`;
    }).join("");
    if (autoScroll) $("activity").scrollTop = $("activity").scrollHeight;
    const terminal = !activeStates.has(value.status) && value.status !== "idle" && value.run_id;
    $("runSummary").classList.toggle("hidden", !terminal);
    if (terminal) {
      const files = Array.isArray(value.files_changed) ? value.files_changed.length : 0;
      $("runSummary").innerHTML = value.status === "completed" ? `<b>ZAKOŃCZONO • ${clock(elapsed)}</b><p>${htmlEsc(value.current_agent || "LOCAL")} • CODEX ${value.codex_used ? 1 : 0} • CLAUDE ${(value.executors_used || []).includes("CLAUDE") ? 1 : 0}</p><p>Pliki: ${files}<br>Testy: ${htmlEsc(value.test_status || "—")}<br>Walidacja: ${htmlEsc(value.validation_status || "—")}</p>` : `<b>ZAKOŃCZONO Z BŁĘDEM</b><p>Etap:<br>${htmlEsc(value.current_stage || value.status)}</p><p>Powód:<br>${htmlEsc(value.context_details?.reason || value.error || value.status)}</p>`;
    }
  }
  function showUsage(values) { document.querySelectorAll(".usage-line").forEach(row => { const value = (values || []).find(item => item.provider === row.dataset.provider), spans = row.querySelectorAll(":scope > span"), used = value?.available && typeof value.usedPercent === "number" ? `${Math.round(value.usedPercent)}%` : "—"; spans[0].querySelector("i").style.width = value?.available ? `${value.usedPercent}%` : "0"; spans[1].textContent = `Zużycie: ${used}`; spans[2].textContent = `Reset: ${value?.available && value.resetAt ? new Date(value.resetAt).toLocaleString("pl-PL") : "—"}`; row.title = value ? `Provider: ${value.provider}\nŹródło: ${value.source}\nWykorzystano: ${used}\nReset: ${value.resetAt || "—"}\n${value.error || ""}` : "Brak danych"; }); }
  function showProject(value) { projectState = value; $("activeProject").textContent = `Projekt: ${value?.projectName || "NIE WYBRANO"}`; $("runTask").disabled = !value; const labels = [["Nazwa", value?.projectName], ["Folder", value?.projectRoot], ["Typ", value?.projectType], ["Branch", value?.branch], ["Git", value?.gitStatus], ["GitHub", value?.githubRemote]]; $("projectOverview").innerHTML = labels.map(([name, val]) => `<b>${name}</b><span class="value">${htmlEsc(val || "—")}</span>`).join(""); }
  function showHealth(value) { const root = $("health"); root.innerHTML = ""; (value.items || []).forEach(item => { const warning = item.name === "Codex CLI" && item.status === "ERROR", state = warning ? "WARNING" : item.status, row = document.createElement("div"); row.className = "tool-row"; row.innerHTML = `<span class="tool-name">${htmlEsc(item.name)}</span><span class="tool-status ${state}">${state}</span>`; if (state === "WARNING" || state === "ERROR") { const help = document.createElement("button"); help.textContent = "?"; help.title = `Problem: ${esc(item.detail || item.version)}\nWpływ: ${state === "WARNING" ? "funkcja opcjonalna może być niedostępna" : "narzędzie nie może zostać użyte"}\nRozwiązanie: sprawdź ścieżkę i instalację narzędzia.`; row.appendChild(help); } root.appendChild(row); }); }
  function showUpdate(value) { update = value; const node = $("versionStatus"), available = value.status === "updateAvailable"; node.textContent = value.status === "current" ? "✓" : value.status === "checking" ? "…" : value.status === "idle" ? "?" : "!"; node.className = `update-status ${value.status === "current" ? "success" : value.status === "checking" ? "checking" : value.status === "idle" ? "" : "error"}`; node.setAttribute("aria-label", `Status aktualizacji: ${value.status}`); $("updateActions").classList.toggle("hidden", !available); $("lastUpdateCheck").textContent = new Date().toLocaleString("pl-PL"); }
  function renderHistory() { $("historyList").innerHTML = history.length ? history.slice(0, historyLimit).map(item => `<button data-command="status" data-run-id="${htmlEsc(item.run_id)}">${htmlEsc([item.project_name, item.status, item.agent, item.prompt].filter(Boolean).join(" • "))}</button>`).join("") : "Brak wcześniejszych zadań."; $("moreHistory").classList.toggle("hidden", historyLimit >= history.length); }
  function showRelease(value) { $("releaseState").textContent = value.state; $("releaseMetaPanel").textContent = `Repozytorium: ${esc(value.repository)}\nBranch: ${esc(value.branch)}\nOrigin: ${esc(value.remote)}\nGit status: ${esc(value.status)}\nWersja: ${esc(value.version)}`; $("releaseChecks").innerHTML = (value.checks || []).map(check => `<div>${check.pass ? "✓" : "✕"} ${htmlEsc(check.label)} — ${htmlEsc(check.detail)}</div>`).join(""); $("releasePlan").textContent = `TAG: ${esc(value.tag)}\nVSIX: ${esc(value.vsix)}\nSHA-256: ${esc(value.sha256)}`; }

  document.addEventListener("click", event => { const target = event.target instanceof Element ? event.target.closest("button") : null; if (!target) return; if (target.classList.contains("switch")) { toggleSwitch(target); return; } if (target.classList.contains("usage-line")) { alert(target.title); return; } if (target.dataset.tab) { activateTab(target.dataset.tab); return; } const command = target.dataset.command; if (!command) return; if (showHelp(command, target)) return; if (command === "latestActivity") { autoScroll = true; $("latestActivity").classList.add("hidden"); $("activity").scrollTop = $("activity").scrollHeight; return; } if (command === "showChangelog") { $("releaseMeta").textContent = `${esc(update?.latestVersion)} • ${esc(update?.publishedAt)}`; $("releaseNotes").textContent = esc(update?.releaseNotes); $("changelogModal").classList.remove("hidden"); return; } if (command === "closeChangelog") { $("changelogModal").classList.add("hidden"); return; } if (command === "moreHistory") { historyLimit += 5; renderHistory(); return; } if (command === "cancelRelease") { $("releaseConfirmModal").classList.add("hidden"); return; } if (command === "confirmFullRelease") $("releaseConfirmModal").classList.add("hidden"); const payload = payloadFor(command, target); if (payload) vscode.postMessage(payload); });
  $("activity").addEventListener("scroll", () => { const nearBottom = $("activity").scrollHeight - $("activity").scrollTop - $("activity").clientHeight < 20; if (!nearBottom) autoScroll = false; if (nearBottom) autoScroll = true; $("latestActivity").classList.toggle("hidden", autoScroll); });
  document.addEventListener("change", updateSummary);
  window.addEventListener("message", event => { if (event.data.type === "autoUpdatesState") $("autoUpdates").setAttribute("aria-checked", String(Boolean(event.data.value))); });
  window.addEventListener("message", event => { const m = event.data; if (m.type === "projectState") showProject(m.value); if (m.type === "usage") showUsage(m.value); if (m.type === "status") renderActivity(m.value); if (m.type === "history") { history = m.value || []; historyLimit = 5; renderHistory(); } if (m.type === "research") $("researchResult").textContent = `Provider: ${esc(m.value.provider)} | Źródła: ${esc(m.value.source_count)}\n${esc(m.value.analysis)}`; if (m.type === "health") showHealth(m.value); if (m.type === "healthChecking") showHealth({ items: ["Silnik Kondzio AI", "MCP", "SearXNG", "Ollama", "Qwen", "Aider", "Git", "Codex IDE", "Codex CLI", "Claude CLI"].map(name => ({ name, status: "CHECKING" })) }); if (m.type === "updateState") showUpdate(m.value); if (m.type === "warning") $("warning").textContent = m.value; if (m.type === "error") $("error").textContent = m.value; if (m.type === "busy") $("runTask").disabled = Boolean(m.value) || !projectState; if (m.type === "pathSelected") $(m.key).value = m.value; if (m.type === "settings") Object.entries(m.value).forEach(([key, value]) => { if ($(key)) $(key).value = value; }); if (m.type === "settingsSaved") $("settingsStatus").textContent = "Ustawienia zapisane."; if (m.type === "installState") $("installStatus").textContent = m.value; if (m.type === "installSuccess") { $("installStatus").textContent = m.value; $("reloadWindow").classList.remove("hidden"); } if (m.type === "installSecurityError") { $("installStatus").textContent = m.value.message; $("openReleaseAfterError").classList.remove("hidden"); } if (m.type === "releaseResult") showRelease(m.value); if (m.type === "releaseLog") $("releaseLog").textContent += `${m.value.state}: ${m.value.line}\n`; if (m.type === "releaseConfirm") { releaseConfirmationToken = m.value.confirmationToken; $("releaseConfirmText").textContent = `WERSJA: ${m.value.version}\nBRANCH: ${m.value.branch}\nREMOTE: ${m.value.remote}\n\nOperacje:\n- push main\n- push tag`; $("releaseConfirmModal").classList.remove("hidden"); } if (m.type === "preset") { if (m.autonomy) $("autonomy").value = String(m.autonomy); activateTab("workPanel"); if (m.section === "research") $("query").focus(); else $("prompt").focus(); } });
  elapsedTimer = setInterval(() => { if (currentStatus && activeStates.has(currentStatus.status)) renderActivity(currentStatus); }, 1000);
  window.addEventListener("unload", () => clearInterval(elapsedTimer));
  activateTab(saved.activeTab || "workPanel", false); updateSummary(); vscode.postMessage({ type: "clientReady" });
})();
