import * as vscode from "vscode";
import { ACTIVE_STATES, OrchestratorController, progressFor } from "./model";
import { Autonomy, ExecutorMode, StatusResult, UpdateResult } from "./types";
import { InstallResult, InstallStage } from "./updateInstaller";
import { UpdateService } from "./update";
import { AUTONOMY_DESCRIPTIONS, MODE_DESCRIPTIONS } from "./descriptions";
import { runUpdateCheck } from "./updateFlow";
import { versionStatusPresentation } from "./versionStatus";
import { webviewClientScript } from "./webviewBus";
import { ReleaseService } from "./releaseService";
import { randomUUID } from "node:crypto";
import { UsageService } from "./usage";
import { ProjectState, resolveProjectState } from "./projectState";
import { renderPanelHtml } from "./panelHtml";

type PanelMessage = { type?: string; prompt?: string; autonomy?: Autonomy; mode?: ExecutorMode; dryRun?: boolean; preferLocal?: boolean; blockCodexEscalation?: boolean; projectName?: string; projectRoot?: string; repoRoot?: string; query?: string; runId?: string; url?: string; key?: string; value?: string | boolean };
const pathDefaults: Record<string, string> = {
  orchestratorPath: "E:\\AI\\Orchestrator", researchLabPath: "E:\\AI\\ResearchLab",
  sandboxPath: "E:\\AI\\Repos", projectsRoot: "C:\\Projekty\\VCode",
  activeProjectRoot: "",
};
const escapeHtmlAttribute = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;").replace(/\n/g, "&#10;");

export class KondzioViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "kondzioAi.main";
  private view?: vscode.WebviewView;
  private poll?: NodeJS.Timeout;
  private currentRunId?: string;
  private lastRequest?: { prompt: string; autonomy: Autonomy; mode: ExecutorMode; dryRun: boolean; preferLocal: boolean; blockCodexEscalation: boolean };
  private messageSubscription?: vscode.Disposable;
  private availableUpdate?: UpdateResult;
  private releaseConfirmationToken?: string;
  private activeProject?: ProjectState;

  constructor(private readonly controller: OrchestratorController, private readonly onStatus: (status?: StatusResult) => void,
    private readonly openMarkdown: (title: string, markdown: string) => Promise<void>, private readonly updates: UpdateService,
    private readonly confirmUpdate: (url: string) => Promise<void>, private readonly log: (message: string) => void = () => {},
    private readonly extensionUri: vscode.Uri = vscode.Uri.file(__dirname),
    private readonly install: (release: UpdateResult, progress: (stage: InstallStage) => void) => Promise<InstallResult> = async () => { throw new Error("Instalator aktualizacji jest niedostępny."); },
    private readonly reloadWindow: () => Promise<void> = async () => {}, private readonly releases?: ReleaseService, private readonly usage?: UsageService) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")] };
    const scriptUri = view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.js"));
    const settings = this.settings();
    this.activeProject = resolveProjectState(settings.activeProjectRoot);
    view.webview.html = html(this.updates.installedVersion, settings, scriptUri.toString(), view.webview.cspSource, this.activeProject, this.updates.lastCheckedAt);
    this.messageSubscription?.dispose();
    this.messageSubscription = view.webview.onDidReceiveMessage(message => void this.handle(message as PanelMessage));
    this.log(`WebView panel created; active project: ${this.activeProject?.projectName ?? "NIE WYBRANO"}`);
    void this.refreshStatus(); void this.checkHealth(); void this.refreshUsage();
    if (vscode.workspace.getConfiguration("kondzioAi").get<boolean>("autoCheckUpdates", true) && this.updates.shouldAutoCheck()) { void this.checkUpdate(false); }
  }

  reveal(): Thenable<unknown> { return vscode.commands.executeCommand("workbench.view.extension.kondzioAi"); }
  preset(autonomy?: Autonomy, section = "task"): void { this.post({ type: "preset", autonomy, section }); }
  async reloadPanel(): Promise<void> { await this.reveal(); if (this.view) { this.resolveWebviewView(this.view); } }
  async resetWebviewState(): Promise<void> { this.currentRunId = undefined; this.lastRequest = undefined; this.stopPolling(); await this.reloadPanel(); }

  async run(prompt: string, autonomy: Autonomy, mode: ExecutorMode, dryRun: boolean, preferLocal = false, blockCodexEscalation = false, codexApproved = false): Promise<void> {
    if (!prompt.trim()) { throw new Error("Pole „Co mam zrobić?” nie może być puste."); }
    const project = this.activeProject;
    if (!project) { throw new Error("Wybierz poprawny aktywny projekt przed uruchomieniem zadania."); }
    this.post({ type: "busy", value: true });
    const preflight = await this.controller.preflight(mode); this.post({ type: "health", value: preflight.health });
    if (preflight.warnings.length) { this.post({ type: "warning", value: preflight.warnings.join("\n") }); }
    this.lastRequest = { prompt: prompt.trim(), autonomy, mode, dryRun, preferLocal, blockCodexEscalation };
    const paths = this.settings();
    this.log(`Run request:\nprojectName=${project.projectName}\nprojectRoot=${project.projectRoot}\nrepoRoot=${project.repoRoot}\nexecutor=${mode}\nautonomy=${autonomy}\ndryRun=${dryRun}`);
    const status = await this.controller.run(prompt.trim(), autonomy, mode, dryRun, preferLocal, blockCodexEscalation,
      codexApproved, paths.sandboxPath, paths.projectsRoot, project.projectRoot, project.projectName, project.repoRoot);
    this.currentRunId = status.run_id; this.publishStatus(status); if (ACTIVE_STATES.has(status.status)) { this.startPolling(); }
  }
  async refreshStatus(runId = this.currentRunId): Promise<void> { try { this.publishStatus(await this.controller.status(runId)); } catch (error) { this.error(error); } }
  async showHistory(): Promise<void> { try { this.post({ type: "history", value: (await this.controller.history()).runs }); } catch (error) { this.error(error); } }
  async showLastReport(): Promise<void> { try { const result = await this.controller.lastReport(); await this.openMarkdown(`Kondzio AI — ${result.run_id ?? "raport"}`, result.report); } catch (error) { this.error(error); } }

  private async handle(message: PanelMessage): Promise<void> {
    this.log(message.type === "run" ? "WebView message received: run" : `WebView message received: ${JSON.stringify(message)}`);
    try {
      switch (message.type) {
        case "clientReady": this.log("WebView client ready"); this.post({ type: "projectState", value: this.activeProject }); this.post({ type: "autoUpdatesState", value: vscode.workspace.getConfiguration("kondzioAi").get<boolean>("autoCheckUpdates", true) }); break;
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
        case "refreshUsage": await this.refreshUsage(true); break;
        case "checkForUpdates": await this.checkUpdate(true); break;
        case "installUpdate": await this.installAvailableUpdate(); break;
        case "reloadWindow": await this.reloadWindow(); break;
        case "openRelease": if (message.url) { await this.confirmUpdate(message.url); } break;
        case "documentation": await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(vscode.Uri.joinPath(vscode.Uri.file(__dirname), "..", "..", "docs", "README.md").fsPath)); break;
        case "showLicense": await vscode.commands.executeCommand("vscode.open", vscode.Uri.joinPath(this.extensionUri, "LICENSE")); break;
        case "showLocalChangelog": await vscode.commands.executeCommand("vscode.open", vscode.Uri.joinPath(this.extensionUri, "CHANGELOG.md")); break;
        case "openGitHub": await vscode.env.openExternal(vscode.Uri.parse("https://github.com/MuniTalp-dev/KondzioAI-VSCode")); break;
        case "reportIssue": await vscode.env.openExternal(vscode.Uri.parse("https://github.com/MuniTalp-dev/KondzioAI-VSCode/issues")); break;
        case "openKondzio": await vscode.env.openExternal(vscode.Uri.parse("https://kondzio.pl")); break;
        case "choosePath": await this.choosePath(message.key); break;
        case "openProjectFolder": if (this.activeProject) { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(this.activeProject.projectRoot)); } break;
        case "refreshProject": this.activeProject = resolveProjectState(this.settings().activeProjectRoot); this.post({ type: "projectState", value: this.activeProject }); break;
        case "toggleAutoUpdates": await vscode.workspace.getConfiguration("kondzioAi").update("autoCheckUpdates", Boolean(message.value), vscode.ConfigurationTarget.Global); break;
        case "saveSettings": await this.saveSettings(message); break;
        case "restoreDefaults": await this.restoreDefaults(); break;
        case "releaseReadiness": if (this.releases) { this.post({ type: "releaseResult", value: await this.releases.inspect(true) }); } break;
        case "releaseDryRun": if (this.releases) { this.post({ type: "releaseResult", value: await this.releases.dryRun() }); } break;
        case "prepareFullRelease": if (this.releases) { this.releaseConfirmationToken = randomUUID(); this.post({ type: "releaseConfirm", value: { ...(await this.releases.inspect(false)), confirmationToken: this.releaseConfirmationToken } }); } break;
        case "confirmFullRelease": if (this.releases) { if (!this.releaseConfirmationToken || message.value !== this.releaseConfirmationToken) throw new Error("Brak ważnego potwierdzenia wydania."); this.releaseConfirmationToken = undefined; this.post({ type: "releaseResult", value: await this.releases.fullRelease((state, line) => this.post({ type: "releaseLog", value: { state, line } })) }); } break;
      }
    } catch (error) {
      if (message.type?.includes("Release") || message.type?.startsWith("release")) {
        const detail = error instanceof Error ? error.message : String(error);
        this.post({ type: "releaseLog", value: { state: "FAILED", stage: "release-readiness", line: detail } });
        this.log(`release-readiness error: ${detail}`); this.post({ type: "error", value: `[release-readiness] ${detail}` });
      } else { this.error(error); }
    } finally { this.post({ type: "busy", value: false }); }
  }

  private settings(): Record<string, string> {
    const c = vscode.workspace.getConfiguration("kondzioAi");
    const values = Object.fromEntries(Object.entries(pathDefaults).map(([key, value]) => [key, c.get<string>(key, value)]));
    const explicitlySaved = c.inspect<string>("activeProjectRoot")?.workspaceFolderValue ?? c.inspect<string>("activeProjectRoot")?.workspaceValue ?? c.inspect<string>("activeProjectRoot")?.globalValue;
    const folders = vscode.workspace.workspaceFolders ?? [];
    values.activeProjectRoot = explicitlySaved || (folders.length === 1 ? folders[0].uri.fsPath : "");
    values.autoCheckUpdates = String(c.get<boolean>("autoCheckUpdates", true));
    return values;
  }
  private async choosePath(key?: string): Promise<void> { if (!key || !(key in pathDefaults)) { return; } const picked = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false }); if (picked?.[0]) { this.post({ type: "pathSelected", key, value: picked[0].fsPath }); } }
  private async saveSettings(message: PanelMessage): Promise<void> { const values = typeof message.value === "string" ? JSON.parse(message.value) as Record<string, string> : {}; const c = vscode.workspace.getConfiguration("kondzioAi"); for (const key of Object.keys(pathDefaults)) { await c.update(key, values[key] ?? pathDefaults[key], vscode.ConfigurationTarget.Global); } this.activeProject = resolveProjectState(this.settings().activeProjectRoot); this.post({ type: "projectState", value: this.activeProject }); this.post({ type: "settingsSaved" }); }
  private async restoreDefaults(): Promise<void> { const c = vscode.workspace.getConfiguration("kondzioAi"); for (const [key, value] of Object.entries(pathDefaults)) { await c.update(key, value, vscode.ConfigurationTarget.Global); } this.post({ type: "settings", value: pathDefaults }); }
  private publishStatus(status: StatusResult): void { if (status.run_id) { this.currentRunId = status.run_id; } this.post({ type: "status", value: { ...status, progress: progressFor(status.current_stage ?? status.status) } }); this.onStatus(status); if (!ACTIVE_STATES.has(status.status)) { this.stopPolling(); if (status.status === "completed") { void this.refreshUsage(true); } } }
  async checkHealth(): Promise<void> { this.post({ type: "healthChecking" }); this.post({ type: "health", value: await this.controller.health() }); await this.refreshUsage(true); }
  async refreshUsage(force = false): Promise<void> { if (this.usage) { this.post({ type: "usage", value: await this.usage.getAll(force) }); } }
  async checkUpdate(manual: boolean): Promise<void> { await runUpdateCheck(() => this.updates.check(manual), result => { if (result.status === "updateAvailable") { this.availableUpdate = result; } this.post({ type: "updateState", value: result }); }, this.updates.installedVersion); }
  private async installAvailableUpdate(): Promise<void> {
    if (!this.availableUpdate) { throw new Error("Najpierw sprawdź dostępność aktualizacji."); }
    try { const result = await this.install(this.availableUpdate, stage => this.post({ type: "installState", value: stage })); this.post({ type: "installSuccess", value: `Zainstalowano v${result.version}` }); }
    catch (error) { this.post({ type: "installSecurityError", value: { message: error instanceof Error ? error.message : String(error), releaseUrl: this.availableUpdate.releaseUrl } }); throw error; }
  }
  private startPolling(): void { this.stopPolling(); this.poll = setInterval(() => void this.refreshStatus(), 2000); }
  private stopPolling(): void { if (this.poll) { clearInterval(this.poll); this.poll = undefined; } }
  private error(error: unknown): void { const detail = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error); this.log(`Error: ${detail}`); this.post({ type: "error", value: error instanceof Error ? error.message : String(error) }); this.onStatus({ status: "failed_executor", run_id: this.currentRunId ?? "" }); }
  private post(value: unknown): void { void this.view?.webview.postMessage(value); }
  dispose(): void { this.stopPolling(); this.messageSubscription?.dispose(); this.view = undefined; }
}

export function legacyHtml(installedVersion = "", settings: Record<string, string> = pathDefaults, scriptUri = "media/webview.js", cspSource = "'self'", project?: ProjectState): string {
  const nonce = Math.random().toString(36).slice(2);
  const document = `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src ${cspSource} 'nonce-${nonce}';"><style nonce="${nonce}">
  :root{color-scheme:light dark;--kondzio-accent:#61993b;--kondzio-hover:#70a94a;--kondzio-active:#527f33}*{box-sizing:border-box}body{font:12px var(--vscode-font-family);color:var(--vscode-foreground);padding:7px;margin:0;overflow-x:hidden}.brand,.line,.labelrow,.switch-row{display:flex;align-items:center;gap:7px}.brand{margin-bottom:6px;white-space:nowrap}.brand .muted{display:inline}.logo{font-size:17px;font-weight:800}.muted{color:var(--vscode-descriptionForeground);font-size:11px}textarea,input,select{width:100%;min-width:0;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:5px}textarea{min-height:52px;resize:vertical}.row,.actions,.paths{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.row{border:1px solid var(--vscode-panel-border);border-radius:7px;overflow:visible}.row>.field,.row+.card,.row+.card+.card{min-height:67px;margin:0;padding:7px}.field{margin:5px 0}.field label,.section-title{display:block;font-weight:700;margin-bottom:3px}.labelrow{justify-content:space-between}.check{display:flex;align-items:center;gap:6px;margin:4px 0}.check input{width:auto}button{border:1px solid var(--vscode-button-border,transparent);border-radius:4px;padding:5px 7px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);font-weight:650;cursor:pointer;min-height:27px}button:hover{filter:brightness(1.12)}button:active{filter:brightness(.92)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[role=tab]:focus-visible{outline:2px solid var(--kondzio-accent);outline-offset:2px}.primary{background:var(--kondzio-accent);color:#fff}.primary:hover{background:var(--kondzio-hover)}.primary:active{background:var(--kondzio-active)}.tertiary{background:transparent;border-color:var(--vscode-panel-border)}.wide{width:100%}.card{border:1px solid var(--vscode-panel-border);border-radius:5px;padding:7px;margin:5px 0;background:var(--vscode-sideBar-background)}.compact{padding:6px}.actions{margin:5px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.value{font-weight:650;overflow-wrap:anywhere}.progress{height:5px;background:var(--vscode-panel-border);margin:5px 0}.bar{height:100%;background:var(--kondzio-accent)}details{margin-top:6px;border-top:1px solid var(--vscode-panel-border);padding-top:5px}summary{font-weight:750;cursor:pointer;padding:3px 0}.health{display:grid;grid-template-columns:1fr auto;gap:4px}.OK,.success{color:var(--kondzio-accent)}.WARNING,.warning{color:var(--vscode-editorWarning-foreground)}.ERROR,.error{color:var(--vscode-errorForeground)}.status-chip{display:inline-block;border:1px solid currentColor;border-radius:999px;font-weight:750;padding:2px 6px}.history-item{width:100%;text-align:left;margin:2px 0}.path{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}.path label{grid-column:1/-1}.help{display:none;margin:5px 0}.help.open{display:block}.hidden{display:none!important}.switch{width:40px!important;height:22px;min-height:22px;border-radius:999px;padding:0;position:relative}.switch[aria-checked=true]{background:var(--kondzio-accent)}.switch:after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:white;left:3px;top:2px;transition:transform .14s}.switch[aria-checked=true]:after{transform:translateX(17px)}.tabs{display:flex;overflow-x:auto;margin-top:6px;border-bottom:1px solid var(--vscode-panel-border)}[role=tab]{flex:1;min-width:max-content;border:0;border-radius:0;background:transparent;font-size:10px;padding:6px 4px}[role=tab][aria-selected=true]{color:var(--kondzio-accent);border-bottom:2px solid var(--kondzio-accent)}[role=tabpanel]{padding-top:6px}.modal{position:fixed;inset:0;z-index:10;background:#0008;display:grid;place-items:center;padding:10px}.modal-card{max-height:80vh;overflow:auto;background:var(--vscode-editorWidget-background);padding:10px;border-radius:7px}pre{white-space:pre-wrap}@media(max-width:300px){.row,.actions,.paths,.grid{grid-template-columns:1fr}}@media(min-width:320px){.row{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .health{display:flex;flex-direction:column;gap:3px}.tool-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}.tool-name{min-width:0;overflow-wrap:anywhere}.tool-status{display:inline-flex;align-items:center;flex:0 0 auto;gap:4px;margin:0;line-height:1}
  .usage-lines{display:grid;gap:3px;margin:4px 0 6px}.usage-line{display:grid;grid-template-columns:52px minmax(35px,1fr) auto auto;align-items:center;gap:6px;text-align:left;padding:3px 5px}.mini-progress{height:4px;background:var(--vscode-panel-border)}.mini-progress i{display:block;height:100%;width:0;background:var(--kondzio-accent)}.work-log{margin:5px 0}.work-log div{display:grid;gap:2px;padding:4px 0}@media(max-width:300px){.usage-line{grid-template-columns:48px 1fr}.usage-line>span:nth-last-child(-n+2){grid-column:2}}
  </style></head><body>
  <div class="brand" aria-description="Lokalny Orchestrator"><div class="logo">K·AI</div><strong>Kondzio AI</strong><span class="muted">v${escapeHtmlAttribute(installedVersion)}</span><span id="versionStatus" class="status-chip" role="status" aria-live="polite" title="Nie sprawdzono aktualności">?</span><span id="updateActions" class="hidden"><button data-command="showChangelog">CHANGELOG</button> <button class="primary" data-command="installUpdate">AKTUALIZUJ</button></span></div><div id="installStatus" class="muted" role="status" aria-live="polite"></div><button id="reloadWindow" class="primary wide hidden" data-command="reloadWindow">PRZEŁADUJ VS CODE</button>
  <div class="field"><label for="prompt">Co mam zrobić?</label><textarea id="prompt" aria-label="Opis zadania" placeholder="Opisz zadanie dla Orchestratora..."></textarea></div>
  <div id="usageLines" class="usage-lines" aria-live="polite"><button class="usage-line" data-provider="CODEX">CODEX <span class="mini-progress"><i></i></span><span>Zużycie: —</span><span>Reset: —</span></button><button class="usage-line" data-provider="CLAUDE">CLAUDE <span class="mini-progress"><i></i></span><span>Zużycie: —</span><span>Reset: —</span></button></div>
  <div class="row"><div class="field"><div class="labelrow"><label for="autonomy">AUTONOMIA</label><button data-command="autonomyHelp" aria-controls="autonomyHelp" aria-expanded="false" aria-label="Opis autonomii">?</button></div><select id="autonomy"><option value="1">AUTO 1</option><option value="2" selected>AUTO 2</option><option value="3">AUTO 3</option></select><div id="autonomyHelp" class="help muted"></div></div><div class="field"><div class="labelrow"><label for="mode">WYKONAWCA</label><button data-command="modeHelp" aria-controls="modeHelp" aria-expanded="false" aria-label="Opis wykonawców">?</button></div><select id="mode"><option value="auto">AUTO — zalecany</option><option value="local">LOCAL</option><option value="research">RESEARCH</option><option value="codex">CODEX</option><option value="claude">CLAUDE</option></select><div id="modeHelp" class="help muted"></div></div><div class="field"><div class="labelrow"><strong>TRYB PRÓBNY</strong><button data-command="dryHelp" aria-controls="dryHelp" aria-expanded="false" aria-label="Opis trybu próbnego">?</button></div><div class="switch-row"><span id="dryState">OFF</span><button id="dry" class="switch" role="switch" aria-checked="false" aria-label="Tryb próbny"></button></div><div id="dryHelp" class="help muted">Tworzy plan, ETA, ryzyka i analizę bez zmieniania plików.</div></div><div class="field"><div class="labelrow"><strong>OSZCZĘDZAJ AI</strong><button data-command="codexHelp" aria-controls="codexHelp" aria-expanded="false" aria-label="Opis oszczędzania AI">?</button></div><div class="switch-row"><span id="codexState">OFF</span><button id="saveCodex" class="switch" role="switch" aria-checked="false" aria-label="Oszczędzaj AI"></button></div><div id="codexHelp" class="help muted">Oszczędzanie AI:<br>• preferowany jest LOCAL,<br>• automatyczny CODEX jest blokowany,<br>• automatyczny CLAUDE jest blokowany.</div></div></div>
  <div class="card compact"><strong>PODSUMOWANIE</strong><div id="activeProject">Projekt: ${escapeHtmlAttribute(project?.projectName ?? "NIE WYBRANO")}</div><div id="taskSummary" aria-live="polite">LOCAL • Qwen 2.5 Coder 7B<br>AUTO 2 • Zmiany plików: TAK • CODEX: DOSTĘPNY</div></div>
  <button id="runTask" class="primary wide" data-command="run"${project ? "" : " disabled"}>▶ URUCHOM ZADANIE</button>
  <details class="work-log"><summary>DZIENNIK PRACY</summary><div id="workLog" aria-live="polite">Gotowy do pracy.</div></details>
  <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="taskPanel">ZADANIE</button><button role="tab" aria-selected="false" data-tab="reportPanel">RAPORT</button><button role="tab" aria-selected="false" data-tab="historyPanel">HISTORIA</button><button role="tab" aria-selected="false" data-tab="researchPanel">RESEARCH</button><button role="tab" aria-selected="false" data-tab="diagnosticsPanel">DIAGNOSTYKA</button></div>
  <div id="warning" class="warning" role="status" aria-live="polite"></div><div id="error" class="error" role="alert" aria-live="assertive"></div><section id="taskPanel" role="tabpanel"><div id="status" class="card" aria-live="polite"><strong>Brak aktywnego zadania.</strong></div>
  <div id="approval" class="actions hidden"><button class="primary" data-command="approveCodex">URUCHOM PRZEZ CODEX</button><button data-command="finishTask">ZAKOŃCZ ZADANIE</button></div>
  </section><section id="reportPanel" role="tabpanel" hidden>Brak raportu.<br><button data-command="lastReport">OTWÓRZ PEŁNY RAPORT</button></section><section id="historyPanel" role="tabpanel" hidden><div id="historyList">Brak wcześniejszych zadań.</div><button id="moreHistory" class="hidden" data-command="moreHistory">POKAŻ WIĘCEJ</button></section><section id="researchPanel" role="tabpanel" hidden><span class="muted">SearXNG + lokalny Qwen</span><div class="field"><label for="query">Czego szukamy?</label><textarea id="query"></textarea></div><button data-command="research">SZUKAJ</button><div id="researchResult"></div></section><section id="diagnosticsPanel" role="tabpanel" hidden><div id="health" class="card health" aria-live="polite"></div><button data-command="healthCheck">SPRAWDŹ PONOWNIE</button><div class="paths">${Object.entries(settings).map(([key,value])=>`<div class="path"><label for="${key}">${({orchestratorPath:"Orchestrator",researchLabPath:"ResearchLab",sandboxPath:"Sandbox",projectsRoot:"Projekty"} as Record<string,string>)[key]}</label><input id="${key}" value="${escapeHtmlAttribute(value)}"><button data-command="choosePath" data-key="${key}">WYBIERZ</button></div>`).join("")}</div><div class="actions"><button data-command="saveSettings">ZAPISZ USTAWIENIA</button><button data-command="restoreDefaults">PRZYWRÓĆ DOMYŚLNE</button></div><button data-command="documentation">DOKUMENTACJA</button><div class="muted">installedVersion: ${escapeHtmlAttribute(installedVersion)}<br>repository: MuniTalp-dev/KondzioAI-VSCode</div><div id="settingsStatus" aria-live="polite"></div></section><div id="changelogModal" class="modal hidden" role="dialog" aria-modal="true"><div class="modal-card"><h2>CHANGELOG</h2><div id="releaseMeta"></div><pre id="releaseNotes"></pre><div class="actions"><button data-command="closeChangelog">ZAMKNIJ</button><button class="primary" data-command="installUpdate">AKTUALIZUJ</button></div></div></div>
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

export function html(installedVersion = "", settings: Record<string, string> = pathDefaults, scriptUri = "media/webview.js", cspSource = "'self'", project?: ProjectState, lastCheckedAt?: number): string {
  return renderPanelHtml(installedVersion, settings, scriptUri, cspSource, project, lastCheckedAt);
}
