export const WEBVIEW_CLIENT_INITIALIZED = "[Kondzio AI WebView] Client initialized";

export function webviewClientScript(): string {
  return `
  console.log(${JSON.stringify(WEBVIEW_CLIENT_INITIALIZED)});
  vscode.postMessage({ type: "clientInitialized" });
  document.addEventListener("click", event => {
    const source = event.target;
    const target = source instanceof Element ? source.closest("[data-command]") : null;
    if (!target) { return; }
    const command = target.getAttribute("data-command");
    if (!command) { return; }
    const message = payloadFor(command, target);
    if (message) { vscode.postMessage(message); }
  });`;
}

export interface BusElement {
  closest(selector: string): { getAttribute(name: string): string | null } | null;
}

export function dispatchWebviewClick(
  target: BusElement | null,
  payloadFor: (command: string) => Record<string, unknown> | undefined,
  postMessage: (message: Record<string, unknown>) => void,
): boolean {
  const action = target?.closest("[data-command]");
  const command = action?.getAttribute("data-command");
  if (!command) { return false; }
  const message = payloadFor(command);
  if (!message) { return false; }
  postMessage(message);
  return true;
}
