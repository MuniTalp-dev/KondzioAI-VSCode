import { UpdateResult } from "./types";

export const OPEN_RELEASE = "OTWÓRZ WYDANIE";

export interface UpdateCommandUi {
  information(message: string, action?: string): PromiseLike<string | undefined>;
  warning(message: string, action?: string): PromiseLike<string | undefined>;
  openRelease(url: string): PromiseLike<void>;
}

export interface UpdateChecker {
  check(manual?: boolean): Promise<UpdateResult>;
}

export async function checkForUpdatesCommand(
  updates: UpdateChecker,
  ui: UpdateCommandUi,
  log: (message: string) => void,
): Promise<UpdateResult> {
  log("Command checkForUpdates invoked");
  const result = await updates.check(true);

  switch (result.status) {
    case "current":
      await ui.information(`Kondzio AI ${result.currentVersion} jest aktualne.`);
      break;
    case "updateAvailable": {
      const latest = result.latestVersion?.startsWith("v") ? result.latestVersion : `v${result.latestVersion ?? ""}`;
      const choice = await ui.information(`Dostępna aktualizacja Kondzio AI ${latest}`, OPEN_RELEASE);
      if (choice === OPEN_RELEASE && result.releaseUrl) { await ui.openRelease(result.releaseUrl); }
      break;
    }
    case "timeout":
      await ui.warning("Przekroczono czas sprawdzania aktualizacji.");
      break;
    case "error":
    default:
      await ui.warning("Nie udało się sprawdzić aktualizacji.");
      break;
  }

  return result;
}
