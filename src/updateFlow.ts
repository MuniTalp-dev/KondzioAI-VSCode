import { UpdateResult } from "./types";

export const CHECK_FOR_UPDATES_MESSAGE = "checkForUpdates" as const;
export type UpdateWebviewMessage = { type: typeof CHECK_FOR_UPDATES_MESSAGE };

export function createUpdateCheckMessage(): UpdateWebviewMessage {
  return { type: CHECK_FOR_UPDATES_MESSAGE };
}

export async function runUpdateCheck(
  check: () => Promise<UpdateResult>,
  post: (result: UpdateResult) => void,
  currentVersion = "",
): Promise<void> {
  post({ status: "checking", currentVersion });
  let result: UpdateResult | undefined;
  try {
    result = await check();
  } catch (error) {
    result = { status: "error", currentVersion, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    post(result ?? { status: "error", currentVersion });
  }
}

export async function routeUpdateMessage(
  message: { type?: unknown },
  check: () => Promise<UpdateResult>,
  post: (result: UpdateResult) => void,
  currentVersion = "",
): Promise<boolean> {
  if (message.type !== CHECK_FOR_UPDATES_MESSAGE) { return false; }
  await runUpdateCheck(check, post, currentVersion);
  return true;
}
