import type { RouterConfig } from "./types.js"

export const routerDecisionSchema = {
  type: "object",
  properties: {
    tier: { type: "string", enum: ["fast", "balanced", "large"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
    signals: { type: "array", items: { type: "string" } },
  },
  required: ["tier", "confidence", "reason", "signals"],
  additionalProperties: false,
}

export function buildRouterPrompt(config: RouterConfig, text: string) {
  const tiers = [
    `fast: ${config.tiers.fast.description ?? "simple, cheap, low-risk work"}. Use when: ${config.tiers.fast.whenToUse ?? "reading, exploration, and simple low-risk commands only"}`,
    `balanced: ${config.tiers.balanced.description ?? "normal coding and debugging"}. Use when: ${config.tiers.balanced.whenToUse ?? "default choice for normal development work"}`,
    `large: ${config.tiers.large.description ?? "complex, high-risk, architectural, or security-sensitive work"}. Use when: ${config.tiers.large.whenToUse ?? "architecture, research, high-quality code, and difficult problems"}`,
  ].join("\n")
  const user = config.router.prompts.userTemplate.replaceAll("{tiers}", tiers).replaceAll("{request}", text)
  return [
    config.router.prompts.system,
    "Tier names are configurable slots. Follow each tier's description and whenToUse text over generic assumptions from the names fast, balanced, and large.",
    "Never choose fast for requests that create, edit, write, patch, or delete files. Use balanced for routine file changes and large for complex or high-risk file changes.",
    user,
  ].join("\n\n")
}
