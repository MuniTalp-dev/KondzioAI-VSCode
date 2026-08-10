import { UpdateResult } from "./types";

export type VersionStatusTone = "success" | "warning" | "progress" | "error";

export interface VersionStatusPresentation {
  text: string;
  tone: VersionStatusTone;
  showReleaseButton: boolean;
}

export function versionStatusPresentation(result: UpdateResult): VersionStatusPresentation {
  if (result.status === "checking") {
    return { text: "⟳ SPRAWDZANIE AKTUALIZACJI...", tone: "progress", showReleaseButton: false };
  }
  if (result.status === "updateAvailable") {
    const latestVersion = result.latestVersion?.startsWith("v") ? result.latestVersion : `v${result.latestVersion ?? ""}`;
    return { text: `⚠ DOSTĘPNA AKTUALIZACJA ${latestVersion}`.trim(), tone: "warning", showReleaseButton: true };
  }
  if (result.status === "timeout") {
    return { text: "! PRZEKROCZONO CZAS SPRAWDZANIA", tone: "warning", showReleaseButton: false };
  }
  if (result.status === "error") {
    return { text: "✕ NIE UDAŁO SIĘ SPRAWDZIĆ AKTUALIZACJI", tone: "error", showReleaseButton: false };
  }
  if (result.status === "current" && result.latestVersion) {
    return { text: "✓ OPROGRAMOWANIE AKTUALNE", tone: "success", showReleaseButton: false };
  }
  return { text: "Nie sprawdzono aktualności oprogramowania.", tone: "progress", showReleaseButton: false };
}
