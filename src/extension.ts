import * as vscode from "vscode";
import { join } from "node:path";
import { McpBackend } from "./backend";
import { OrchestratorController, statusBarText } from "./model";
import { KondzioViewProvider } from "./panel";
import { UPDATE_CONFIRMATION, UpdateService, updateApproved } from "./update";
import { checkForUpdatesCommand } from "./updateCommand";
import { enrichCodexHealth } from "./codexHealth";
import { installUpdate } from "./updateInstaller";
import { ReleaseService } from "./releaseService";
import { enrichClaudeHealth } from "./claudeHealth";
import { ClaudeUsageProvider, CodexUsageProvider, PublicExtensionInfo, UsageService } from "./usage";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Kondzio AI");
  const config = vscode.workspace.getConfiguration("kondzioAi");
  const root = config.get<string>("orchestratorPath", config.get<string>("orchestratorRoot", "E:\\AI\\Orchestrator"));
  const python = config.get<string>("pythonPath", join(root, ".venv", "Scripts", "python.exe"));
  const backend = new McpBackend(python, root, context.asAbsolutePath(join("python", "mcp_bridge.py")));
  const codexCliPath = config.get<string>("codexCliPath", "");
  const releaseRepositoryPath = config.get<string>("extensionRepositoryPath", "E:\\AI\\Orchestrator\\vscode-extension");
  const log = (message: string) => output.appendLine(`[Kondzio AI] ${message}`);
  const controller = new OrchestratorController(backend, async health => enrichClaudeHealth(await enrichCodexHealth(health,
    Boolean(vscode.extensions.getExtension("openai.chatgpt") ?? vscode.extensions.getExtension("openai.codex")), codexCliPath, undefined, log), undefined, log));
  const discoverCodex = async (): Promise<PublicExtensionInfo | undefined> => {
    const extension = vscode.extensions.getExtension("openai.chatgpt") ?? vscode.extensions.getExtension("openai.codex"); if (!extension) return undefined;
    await extension.activate(); const commands = (await vscode.commands.getCommands(true)).filter(id => /(?:codex|openai|chatgpt)/i.test(id) && /(?:usage|status|limit|account)/i.test(id));
    const exportsValue = extension.exports as unknown; const exportsKeys = exportsValue && (typeof exportsValue === "object" || typeof exportsValue === "function") ? Object.keys(exportsValue) : [];
    const info = { id: extension.id, version: String(extension.packageJSON.version ?? ""), active: extension.isActive, exportsKeys, commands };
    log(`Usage discovery: ${JSON.stringify(info)}`); return info;
  };
  const defaultClaudeUsagePath = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "KondzioAI", "claude-usage.json") : "";
  const usage = new UsageService([new CodexUsageProvider(discoverCodex), new ClaudeUsageProvider(config.get<string>("claudeUsagePath", defaultClaudeUsagePath))]);
  const version = String(context.extension.packageJSON.version);
  const updateRepository = "MuniTalp-dev/KondzioAI-VSCode";
  log("Extension activated");
  log(`Version: ${version}`);
  log(`updateRepository: ${updateRepository}`);
  const updates = new UpdateService(version, updateRepository, context.globalState, fetch, log);
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  statusBar.command = "kondzioAi.newTask"; statusBar.text = "Kondzio AI: IDLE"; statusBar.show();
  const openMarkdown = async (title: string, markdown: string) => {
    const document = await vscode.workspace.openTextDocument({ language: "markdown", content: `# ${title}\n\n${markdown}` });
    await vscode.window.showTextDocument(document, { preview: true });
  };
  const confirmUpdate = async (url: string) => {
    const choice = await vscode.window.showWarningMessage("Otworzyć stronę GitHub Release? Rozszerzenie nie zainstaluje aktualizacji automatycznie.", { modal: true }, UPDATE_CONFIRMATION);
    if (updateApproved(choice)) { await vscode.env.openExternal(vscode.Uri.parse(url)); }
  };
  const provider = new KondzioViewProvider(controller, status => { statusBar.text = statusBarText(status); }, openMarkdown, updates, confirmUpdate, log, context.extensionUri,
    async (release, progress) => installUpdate(release, progress, log),
    async () => { await vscode.commands.executeCommand("workbench.action.reloadWindow"); }, new ReleaseService(releaseRepositoryPath), usage);
  context.subscriptions.push(output, backend, provider, statusBar, vscode.window.registerWebviewViewProvider(KondzioViewProvider.viewType, provider, { webviewOptions: { retainContextWhenHidden: true } }));
  const reveal = async () => { await provider.reveal(); };
  const command = (id: string, action: () => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, action));
  command("kondzioAi.newTask", async () => { await reveal(); provider.preset(); });
  for (const level of [1, 2, 3] as const) { command(`kondzioAi.auto${level}`, async () => { await reveal(); provider.preset(level); }); }
  command("kondzioAi.research", async () => { await reveal(); provider.preset(undefined, "research"); });
  command("kondzioAi.status", async () => { await reveal(); await provider.refreshStatus(); });
  command("kondzioAi.lastReport", async () => { await provider.showLastReport(); });
  command("kondzioAi.history", async () => { await reveal(); await provider.showHistory(); });
  command("kondzioAi.checkForUpdates", async () => {
    await checkForUpdatesCommand(updates, {
      information: (message, action) => action ? vscode.window.showInformationMessage(message, action) : vscode.window.showInformationMessage(message),
      warning: (message, action) => action ? vscode.window.showWarningMessage(message, action) : vscode.window.showWarningMessage(message),
      openRelease: async url => { await vscode.env.openExternal(vscode.Uri.parse(url)); },
    }, log);
  });
  command("kondzioAi.reloadPanel", async () => { await provider.reloadPanel(); });
  command("kondzioAi.resetWebviewState", async () => { await provider.resetWebviewState(); });
}

export function deactivate(): void {}
