import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import { spawn, SpawnOptionsWithoutStdio } from "node:child_process";

export type ProcessStage = "execution" | "tests" | "package" | "release-readiness";
export interface ProcessResult { code: number; stdout: string; stderr: string; stage: ProcessStage; }
export type ProcessLogger = (message: string) => void;

const WINDOWS_WRAPPERS = new Set(["npm", "npx", "code"]);
const WINDOWS_EXECUTABLES = new Set(["git", "gh"]);

function safeLogArgument(value: string): string {
  return /(?:token|password|secret|api[-_]?key)=/i.test(value) ? "<redacted>" : value;
}

function cmdQuote(value: string): string {
  if (/\0|\r|\n/.test(value)) { throw new Error("Argument procesu zawiera niedozwolony znak sterujący."); }
  return `"${value.replace(/%/g, "%%").replace(/"/g, '""')}"`;
}

export function windowsCmdInvocation(command: string, args: string[], comSpec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe") {
  const commandLine = `"${[command, ...args].map(cmdQuote).join(" ")}"`;
  return { command: comSpec, args: ["/d", "/s", "/c", commandLine], options: { windowsHide: true, windowsVerbatimArguments: true, shell: false as const } };
}

export function resolveProcess(command: string, platform = process.platform, pathValue = process.env.PATH ?? "", fileExists: (path: string) => boolean = existsSync): string {
  if (platform !== "win32" || isAbsolute(command) || extname(command)) { return command; }
  const lower = command.toLowerCase();
  const names = WINDOWS_WRAPPERS.has(lower) ? [`${command}.cmd`] : WINDOWS_EXECUTABLES.has(lower) ? [`${command}.exe`] : [command];
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const name of names) { const candidate = join(directory.replace(/^"|"$/g, ""), name); if (fileExists(candidate)) { return candidate; } }
  }
  return names[0];
}

export function processInvocation(command: string, args: string[], platform = process.platform, pathValue = process.env.PATH ?? "", fileExists: (path: string) => boolean = existsSync,
                                  comSpec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe") {
  const resolved = resolveProcess(command, platform, pathValue, fileExists);
  return platform === "win32" && /\.(?:cmd|bat)$/i.test(resolved)
    ? { resolved, ...windowsCmdInvocation(resolved, args, comSpec) }
    : { resolved, command: resolved, args, options: { windowsHide: true, windowsVerbatimArguments: false, shell: false as const } };
}

export function runProcess(command: string, args: string[], cwd: string, stage: ProcessStage = "execution", log: ProcessLogger = () => {}): Promise<ProcessResult> {
  return new Promise(resolve => {
    let invocation;
    try { invocation = processInvocation(command, args); }
    catch (error) { resolve({ code: -1, stdout: "", stderr: error instanceof Error ? error.message : String(error), stage }); return; }
    log(`Process resolved: ${invocation.resolved}`);
    log(`Args: ${args.map(safeLogArgument).join(" ")}`);
    log(`cwd: ${cwd}`);
    const child = spawn(invocation.command, invocation.args, invocation.options as SpawnOptionsWithoutStdio); let stdout = "", stderr = "";
    child.stdout.on("data", data => { stdout += String(data); }); child.stderr.on("data", data => { stderr += String(data); });
    child.on("error", error => resolve({ code: -1, stdout, stderr: error.message, stage }));
    child.on("close", code => resolve({ code: code ?? -1, stdout, stderr, stage }));
  });
}
