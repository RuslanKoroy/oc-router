import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { isModelID } from "./model-id.js"
import { globalConfigPath, projectConfigPath } from "./paths.js"
import type { PartialRouterConfig, RouterConfig, Tier } from "./types.js"

export const defaultConfig: RouterConfig = {
  enabled: true,
  mode: "auto",
  router: {
    model: "provider/router-model",
    temperature: 0,
    timeoutMs: 12_000,
    maxRetries: 1,
    prompts: {
      system: [
        "Classify each OpenCode user request into exactly one model tier: fast, balanced, or large.",
        "Return only JSON matching the router decision schema.",
        "Use balanced as the default tier.",
        "Use fast only for reading and exploring code, simple commands, and low-risk information gathering.",
        "Use large for architecture, research, high-quality code generation, non-obvious solutions, and difficult problems.",
      ].join("\n"),
      userTemplate: [
        "Available tiers:",
        "{tiers}",
        "",
        "Request:",
        "{request}",
      ].join("\n"),
    },
  },
  tiers: {
    fast: {
      model: "provider/fast-model",
      description: "Fast, cheap model for lightweight OpenCode work.",
      whenToUse: "Use only for reading and studying code, simple commands, quick searches, summaries, and low-risk exploration. Do not use for writing production code or solving complex problems.",
    },
    balanced: {
      model: "provider/balanced-model",
      description: "Default model for day-to-day OpenCode work.",
      whenToUse: "Use by default for normal development tasks, routine edits, ordinary debugging, tests, documentation, and tasks that are not clearly fast-only or large-worthy.",
    },
    large: {
      model: "provider/large-model",
      description: "Most capable model for high-value reasoning and implementation.",
      whenToUse: "Use for architecture, research, complex debugging, difficult problems, non-obvious solutions, high-quality code generation, security-sensitive changes, and work where mistakes are expensive.",
    },
  },
  fallbackTier: "balanced",
  display: {
    showToast: true,
    injectMessage: true,
    includeReason: true,
  },
  routing: {
    preferCheapForReadOnly: true,
    largeKeywords: ["architecture", "security", "refactor", "migration", "design"],
    fastKeywords: ["typo", "format", "explain", "rename"],
    forceTierPrefixes: [
      { prefix: "/fast", tier: "fast" },
      { prefix: "/balanced", tier: "balanced" },
      { prefix: "/large", tier: "large" },
    ],
    minConfidence: 0.5,
  },
}

export { globalConfigPath, projectConfigPath } from "./paths.js"

function readConfig(path: string): PartialRouterConfig | undefined {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, "utf8")) as PartialRouterConfig
}

export function mergeConfig(...items: Array<PartialRouterConfig | undefined>): RouterConfig {
  const result: RouterConfig = structuredClone(defaultConfig)
  for (const item of items) {
    if (!item) continue
    if (item.enabled !== undefined) result.enabled = item.enabled
    if (item.mode !== undefined) result.mode = item.mode
    if (item.fallbackTier !== undefined) result.fallbackTier = item.fallbackTier
    result.router = { ...result.router, ...item.router, prompts: { ...result.router.prompts, ...item.router?.prompts } }
    result.display = { ...result.display, ...item.display }
    result.routing = { ...result.routing, ...item.routing }
    result.tiers = {
      fast: { ...result.tiers.fast, ...item.tiers?.fast },
      balanced: { ...result.tiers.balanced, ...item.tiers?.balanced },
      large: { ...result.tiers.large, ...item.tiers?.large },
    }
  }
  return result
}

export function loadRouterConfig(paths: { globalPath?: string; projectPath?: string } = {}) {
  const globalPath = paths.globalPath ?? globalConfigPath()
  const projectPath = paths.projectPath ?? projectConfigPath()
  const globalPartial = readConfig(globalPath)
  const projectPartial = readConfig(projectPath)
  if (!globalPartial && !projectPartial) {
    console.warn(`[oc-router] No config found at global (${globalPath}) or project (${projectPath}) path — using defaults`)
  }
  return {
    globalPath,
    projectPath,
    config: mergeConfig(globalPartial, projectPartial),
  }
}

export function validateRouterConfig(config: RouterConfig): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!config.enabled || config.mode === "off") return { ok: true, errors }
  if (config.router.model && !isModelID(config.router.model)) errors.push("router.model must use provider/model format")
  for (const tier of ["fast", "balanced", "large"] as Tier[]) {
    const model = config.tiers[tier].model
    if (!model) errors.push(`tiers.${tier}.model is required when router is enabled`)
    else if (!isModelID(model)) errors.push(`tiers.${tier}.model must use provider/model format`)
  }
  if (!config.tiers[config.fallbackTier].model) errors.push("fallbackTier must point to a configured tier")
  return { ok: errors.length === 0, errors }
}

export function writeRouterConfig(path: string, config: RouterConfig | PartialRouterConfig) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`)
}

export function setEnabled(path: string, enabled: boolean) {
  const current = mergeConfig(readConfig(path))
  writeRouterConfig(path, { ...current, enabled })
}
