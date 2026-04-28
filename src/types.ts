export type Tier = "fast" | "balanced" | "large"

export type ModelRef = {
  providerID: string
  modelID: string
}

export type TierConfig = {
  model?: string
  description?: string
  whenToUse?: string
}

export type RouterConfig = {
  enabled: boolean
  mode: "auto" | "manual" | "off"
  router: {
    model?: string
    temperature: number
    timeoutMs: number
    maxRetries: number
    prompts: {
      system: string
      userTemplate: string
    }
  }
  tiers: Record<Tier, TierConfig>
  fallbackTier: Tier
  display: {
    showToast: boolean
    injectMessage: boolean
    includeReason: boolean
  }
  routing: {
    preferCheapForReadOnly: boolean
    largeKeywords: string[]
    fastKeywords: string[]
    forceTierPrefixes: Array<{ prefix: string; tier: Tier }>
    minConfidence: number
  }
}

export type PartialRouterConfig = Partial<Omit<RouterConfig, "router" | "tiers" | "display" | "routing">> & {
  router?: Partial<Omit<RouterConfig["router"], "prompts">> & { prompts?: Partial<RouterConfig["router"]["prompts"]> }
  tiers?: Partial<Record<Tier, Partial<TierConfig>>>
  display?: Partial<RouterConfig["display"]>
  routing?: Partial<RouterConfig["routing"]>
}

export type RouterDecision = {
  tier: string
  confidence: number
  reason: string
  signals: string[]
}

export type RoutingResult = {
  changed: boolean
  tier?: Tier
  model?: ModelRef
  text: string
  reason?: string
  signals: string[]
  fallback: boolean
}
