import { parseModelID } from "./model-id.js"
import type { RouterConfig, RouterDecision, RoutingResult, Tier } from "./types.js"

export type RouterCall = (input: { prompt: string; config: RouterConfig }) => Promise<RouterDecision>

function isTier(value: string): value is Tier {
  return value === "fast" || value === "balanced" || value === "large"
}

function resultForTier(config: RouterConfig, tier: Tier, text: string, reason: string, fallback: boolean): RoutingResult {
  const modelID = config.tiers[tier].model
  if (!modelID) return { changed: false, text, signals: [], fallback: true, reason: `Tier ${tier} has no model configured` }
  return {
    changed: true,
    tier,
    model: parseModelID(modelID),
    text,
    reason,
    signals: [],
    fallback,
  }
}

function forcedTier(config: RouterConfig, text: string): { tier: Tier; text: string } | undefined {
  const trimmed = text.trimStart()
  for (const item of config.routing.forceTierPrefixes) {
    if (!trimmed.startsWith(item.prefix)) continue
    const next = trimmed.slice(item.prefix.length).trimStart()
    return { tier: item.tier, text: next }
  }
  return undefined
}

export async function routeMessage(input: {
  config: RouterConfig
  text: string
  router: RouterCall
  prompt?: string
}): Promise<RoutingResult> {
  const { config, text } = input
  if (!config.enabled || config.mode === "off") return { changed: false, text, signals: [], fallback: false }

  const forced = forcedTier(config, text)
  if (forced) return resultForTier(config, forced.tier, forced.text, `forced by ${forced.tier} prefix`, false)
  if (config.mode === "manual") return { changed: false, text, signals: [], fallback: false }

  try {
    const decision = await input.router({ prompt: input.prompt ?? text, config })
    if (!isTier(decision.tier) || decision.confidence < config.routing.minConfidence) {
      return resultForTier(config, config.fallbackTier, text, "router decision was invalid or uncertain", true)
    }
    const result = resultForTier(config, decision.tier, text, decision.reason, false)
    result.signals = decision.signals
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return resultForTier(config, config.fallbackTier, text, `router failed: ${message}`, true)
  }
}
