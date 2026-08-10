export type Autonomy = 1 | 2 | 3;
export type ExecutorMode = "auto" | "local" | "research" | "codex";

export interface RunRequest { prompt: string; autonomy: Autonomy; mode: ExecutorMode; dry_run: boolean; prefer_local: boolean; block_codex_escalation: boolean; codex_approved?: boolean; }
export interface RunSummary { run_id: string; prompt?: string; status?: string; autonomy?: number; agent?: string; eta_minutes?: number; actual_minutes?: number; started_at?: string; }
export interface StatusResult {
  run_id: string; status: string; started_at?: string; elapsed_seconds?: number; current_stage?: string;
  current_attempt?: number; current_agent?: string; initial_eta?: { minimum?: number; typical?: number; maximum?: number };
  remaining_eta?: { seconds?: number }; research_status?: string; implementation_status?: string;
  validation_status?: string; test_status?: string; files_changed?: string[]; commit_status?: string;
  push_status?: string; dry_run?: boolean; routing?: Record<string, unknown>; plan?: string[]; risks?: string[];
  acceptance_criteria?: { items?: string[]; [key: string]: unknown };
  prefer_local?: boolean; block_codex_escalation?: boolean; codex_allowed?: boolean; codex_required?: boolean;
  codex_reason?: string; executors_used?: string[]; local_attempts?: number; research_used?: boolean;
  codex_used?: boolean; codex_blocked?: boolean; estimated_codex_savings?: string;
}

export interface OrchestratorBackend {
  call<T>(tool: string, argumentsValue?: Record<string, unknown>): Promise<T>;
  dispose(): void;
}

export type HealthState = "CHECKING" | "OK" | "WARNING" | "ERROR";
export interface HealthItem { name: string; status: HealthState; version?: string; detail?: string; }
export interface HealthResult { checked_at: string; items: HealthItem[]; }
export interface UpdateResult { status: "idle" | "checking" | "current" | "updateAvailable" | "error" | "timeout"; currentVersion: string; latestVersion?: string; releaseUrl?: string; detail?: string; }
