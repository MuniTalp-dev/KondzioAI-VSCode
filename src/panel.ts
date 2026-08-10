import * as vscode from "vscode";
import { ACTIVE_STATES, OrchestratorController, progressFor } from "./model";
import { Autonomy, ExecutorMode, StatusResult } from "./types";
import { UpdateService } from "./update";
import { AUTONOMY_DESCRIPTIONS, MODE_DESCRIPTIONS } from "./descriptions";

type PanelMessage = { command: string; prompt?: string; autonomy?: Autonomy; mode?: ExecutorMode; dryRun?: boolean; query?: string; runId?: string };

export class KondzioViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "kondzioAi.main";
  private view?: vscode.WebviewView;
  private poll?: NodeJS.Timeout;
  private currentRunId?: string;

  constructor(private readonly controller: OrchestratorController,
              private readonly onStatus: (status?: StatusResult) => void,
              private readonly openMarkdown: (title: string, markdown: string) => Promise<void>,
              private readonly updates: UpdateService,
              private readonly confirmUpdate: (url: string) => Promise<void>) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = html();
    view.webview.onDidReceiveMessage(message => void this.handle(message as PanelMessage));
    void this.refreshStatus();
    void this.checkHealth();
    if (this.updates.shouldAutoCheck()) { void this.checkUpdate(false); }
  }

  reveal(): Thenable<unknown> { return vscode.commands.executeCommand("workbench.view.extension.kondzioAi"); }
  preset(autonomy?: Autonomy, section = "task"): void { this.post({ type: "preset", autonomy, section }); }

  async run(prompt: string, autonomy: Autonomy, mode: ExecutorMode, dryRun: boolean): Promise<void> {
    if (!prompt.trim()) { throw new Error("Pole „Co mam zrobić?” nie może być puste."); }
    this.post({ type: "busy", value: true });
    const preflight = await this.controller.preflight(mode);
    this.post({ type: "health", value: preflight.health });
    if (preflight.warnings.length) { this.post({ type: "warning", value: preflight.warnings.join("\n") }); }
    const status = await this.controller.run(prompt.trim(), autonomy, mode, dryRun);
    this.currentRunId = status.run_id;
    this.publishStatus(status);
    if (ACTIVE_STATES.has(status.status)) { this.startPolling(); }
  }

  async refreshStatus(runId = this.currentRunId): Promise<void> {
    try { this.publishStatus(await this.controller.status(runId)); }
    catch (error) { this.error(error); }
  }

  async showHistory(): Promise<void> {
    try { this.post({ type: "history", value: (await this.controller.history()).runs }); }
    catch (error) { this.error(error); }
  }

  async showLastReport(): Promise<void> {
    try { const result = await this.controller.lastReport(); await this.openMarkdown(`Kondzio AI — ${result.run_id ?? "raport"}`, result.report); }
    catch (error) { this.error(error); }
  }

  private async handle(message: PanelMessage): Promise<void> {
    try {
      switch (message.command) {
        case "run": await this.run(message.prompt ?? "", message.autonomy ?? 2, message.mode ?? "auto", Boolean(message.dryRun)); break;
        case "cancel": this.publishStatus(await this.controller.cancel(message.runId ?? this.currentRunId) as unknown as StatusResult); this.stopPolling(); break;
        case "status": await this.refreshStatus(message.runId); break;
        case "history": await this.showHistory(); break;
        case "report": await this.showLastReport(); break;
        case "research": this.post({ type: "research", value: await this.controller.research(message.query?.trim() ?? "") }); break;
        case "health": await this.checkHealth(); break;
        case "updateCheck": await this.checkUpdate(true); break;
        case "updateNow": if (message.query) { await this.confirmUpdate(message.query); } break;
        case "updateLater": this.post({ type: "updateDismissed" }); break;
      }
    } catch (error) { this.error(error); }
    finally { this.post({ type: "busy", value: false }); }
  }

  private publishStatus(status: StatusResult): void {
    if (status.run_id) { this.currentRunId = status.run_id; }
    this.post({ type: "status", value: { ...status, progress: progressFor(status.current_stage ?? status.status) } });
    this.onStatus(status);
    if (!ACTIVE_STATES.has(status.status)) { this.stopPolling(); }
  }
  async checkHealth(): Promise<void> {
    this.post({ type: "healthChecking" });
    this.post({ type: "health", value: await this.controller.health() });
  }
  async checkUpdate(manual: boolean): Promise<void> { this.post({ type: "update", value: await this.updates.check(manual) }); }
  private startPolling(): void { this.stopPolling(); this.poll = setInterval(() => void this.refreshStatus(), 2000); }
  private stopPolling(): void { if (this.poll) { clearInterval(this.poll); this.poll = undefined; } }
  private error(error: unknown): void { this.post({ type: "error", value: error instanceof Error ? error.message : String(error) }); this.onStatus({ status: "failed_executor", run_id: this.currentRunId ?? "" }); }
  private post(value: unknown): void { void this.view?.webview.postMessage(value); }
  dispose(): void { this.stopPolling(); }
}

function html(): string {
  const nonce = Math.random().toString(36).slice(2);
  return `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
  :root{color-scheme:light dark}body{font:13px var(--vscode-font-family);color:var(--vscode-foreground);padding:12px;margin:0}.brand{display:flex;gap:9px;align-items:center;margin-bottom:14px}.logo{font-size:22px;font-weight:800}.muted{color:var(--vscode-descriptionForeground)}textarea,input,select{box-sizing:border-box;width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:8px}textarea{min-height:105px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{margin:9px 0}.field label{display:block;margin-bottom:5px;font-weight:600}.labelrow{display:flex;align-items:center;justify-content:space-between}.info{border:1px solid var(--vscode-panel-border);border-radius:50%;padding:0;width:20px;height:20px}.check{display:flex;align-items:center;gap:7px}.check input{width:auto}button{border:0;padding:8px 10px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);cursor:pointer}button.primary{width:100%;font-weight:700;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}button:hover{filter:brightness(1.1)}button:disabled{opacity:.55}.actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 14px}.card{border:1px solid var(--vscode-panel-border);padding:10px;margin:9px 0;background:var(--vscode-sideBar-background)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.value{font-weight:650;word-break:break-word}.progress{height:7px;background:var(--vscode-progressBar-background);opacity:.35;margin:10px 0}.bar{height:100%;background:var(--vscode-progressBar-background);opacity:1;width:0}.health{display:grid;grid-template-columns:1fr auto;gap:5px}.OK{color:var(--vscode-testing-iconPassed)}.WARNING{color:var(--vscode-editorWarning-foreground)}.ERROR{color:var(--vscode-errorForeground)}.CHECKING{color:var(--vscode-descriptionForeground)}details{margin-top:10px}pre{white-space:pre-wrap;word-break:break-word;font-size:11px}.history-item,.source{border-top:1px solid var(--vscode-panel-border);padding:7px 0;cursor:pointer}.error{color:var(--vscode-errorForeground);padding:8px 0}.warning{color:var(--vscode-editorWarning-foreground);white-space:pre-wrap}.section-title{font-weight:700;margin-top:14px}
  </style></head><body>
  <div class="brand"><div class="logo">K·AI</div><div><strong>Kondzio AI</strong><div class="muted">Lokalny Orchestrator</div></div></div>
  <div class="field"><label for="prompt">Co mam zrobić?</label><textarea id="prompt" placeholder="Opisz zadanie dla Orchestratora..."></textarea></div>
  <div class="row"><div class="field"><div class="labelrow"><label>AUTONOMIA</label><button id="autonomyInfo" class="info" aria-label="Opis wybranego poziomu autonomii" title="Opis wybranego poziomu autonomii">i</button></div><select id="autonomy"><option value="1">AUTO 1</option><option value="2" selected>AUTO 2</option><option value="3">AUTO 3</option></select></div><div class="field"><div class="labelrow"><label>WYKONAWCA</label><button id="modeInfo" class="info" aria-label="Opis wybranego wykonawcy" title="Opis wybranego wykonawcy">i</button></div><select id="mode"><option value="auto">AUTO (zalecany)</option><option value="local">LOCAL</option><option value="research">RESEARCH</option><option value="codex">CODEX</option></select></div></div>
  <label class="check"><input id="dry" type="checkbox"> Dry-run</label><div class="field"><button id="run" class="primary">URUCHOM</button></div>
  <div class="actions"><button id="cancel">ANULUJ</button><button id="report">OSTATNI RAPORT</button><button id="history">HISTORIA</button><button id="showResearch">RESEARCH</button></div>
  <div id="info" class="muted"></div><div id="warning" class="warning"></div><div id="error" class="error"></div><div id="status" class="card"><strong>Brak aktywnego runu</strong></div>
  <details open><summary>ŚRODOWISKO</summary><div id="health" class="card health"></div><button id="healthAgain">SPRAWDŹ PONOWNIE</button></details>
  <details open><summary>WERSJA</summary><div id="update" class="card">Kondzio AI — sprawdzanie wersji…</div><div class="actions"><button id="updateCheck">SPRAWDŹ AKTUALIZACJE</button><button id="updateNow" disabled>AKTUALIZUJ</button><button id="updateLater">PÓŹNIEJ</button></div></details>
  <details id="historyPanel"><summary>Ostatnie runy</summary><div id="historyList"></div></details>
  <details id="researchPanel"><summary>Research</summary><div class="field"><label>Czego szukamy?</label><textarea id="query"></textarea></div><button id="search" class="primary">SZUKAJ</button><div id="researchResult"></div></details>
  <script nonce="${nonce}">
  const vscode=acquireVsCodeApi(),$=id=>document.getElementById(id);let runId,releaseUrl;
  const autonomyDescriptions=${JSON.stringify(AUTONOMY_DESCRIPTIONS)};
  const modeDescriptions=${JSON.stringify(MODE_DESCRIPTIONS)};
  function updateInfo(){const a=autonomyDescriptions[$('autonomy').value],m=modeDescriptions[$('mode').value];$('autonomyInfo').title=a;$('autonomyInfo').setAttribute('aria-label',a);$('modeInfo').title=m;$('modeInfo').setAttribute('aria-label',m)}
  const send=command=>vscode.postMessage({command,runId});
  $('run').onclick=()=>vscode.postMessage({command:'run',prompt:$('prompt').value,autonomy:Number($('autonomy').value),mode:$('mode').value,dryRun:$('dry').checked});
  $('cancel').onclick=()=>send('cancel');$('report').onclick=()=>send('report');$('history').onclick=()=>send('history');
  $('showResearch').onclick=()=>{$('researchPanel').open=true;$('query').focus()};$('search').onclick=()=>vscode.postMessage({command:'research',query:$('query').value});
  $('autonomy').onchange=updateInfo;$('mode').onchange=updateInfo;$('autonomyInfo').onclick=()=>{$('info').textContent=autonomyDescriptions[$('autonomy').value]};$('modeInfo').onclick=()=>{$('info').textContent=modeDescriptions[$('mode').value]};updateInfo();
  $('healthAgain').onclick=()=>send('health');$('updateCheck').onclick=()=>send('updateCheck');$('updateNow').onclick=()=>releaseUrl&&vscode.postMessage({command:'updateNow',query:releaseUrl});$('updateLater').onclick=()=>send('updateLater');
  const esc=v=>String(v??'—');const label=(n,v)=>'<div><span class="muted">'+n+'</span><div class="value">'+esc(v)+'</div></div>';
  function status(v){runId=v.run_id||runId;const eta=v.initial_eta||{},files=Array.isArray(v.files_changed)?v.files_changed:[];$('status').innerHTML='<strong>'+esc(v.status)+'</strong><div class="progress"><div class="bar" style="width:'+esc(v.progress)+'%"></div></div><div class="grid">'+label('Run ID',v.run_id)+label('Etap',v.current_stage)+label('Agent',v.current_agent||v.agent)+label('Próba',v.current_attempt)+label('Research',v.research_status)+label('Testy',v.test_status)+label('Validation',v.validation_status)+label('Files changed',files.length)+label('Commit',v.commit_status)+label('Push',v.push_status)+label('MIN',eta.minimum)+' '+label('TYPICAL',eta.typical)+label('MAX',eta.maximum)+label('Elapsed',Math.round(v.elapsed_seconds||0)+' s')+label('Remaining',Math.round((v.remaining_eta||{}).seconds||0)+' s')+'</div><details><summary>Plan, ryzyka i kryteria</summary><pre>'+esc(JSON.stringify({plan:v.plan,risks:v.risks,acceptance_criteria:v.acceptance_criteria},null,2))+'</pre></details>'}
  function runDate(x){if(x.started_at)return new Date(x.started_at).toLocaleString('pl-PL');const m=String(x.run_id||'').match(/^(\\d{4})(\\d{2})(\\d{2})_(\\d{2})(\\d{2})(\\d{2})/);return m?m[3]+'.'+m[2]+'.'+m[1]+' '+m[4]+':'+m[5]+':'+m[6]:'—'}
  function history(items){$('historyPanel').open=true;$('historyList').innerHTML='';(items||[]).slice(0,10).forEach(x=>{const d=document.createElement('div');d.className='history-item';d.textContent=[x.status,x.agent,'AUTO '+x.autonomy,x.actual_minutes+' min',runDate(x),x.prompt,x.run_id].filter(Boolean).join(' · ');d.onclick=()=>vscode.postMessage({command:'status',runId:x.run_id});$('historyList').appendChild(d)})}
  function research(v){$('researchPanel').open=true;const root=$('researchResult');root.innerHTML='';const h=document.createElement('pre');h.textContent='Provider: '+esc(v.provider)+'\nŹródła: '+esc(v.source_count)+'\n\nAnaliza Qwen / rekomendacja / ryzyka:\n'+esc(v.analysis);root.appendChild(h);(v.sources||[]).slice(0,10).forEach(s=>{const d=document.createElement('div');d.className='source';d.textContent=esc(s.score)+' · '+esc(s.title)+'\n'+esc(s.url);root.appendChild(d)})}
  function health(v){const root=$('health');root.innerHTML='';(v.items||[]).forEach(x=>{const name=document.createElement('div');name.textContent=x.name+(x.version?' · '+x.version:'');name.title=x.detail||'';const state=document.createElement('strong');state.className=x.status;state.textContent=x.status;state.title=x.detail||'';root.append(name,state)})}
  function checking(){const names=['Orchestrator','MCP','SearXNG','Ollama','Qwen','Aider','Codex CLI','Git','.NET SDK'];health({items:names.map(name=>({name,status:'CHECKING'}))})}
  function update(v){releaseUrl=v.releaseUrl;$('updateNow').disabled=v.status!=='available';$('update').textContent=v.status==='available'?'Kondzio AI v'+v.currentVersion+' · Dostępna aktualizacja v'+v.latestVersion:v.status==='current'?'Kondzio AI v'+v.currentVersion+' · Aktualne':'Kondzio AI v'+v.currentVersion+' · '+(v.detail||v.status)}
  addEventListener('message',e=>{const m=e.data;if(m.type==='status')status(m.value);if(m.type==='history')history(m.value);if(m.type==='research')research(m.value);if(m.type==='health')health(m.value);if(m.type==='healthChecking')checking();if(m.type==='update')update(m.value);if(m.type==='updateDismissed')$('update').textContent+=' · odłożono';if(m.type==='warning')$('warning').textContent=m.value;if(m.type==='error')$('error').textContent=m.value;if(m.type==='busy')$('run').disabled=m.value;if(m.type==='preset'){if(m.autonomy)$('autonomy').value=String(m.autonomy);if(m.section==='research'){$('researchPanel').open=true;$('query').focus()}else $('prompt').focus();updateInfo()}});checking();
  </script></body></html>`;
}
