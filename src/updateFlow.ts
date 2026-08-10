import { UpdateResult } from "./types";

export const WebviewMessageType = {
  CheckForUpdates: "checkForUpdates",
} as const;

export type WebviewMessageType = typeof WebviewMessageType[keyof typeof WebviewMessageType];
export type UpdateWebviewMessage = { type: typeof WebviewMessageType.CheckForUpdates };

export function createUpdateCheckMessage(): UpdateWebviewMessage {
  return { type: WebviewMessageType.CheckForUpdates };
}

export function updateButtonScript(): string {
  return `$('updateCheck').addEventListener('click',()=>{console.log('[Kondzio AI WebView] Update button clicked');console.log('[Kondzio AI WebView] Sending ${WebviewMessageType.CheckForUpdates}');vscode.postMessage({type:${JSON.stringify(WebviewMessageType.CheckForUpdates)}})})`;
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
  if (message.type !== WebviewMessageType.CheckForUpdates) { return false; }
  await runUpdateCheck(check, post, currentVersion);
  return true;
}
