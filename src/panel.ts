import * as vscode from "vscode";
import { ACTIVE_STATES, OrchestratorController, progressFor } from "./model";
import { Autonomy, ExecutorMode, StatusResult } from "./types";
import { UpdateService } from "./update";
import { AUTONOMY_DESCRIPTIONS, MODE_DESCRIPTIONS } from "./descriptions";
import { runUpdateCheck } from "./updateFlow";
import { versionStatusPresentation } from "./versionStatus";
import { webviewClientScript } from "./webviewBus";

type PanelMessage = { type?: string; prompt?: string; autonomy?: Autonomy; mode?: ExecutorMode; dryRun?: boolean; preferLocal?: boolean; blockCodexEscalation?: boolean; query?: string; runId?: string; url?: string; key?: string; value?: string };
const pathDefaults: Record<string, string> = {
  orchestratorPath: "E:\\AI\\Orchestrator", researchLabPath: "E:\\AI\\ResearchLab",
  sandboxPath: "E:\\AI\\Repos", projectsRoot: "C:\\Projekty\\VCode",
};
const escapeHtmlAttribute = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;").replace(/\n/g, "&#10;");

export class KondzioViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "kondzioAi.main";
  private view?: vscode.WebviewView;
  private poll?: NodeJS.Timeout;
  private currentRunId?: string;
  private lastRequest?: { prompt: string; autonomy: Autonomy; mode: ExecutorMode; dryRun: boolean; preferLocal: boolean; blockCodexEscalation: boolean };
  private messageSubscription?: vscode.Disposable;

  constructor(private readonly controller: OrchestratorController, private readonly onStatus: (status?: StatusResult) => void,
    private readonly openMarkdown: (title: string, markdown: string) => Promise<void>, private readonly updates: UpdateService,
    private readonly confirmUpdate: (url: string) => Promise<void>, private readonly log: (message: string) => void = () => {},
    private readonly extensionUri: vscode.Uri = vscode.Uri.file(__dirname)) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")] };
    const scriptUri = view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.js"));
    view.webview.html = html(this.updates.installedVersion, this.settings(), scriptUri.toString(), view.webview.cspSource);
    this.messageSubscription?.dispose();
    this.messageSubscription = view.webview.onDidReceiveMessage(message => void this.handle(message as PanelMessage));
    this.log("WebView panel created");
    void this.refreshStatus(); void this.checkHealth();
    if (this.updates.shouldAutoCheck()) { void this.checkUpdate(false); }
  }

  reveal(): Thenable<unknown> { return vscode.commands.executeCommand("workbench.view.extension.kondzioAi"); }
  preset(autonomy?: Autonomy, section = "task"): void { this.post({ type: "preset", autonomy, section }); }
  async reloadPanel(): Promise<void> { await this.reveal(); if (this.view) { this.resolveWebviewView(this.view); } }
  async resetWebviewState(): Promise<void> { this.currentRunId = undefined; this.lastRequest = undefined; this.stopPolling(); await this.reloadPanel(); }

  async run(prompt: string, autonomy: Autonomy, mode: ExecutorMode, dryRun: boolean, preferLocal = false, blockCodexEscalation = false, codexApproved = false): Promise<void> {
    if (!prompt.trim()) { throw new Error("Pole „Co mam zrobić?” nie może być puste."); }
    this.post({ type: "busy", value: true });
    const preflight = await this.controller.preflight(mode); this.post({ type: "health", value: preflight.health });
    if (preflight.warnings.length) { this.post({ type: "warning", value: preflight.warnings.join("\n") }); }
    this.lastRequest = { prompt: prompt.trim(), autonomy, mode, dryRun, preferLocal, blockCodexEscalation };
    const paths = this.settings();
    const status = await this.controller.run(prompt.trim(), autonomy, mode, dryRun, preferLocal, blockCodexEscalation,
      codexApproved, paths.sandboxPath, paths.projectsRoot);
    this.currentRunId = status.run_id; this.publishStatus(status); if (ACTIVE_STATES.has(status.status)) { this.startPolling(); }
  }
  async refreshStatus(runId = this.currentRunId): Promise<void> { try { this.publishStatus(await this.controller.status(runId)); } catch (error) { this.error(error); } }
  async showHistory(): Promise<void> { try { this.post({ type: "history", value: (await this.controller.history()).runs }); } catch (error) { this.error(error); } }
  async showLastReport(): Promise<void> { try { const result = await this.controller.lastReport(); await this.openMarkdown(`Kondzio AI — ${result.run_id ?? "raport"}`, result.report); } catch (error) { this.error(error); } }

  private async handle(message: PanelMessage): Promise<void> {
    this.log(`WebView message received: ${JSON.stringify(message)}`);
    try {
      switch (message.type) {
        case "clientReady": this.log("WebView client ready"); break;
        case "clientError": this.log(`WebView client error: ${message.value ?? "unknown error"}`); break;
        case "run": await this.run(message.prompt ?? "", message.autonomy ?? 2, message.mode ?? "auto", Boolean(message.dryRun), Boolean(message.preferLocal), Boolean(message.blockCodexEscalation)); break;
        case "approveCodex": if (this.lastRequest) { const r = this.lastRequest; await this.run(r.prompt, r.autonomy, "codex", r.dryRun, false, r.blockCodexEscalation, true); } break;
        case "finishTask": this.stopPolling(); this.post({ type: "finishedProtected" }); break;
        case "cancel": this.publishStatus(await this.controller.cancel(message.runId ?? this.currentRunId) as unknown as StatusResult); this.stopPolling(); break;
        case "status": await this.refreshStatus(message.runId); break;
        case "history": await this.showHistory(); break;
        case "lastReport": await this.showLastReport(); break;
        case "research": this.post({ type: "research", value: await this.controller.research(message.query?.trim() ?? "") }); break;
        case "healthCheck": await this.checkHealth(); break;
        case "checkForUpdates": await this.checkUpdate(true); break;
        case "openRelease": if (message.url) { await this.confirmUpdate(message.url); } break;
        case "documentation": await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(__dirname), "..", "..", "docs", "README.md").fsPath)); break;
        case "choosePath": await this.choosePath(message.key); break;
        case "saveSettings": await this.saveSettings(message); break;
        case "restoreDefaults": await this.restoreDefaults(); break;
      }
    } catch (error) { this.error(error); } finally { this.post({ type: "busy", value: false }); }
  }

  private settings(): Record<string, string> { const c = vscode.workspace.getConfiguration("kondzioAi"); return Object.fromEntries(Object.entries(pathDefaults).map(([key, value]) => [key, c.get<string>(key, value)])); }
  private async choosePath(key?: string): Promise<void> { if (!key || !(key in pathDefaults)) { return; } const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false }); if (picked?.[0]) { this.post({ type: "pathSelected", key, value: picked[0].fsPath }); } }
  private async saveSettings(message: PanelMessage): Promise<void> { const values = message.value ? JSON.parse(message.value) as Record<string, string> : {}; const c = vscode.workspace.getConfiguration("kondzioAi"); for (const key of Object.keys(pathDefaults)) { await c.update(key, values[key] ?? pathDefaults[key], vscode.ConfigurationTarget.Global); } this.post({ type: "settingsSaved" }); }
  private async restoreDefaults(): Promise<void> { const c = vscode.workspace.getConfiguration("kondzioAi"); for (const [key, value] of Object.entries(pathDefaults)) { await c.update(key, value, vscode.ConfigurationTarget.Global); } this.post({ type: "settings", value: pathDefaults }); }
  private publishStatus(status: StatusResult): void { if (status.run_id) { this.currentRunId = status.run_id; } this.post({ type: "status", value: { ...status, progress: progressFor(status.current_stage ?? status.status) } }); this.onStatus(status); if (!ACTIVE_STATES.has(status.status)) { this.stopPolling(); } }
  async checkHealth(): Promise<void> { this.post({ type: "healthChecking" }); this.post({ type: "health", value: await this.controller.health() }); }
  async checkUpdate(manual: boolean): Promise<void> { await runUpdateCheck(() => this.updates.check(manual), result => this.post({ type: "updateState", value: result }), this.updates.installedVersion); }
  private startPolling(): void { this.stopPolling(); this.poll = setInterval(() => void this.refreshStatus(), 2000); }
  private stopPolling(): void { if (this.poll) { clearInterval(this.poll); this.poll = undefined; } }
  private error(error: unknown): void { this.post({ type: "error", value: error instanceof Error ? error.message : String(error) }); this.onStatus({ status: "failed_executor", run_id: this.currentRunId ?? "" }); }
  private post(value: unknown): void { void this.view?.webview.postMessage(value); }
  dispose(): void { this.stopPolling(); this.messageSubscription?.dispose(); this.view = undefined; }
}

export function html(installedVersion = "", settings: Record<string, string> = pathDefaults, scriptUri = "media/webview.js", cspSource = "'self'"): string {
  const nonce = Math.random().toString(36).slice(2);
  const document = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src ${cspSource} 'nonce-${nonce}';"><style nonce="${nonce}">
  :root{color-scheme:light dark;--kondzio-accent:#57A639;--kondzio-hover:#65b747;--kondzio-active:#4b9231}*{box-sizing:border-box}body{font:13px var(--vscode-font-family);color:var(--vscode-foreground);padding:8px;margin:0;overflow-x:hidden}.brand,.line,.labelrow{display:flex;align-items:center;gap:7px}.brand{margin-bottom:8px}.logo{font-size:18px;font-weight:800}.muted{color:var(--vscode-descriptionForeground);font-size:12px}textarea,input,select{width:100%;min-width:0;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:6px}textarea{min-height:72px;resize:vertical}.row,.actions,.paths{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.field{margin:6px 0}.field label,.section-title{display:block;font-weight:700;margin-bottom:4px}.labelrow{justify-content:space-between}.check{display:flex;align-items:flex-start;gap:6px;margin:4px 0}.check input{width:auto;margin-top:2px}button{border:1px solid var(--vscode-button-border,transparent);border-radius:2px;padding:6px 8px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);font-weight:650;cursor:pointer;min-height:30px}button:hover{filter:brightness(1.12)}button:active{filter:brightness(.92)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--kondzio-accent);outline-offset:2px}button:disabled{background:var(--vscode-disabledForeground);color:var(--vscode-editor-background);cursor:not-allowed;filter:none}.primary{background:var(--kondzio-accent);color:#fff}.primary:hover{background:var(--kondzio-hover)}.primary:active{background:var(--kondzio-active)}.tertiary{background:transparent;border-color:var(--vscode-panel-border)}.wide{width:100%}.card{border:1px solid var(--vscode-panel-border);padding:7px;margin:6px 0;background:var(--vscode-sideBar-background)}.compact{padding:6px}.actions{margin:6px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.value{font-weight:650;overflow-wrap:anywhere}.progress{height:6px;background:var(--vscode-panel-border);margin:6px 0}.bar{height:100%;background:var(--kondzio-accent)}details{margin-top:7px;border-top:1px solid var(--vscode-panel-border);padding-top:6px}summary{font-weight:750;cursor:pointer;padding:3px 0}.health{display:grid;grid-template-columns:1fr auto;gap:4px}.OK,.success{color:var(--kondzio-accent)}.WARNING,.warning{color:var(--vscode-editorWarning-foreground)}.ERROR,.error{color:var(--vscode-errorForeground)}.status-chip{display:inline-block;border:1px solid currentColor;border-radius:999px;font-weight:750;padding:4px 7px;margin-top:6px}.history-item,.source{border-top:1px solid var(--vscode-panel-border);padding:6px 0}.history-item{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.path{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}.path label{grid-column:1/-1}.help{display:none;margin:5px 0}.help.open{display:block}.hidden{display:none!important}@media(max-width:300px){.row,.actions,.paths,.grid{grid-template-columns:1fr}}@media(min-width:420px){body{padding:10px}.paths{grid-template-columns:1fr 1fr}}
  </style></head><body>
  <div class="brand"><div class="logo">K·AI</div><div><strong>Kondzio AI</strong><div class="muted">Lokalny Orchestrator</div></div></div>
  <div class="field"><label for="prompt">Co mam zrobić?</label><textarea id="prompt" aria-label="Opis zadania" placeholder="Opisz zadanie dla Orchestratora..."></textarea></div>
  <div class="row"><div class="field"><div class="labelrow"><label for="autonomy">AUTONOMIA</label><button class="tertiary" data-command="autonomyHelp" aria-controls="autonomyHelp" aria-expanded="false">? CO TO ZNACZY?</button></div><select id="autonomy"><option value="1">AUTO 1</option><option value="2" selected>AUTO 2</option><option value="3">AUTO 3</option></select><div id="autonomyHelp" class="help muted"></div></div><div class="field"><div class="labelrow"><label for="mode">WYKONAWCA</label><button class="tertiary" data-command="modeHelp" aria-controls="modeHelp" aria-expanded="false">? JAK TO DZIAŁA?</button></div><select id="mode"><option value="auto">AUTO — ZALECANY</option><option value="local">LOCAL</option><option value="research">RESEARCH</option><option value="codex">CODEX</option></select><div id="modeHelp" class="help muted"></div></div></div>
  <div class="card compact"><strong>TRYB PRÓBNY</strong><label class="check"><input id="dry" type="checkbox"> Tworzy plan i analizę bez zmiany plików. <span class="muted">dry-run</span></label></div>
  <div class="card compact"><strong>OSZCZĘDZANIE CODEX</strong><label class="check"><input id="preferLocal" type="checkbox"> Preferuj LOCAL</label><label class="check"><input id="blockCodex" type="checkbox"> Nie eskaluj automatycznie do CODEX</label><span id="codexBadge" class="status-chip">CODEX: DOSTĘPNY</span></div>
  <div class="card compact"><strong>PLANOWANY WYKONAWCA</strong><div id="plannedExecutor" class="value">LOCAL<br>Qwen 2.5 Coder 7B</div></div>
  <button class="primary wide" data-command="run">▶ URUCHOM ZADANIE</button>
  <div class="actions"><button data-command="healthCheck">↻ SPRAWDŹ STAN NARZĘDZI</button><button data-command="checkForUpdates">↻ SPRAWDŹ AKTUALIZACJĘ</button><button class="tertiary" data-command="documentation">📖 DOKUMENTACJA</button><button class="tertiary" data-command="lastReport">RAPORT</button><button class="tertiary" data-command="history">HISTORIA</button><button class="tertiary" data-command="showResearch">RESEARCH</button></div>
  <div id="warning" class="warning" role="status" aria-live="polite"></div><div id="error" class="error" role="alert" aria-live="assertive"></div><div id="status" class="card" aria-live="polite"><strong>Brak aktywnego zadania</strong></div>
  <div id="approval" class="actions hidden"><button class="primary" data-command="approveCodex">URUCHOM PRZEZ CODEX</button><button data-command="finishTask">ZAKOŃCZ ZADANIE</button></div>
  <details open><summary>STAN NARZĘDZI</summary><div id="health" class="card health" aria-live="polite"></div><button data-command="healthCheck">↻ SPRAWDŹ STAN</button></details>
  <details open><summary>WERSJA</summary><div class="card"><strong>Kondzio AI ${escapeHtmlAttribute(installedVersion)}</strong><div id="versionStatus" class="status-chip" role="status" aria-live="polite">? NIE SPRAWDZONO</div></div><button id="openRelease" class="hidden" data-command="openRelease">OTWÓRZ WYDANIE</button></details>
  <details id="historyPanel"><summary>HISTORIA ZADAŃ</summary><div id="historyList">Brak wcześniejszych zadań.</div></details>
  <details id="researchPanel"><summary>RESEARCH <span class="muted">SearXNG + lokalny Qwen</span></summary><div class="field"><label for="query">Czego szukamy?</label><textarea id="query"></textarea></div><button data-command="research">🔎 SZUKAJ</button><div id="researchResult"></div></details>
  <details><summary>USTAWIENIA</summary><div class="paths">${Object.entries(settings).map(([key,value])=>`<div class="path"><label for="${key}">${({orchestratorPath:"Orchestrator",researchLabPath:"ResearchLab",sandboxPath:"Sandbox",projectsRoot:"Projekty"} as Record<string,string>)[key]}</label><input id="${key}" value="${escapeHtmlAttribute(value)}"><button data-command="choosePath" data-key="${key}">WYBIERZ</button></div>`).join("")}</div><div class="actions"><button data-command="saveSettings">ZAPISZ USTAWIENIA</button><button class="tertiary" data-command="restoreDefaults">PRZYWRÓĆ DOMYŚLNE</button></div><div id="settingsStatus" aria-live="polite"></div></details>
  </body></html>`;
  /* Removed in 0.3.1: the client is loaded from media/webview.js.
  function payloadFor(command,target){if(command==='run')return{type:command,prompt:$('prompt').value,autonomy:Number($('autonomy').value),mode:$('mode').value,dryRun:$('dry').checked,preferLocal:$('preferLocal').checked,blockCodexEscalation:$('blockCodex').checked};if(command==='research')return{type:command,query:$('query').value};if(command==='status')return{type:command,runId:target.dataset.runId||runId};if(command==='openRelease')return{type:command,url:releaseUrl};if(command==='choosePath')return{type:command,key:target.dataset.key};if(command==='saveSettings')return{type:command,value:JSON.stringify(Object.fromEntries(['orchestratorPath','researchLabPath','sandboxPath','projectsRoot'].map(k=>[k,$(k).value])))};if(['autonomyHelp','modeHelp','showResearch'].includes(command)){toggleLocal(command);return}return{type:command,runId}}
  function toggleLocal(command){if(command==='showResearch'){$('researchPanel').open=true;$('query').focus();return}const id=command==='autonomyHelp'?'autonomyHelp':'modeHelp',root=$(id),select=$(command==='autonomyHelp'?'autonomy':'mode');root.textContent=(command==='autonomyHelp'?autonomyDescriptions:modeDescriptions)[select.value];root.classList.toggle('open')}
  document.querySelectorAll('button').forEach(button=>{if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',button.textContent.trim())});
  ${webviewClientScript()}
  function esc(v){return String(v??'—')}function label(n,v){return'<div><span class="muted">'+n+'</span><div class="value">'+esc(v)+'</div></div>'}function updateInfo(){const mode=$('mode').value,prefer=$('preferLocal').checked,blocked=$('blockCodex').checked;$('plannedExecutor').innerHTML=mode==='research'?'RESEARCH<br>SearXNG + lokalny Qwen':mode==='codex'&&!prefer?'CODEX':'LOCAL<br>Qwen 2.5 Coder 7B';$('codexBadge').textContent=blocked?'CODEX: CHRONIONY':'CODEX: DOSTĘPNY'}document.addEventListener('change',updateInfo);updateInfo();
  function status(v){runId=v.run_id||runId;const active=v.run_id&&v.status!=='idle',eta=v.initial_eta||{},files=Array.isArray(v.files_changed)?v.files_changed:[];$('status').innerHTML=active?'<strong>'+esc(v.status)+'</strong><div class="progress"><div class="bar" style="width:'+esc(v.progress)+'%"></div></div><div class="grid">'+label('Run ID',v.run_id)+label('Etap',v.current_stage)+label('Agent',v.current_agent)+label('Testy',v.test_status)+label('Pliki',files.length)+label('ETA',eta.typical)+'</div>':'<strong>Brak aktywnego zadania</strong>';const approval=v.status==='awaiting_codex_approval'&&v.codex_required===true;$('approval').classList.toggle('hidden',!approval);if(approval)$('codexBadge').textContent='CODEX: WYMAGA ZGODY'}
  function history(items){$('historyPanel').open=true;const root=$('historyList');root.innerHTML='';if(!(items||[]).length){root.textContent='Brak wcześniejszych zadań.';return}(items||[]).slice(0,10).forEach(x=>{const d=document.createElement('button');d.className='history-item tertiary wide';d.dataset.command='status';d.dataset.runId=x.run_id;d.textContent=[x.status,x.agent,x.prompt].filter(Boolean).join(' · ');root.appendChild(d)})}
  function research(v){$('researchPanel').open=true;$('researchResult').textContent='Provider: '+esc(v.provider)+' | Źródła: '+esc(v.source_count)+'\n'+esc(v.analysis)}function health(v){const root=$('health');root.innerHTML='';(v.items||[]).forEach(x=>{const n=document.createElement('div');n.textContent=(x.status==='ERROR'?'✕ ':'✓ ')+x.name;const s=document.createElement('details');s.innerHTML='<summary class="'+x.status+'">'+x.status+'</summary><span class="muted">'+esc(x.version||x.detail)+'</span>';root.append(n,s)})}function checking(){health({items:['Orchestrator','MCP','SearXNG','Ollama','Qwen','Aider','Codex','Git','.NET'].map(name=>({name,status:'CHECKING'}))})}
  function update(v){const p=presentVersionStatus(v);releaseUrl=v.releaseUrl;$('versionStatus').className='status-chip '+p.tone;$('versionStatus').textContent=p.text;$('openRelease').classList.toggle('hidden',!p.showReleaseButton)}
  addEventListener('message',e=>{const m=e.data;if(m.type==='status')status(m.value);if(m.type==='history')history(m.value);if(m.type==='research')research(m.value);if(m.type==='health')health(m.value);if(m.type==='healthChecking')checking();if(m.type==='updateState')update(m.value);if(m.type==='warning')$('warning').textContent=m.value;if(m.type==='error')$('error').textContent=m.value;if(m.type==='busy')document.querySelector('[data-command="run"]').disabled=m.value;if(m.type==='pathSelected')$(m.key).value=m.value;if(m.type==='settings')Object.entries(m.value).forEach(([k,v])=>$(k).value=v);if(m.type==='settingsSaved')$('settingsStatus').textContent='Ustawienia zapisane.';if(m.type==='preset'){if(m.autonomy)$('autonomy').value=String(m.autonomy);if(m.section==='research'){$('researchPanel').open=true;$('query').focus()}else $('prompt').focus()}});checking();</script></body></html>`; */
  const safeScriptUri = escapeHtmlAttribute(scriptUri);
  return `${document.slice(0, -14)}<script nonce="${nonce}" src="${safeScriptUri}"></script></body></html>`;
}
