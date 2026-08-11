import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { OrchestratorBackend } from "./types";
import { processInvocation } from "./processRunner";

interface Pending { resolve(value: unknown): void; reject(error: Error): void; }

export class McpBackend implements OrchestratorBackend {
  private process?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly pythonPath: string, private readonly root: string, private readonly bridgePath: string) {}

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.process && !this.process.killed) { return this.process; }
    const invocation = processInvocation(this.pythonPath, [this.bridgePath, this.root]);
    console.log(`[Kondzio AI] Process resolved: ${invocation.resolved}`);
    console.log(`[Kondzio AI] Args: ${[this.bridgePath, this.root].join(" ")}`);
    console.log(`[Kondzio AI] cwd: ${this.root}`);
    const child = spawn(invocation.command, invocation.args, { ...invocation.options, cwd: this.root }) as ChildProcessWithoutNullStreams;
    this.process = child;
    createInterface({ input: child.stdout }).on("line", line => {
      try {
        const response = JSON.parse(line) as { id: number; result?: unknown; error?: string };
        const request = this.pending.get(response.id);
        if (!request) { return; }
        this.pending.delete(response.id);
        response.error ? request.reject(new Error(response.error)) : request.resolve(response.result);
      } catch { /* stderr carries backend diagnostics; malformed stdout is ignored */ }
    });
    child.stderr.on("data", data => console.error(`[Kondzio AI] ${String(data)}`));
    child.on("exit", code => {
      const error = new Error(`Backend Orchestratora zakończył pracę (kod ${code ?? "?"}).`);
      for (const request of this.pending.values()) { request.reject(error); }
      this.pending.clear();
      this.process = undefined;
    });
    return child;
  }

  call<T>(tool: string, argumentsValue: Record<string, unknown> = {}): Promise<T> {
    const child = this.ensureStarted();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      child.stdin.write(`${JSON.stringify({ id, tool, arguments: argumentsValue })}\n`, error => {
        if (error) { this.pending.delete(id); reject(error); }
      });
    });
  }

  dispose(): void { this.process?.kill(); this.process = undefined; }
}
