import { formatModelID } from "./model-id.js"
import type { RouterConfig, RoutingResult } from "./types.js"

export function formatRoutingBanner(result: RoutingResult, config: RouterConfig): string {
  if (!result.tier || !result.model) return "[oc-router] routing skipped"
  const base = `[oc-router] selected ${result.tier} -> ${formatModelID(result.model)}`
  if (!config.display.includeReason || !result.reason) return base
  return `${base} (reason: ${result.reason})`
}

export function injectRoutingBanner(output: { parts: any[] }, result: RoutingResult, config: RouterConfig) {
  if (!config.display.injectMessage || !result.changed) return
  output.parts.push({
    type: "text",
    text: formatRoutingBanner(result, config),
    synthetic: true,
  })
}

export async function showRoutingToast(
  client: { tui?: { showToast?: (input: { body: { message: string; variant: "info" } }) => Promise<unknown> }; showToast?: (input: { body: { message: string; variant: "info" } }) => Promise<unknown> },
  result: RoutingResult,
  config: RouterConfig,
) {
  if (!config.display.showToast || !result.changed || !result.tier || !result.model) return
  const toastPayload = { body: { message: `oc-router: ${result.tier} -> ${formatModelID(result.model)}`, variant: "info" as const } }
  try {
    // Support both ctx.client.tui.showToast and ctx.client.showToast APIs
    if (typeof client.tui?.showToast === "function") {
      await client.tui.showToast(toastPayload)
    } else if (typeof (client as any).showToast === "function") {
      await (client as any).showToast(toastPayload)
    }
  } catch {
    // TUI APIs are unavailable in some OpenCode clients; routing must remain non-fatal.
  }
}

export function formatActiveModelLabel(model: string) {
  return `[model: ${model}]`
}
