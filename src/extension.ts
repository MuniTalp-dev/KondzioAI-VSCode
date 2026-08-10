import * as vscode from "vscode";
import { join } from "node:path";
import { McpBackend } from "./backend";
import { OrchestratorController, statusBarText } from "./model";
import { KondzioViewProvider } from "./panel";
import { UPDATE_CONFIRMATION, UpdateService, updateApproved } from "./update";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Kondzio AI");
  const config = vscode.workspace.getConfiguration("kondzioAi");
  const root = config.get<string>("orchestratorRoot", "E:\\AI\\Orchestrator");
  const python = config.get<string>("pythonPath", join(root, ".venv", "Scripts", "python.exe"));
  const backend = new McpBackend(python, root, context.asAbsolutePath(join("python", "mcp_bridge.py")));
  const controller = new OrchestratorController(backend);
  const version = String(context.extension.packageJSON.version);
  const updateRepository = config.get<string>("updateRepository", "MuniTalp-dev/KondzioAI-VSCode");
  const log = (message: string) => output.appendLine(`[Kondzio AI] ${message}`);
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
  const provider = new KondzioViewProvider(controller, status => { statusBar.text = statusBarText(status); }, openMarkdown, updates, confirmUpdate, log);
  context.subscriptions.push(output, backend, provider, statusBar, vscode.window.registerWebviewViewProvider(KondzioViewProvider.viewType, provider, { webviewOptions: { retainContextWhenHidden: true } }));
  const reveal = async () => { await provider.reveal(); };
  const command = (id: string, action: () => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, action));
  command("kondzioAi.newTask", async () => { await reveal(); provider.preset(); });
  for (const level of [1, 2, 3] as const) { command(`kondzioAi.auto${level}`, async () => { await reveal(); provider.preset(level); }); }
  command("kondzioAi.research", async () => { await reveal(); provider.preset(undefined, "research"); });
  command("kondzioAi.status", async () => { await reveal(); await provider.refreshStatus(); });
  command("kondzioAi.lastReport", async () => { await provider.showLastReport(); });
  command("kondzioAi.history", async () => { await reveal(); await provider.showHistory(); });
}

export function deactivate(): void {}
