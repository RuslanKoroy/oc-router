import { defaultConfig, mergeConfig } from "./config.js"
import type { RouterConfig } from "./types.js"

type Ask = (question: string) => Promise<string>
type ModelChoice = { name: string; value: string; description?: string; disabled?: boolean }
type PromptAdapters = {
  select: (input: { message: string; choices: ModelChoice[]; default?: string }) => Promise<string>
  search?: (input: { message: string; source: (term: string | undefined) => ModelChoice[]; default?: string }) => Promise<string>
  input: (input: { message: string; default?: string }) => Promise<string>
  confirm: (input: { message: string; default?: boolean }) => Promise<boolean>
}

function modelIDs(modelsOutput: string) {
  const ids = new Set<string>()
  for (const match of modelsOutput.matchAll(/\b([a-zA-Z0-9_.-]+\/[\w./:-]+)\b/g)) ids.add(match[1])
  return [...ids].sort()
}

function modelName(line: string, id: string) {
  return line.trim().slice(id.length).trim() || id
}

function providerLabel(provider: string) {
  if (provider === "openai") return "OpenAI"
  if (provider === "opencode") return "OpenCode"
  return provider
    .split(/[-_]/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function modelEntries(modelsOutput: string) {
  const entries = new Map<string, { id: string; provider: string; name: string }>()
  for (const line of modelsOutput.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-zA-Z0-9_.-]+\/[\w./:-]+)\b(.*)$/)
    if (!match) continue
    const id = match[1]
    entries.set(id, { id, provider: id.slice(0, id.indexOf("/")), name: modelName(line, id) })
  }
  return [...entries.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id))
}

function pickDefault(ids: string[], pattern: RegExp, fallback: string) {
  return ids.find((id) => pattern.test(id)) ?? ids[0] ?? fallback
}

function resolveChoice(answer: string, ids: string[], fallback: string) {
  const trimmed = answer.trim()
  if (!trimmed) return fallback
  const index = Number(trimmed)
  if (Number.isInteger(index) && index >= 1 && index <= ids.length) return ids[index - 1]
  return trimmed
}

function keepOrReplace(answer: string, fallback: string) {
  const trimmed = answer.trim()
  return trimmed || fallback
}

export function renderModelChoices(modelsOutput: string) {
  const ids = modelIDs(modelsOutput)
  if (!ids.length) return "No OpenCode models detected. You can still type provider/model IDs manually."
  return ids.map((id, index) => `${index + 1}. ${id}`).join("\n")
}

export function getModelSelectChoices(modelsOutput: string) {
  const entries = modelEntries(modelsOutput)
  const choices: ModelChoice[] = []
  let current = ""
  for (const entry of entries) {
    if (entry.provider !== current) {
      current = entry.provider
      choices.push({ name: providerLabel(current), value: `__separator_${current}`, disabled: true })
    }
    choices.push({ name: `  ${entry.name}`, value: entry.id, description: entry.id })
  }
  choices.push({ name: "Enter custom model ID", value: "__custom" })
  return choices
}

export function createModelSearchSource(modelsOutput: string) {
  const entries = modelEntries(modelsOutput)
  return (term: string | undefined) => {
    const query = term?.trim().toLowerCase()
    const filtered = query
      ? entries.filter((entry) => `${entry.id} ${entry.name} ${providerLabel(entry.provider)}`.toLowerCase().includes(query))
      : entries
    const choices: ModelChoice[] = []
    let current = ""
    for (const entry of filtered) {
      if (entry.provider !== current) {
        current = entry.provider
        choices.push({ name: providerLabel(current), value: `__separator_${current}`, disabled: true })
      }
      choices.push({ name: `  ${entry.name}`, value: entry.id, description: entry.id })
    }
    choices.push({ name: "Enter custom model ID", value: "__custom" })
    return choices
  }
}

async function createLegacyOnboardingConfig(input: { modelsOutput: string; ask: Ask }): Promise<RouterConfig> {
  const ids = modelIDs(input.modelsOutput)
  const routerDefault = pickDefault(ids, /mini|haiku|flash|fast|nano/i, defaultConfig.router.model!)
  const fastDefault = pickDefault(ids, /mini|haiku|flash|fast|nano/i, defaultConfig.tiers.fast.model!)
  const balancedDefault = pickDefault(ids, /sonnet|gpt-5|gpt-4|pro|medium/i, defaultConfig.tiers.balanced.model!)
  const largeDefault = pickDefault(ids, /opus|large|max|pro/i, defaultConfig.tiers.large.model!)

  const routerModel = resolveChoice(await input.ask(`Router model [${routerDefault}]: `), ids, routerDefault)
  const fastModel = resolveChoice(await input.ask(`Fast model [${fastDefault}]: `), ids, fastDefault)
  const balancedModel = resolveChoice(await input.ask(`Balanced model [${balancedDefault}]: `), ids, balancedDefault)
  const largeModel = resolveChoice(await input.ask(`Large model [${largeDefault}]: `), ids, largeDefault)

  const fastDescription = keepOrReplace(await input.ask(`Fast description [${defaultConfig.tiers.fast.description}]: `), defaultConfig.tiers.fast.description!)
  const fastWhen = keepOrReplace(await input.ask(`Fast whenToUse [${defaultConfig.tiers.fast.whenToUse}]: `), defaultConfig.tiers.fast.whenToUse!)
  const balancedDescription = keepOrReplace(await input.ask(`Balanced description [${defaultConfig.tiers.balanced.description}]: `), defaultConfig.tiers.balanced.description!)
  const balancedWhen = keepOrReplace(await input.ask(`Balanced whenToUse [${defaultConfig.tiers.balanced.whenToUse}]: `), defaultConfig.tiers.balanced.whenToUse!)
  const largeDescription = keepOrReplace(await input.ask(`Large description [${defaultConfig.tiers.large.description}]: `), defaultConfig.tiers.large.description!)
  const largeWhen = keepOrReplace(await input.ask(`Large whenToUse [${defaultConfig.tiers.large.whenToUse}]: `), defaultConfig.tiers.large.whenToUse!)

  const editPrompts = (await input.ask("Edit router prompts? [y/N]: ")).trim().toLowerCase()
  const system = editPrompts === "y" || editPrompts === "yes"
    ? keepOrReplace(await input.ask("Router system prompt: "), defaultConfig.router.prompts.system)
    : defaultConfig.router.prompts.system
  const userTemplate = editPrompts === "y" || editPrompts === "yes"
    ? keepOrReplace(await input.ask("Router user template ({tiers}, {request}): "), defaultConfig.router.prompts.userTemplate)
    : defaultConfig.router.prompts.userTemplate

  return mergeConfig(defaultConfig, {
    router: { model: routerModel, prompts: { system, userTemplate } },
    tiers: {
      fast: { model: fastModel, description: fastDescription, whenToUse: fastWhen },
      balanced: { model: balancedModel, description: balancedDescription, whenToUse: balancedWhen },
      large: { model: largeModel, description: largeDescription, whenToUse: largeWhen },
    },
  })
}

async function chooseModel(adapters: PromptAdapters, modelsOutput: string, message: string, fallback: string) {
  const ids = modelIDs(modelsOutput)
  const selected = adapters.search
    ? await adapters.search({ message, source: createModelSearchSource(modelsOutput), default: fallback })
    : await adapters.select({ message, choices: getModelSelectChoices(modelsOutput), default: fallback })
  const resolved = resolveChoice(selected, ids, fallback)
  if (resolved !== "__custom") return resolved
  return keepOrReplace(await adapters.input({ message: `${message} custom ID`, default: fallback }), fallback)
}

export async function createOnboardingConfig(input: { modelsOutput: string; ask: Ask } | ({ modelsOutput: string } & PromptAdapters)): Promise<RouterConfig> {
  if ("ask" in input) return createLegacyOnboardingConfig(input)
  const ids = modelIDs(input.modelsOutput)
  const routerDefault = pickDefault(ids, /mini|haiku|flash|fast|nano/i, defaultConfig.router.model!)
  const fastDefault = pickDefault(ids, /mini|haiku|flash|fast|nano/i, defaultConfig.tiers.fast.model!)
  const balancedDefault = pickDefault(ids, /sonnet|gpt-5|gpt-4|pro|medium/i, defaultConfig.tiers.balanced.model!)
  const largeDefault = pickDefault(ids, /opus|large|max|pro/i, defaultConfig.tiers.large.model!)

  const routerModel = await chooseModel(input, input.modelsOutput, "Router model", routerDefault)
  const fastModel = await chooseModel(input, input.modelsOutput, "Fast model", fastDefault)
  const balancedModel = await chooseModel(input, input.modelsOutput, "Balanced model", balancedDefault)
  const largeModel = await chooseModel(input, input.modelsOutput, "Large model", largeDefault)

  let fastDescription = defaultConfig.tiers.fast.description!
  let fastWhen = defaultConfig.tiers.fast.whenToUse!
  let balancedDescription = defaultConfig.tiers.balanced.description!
  let balancedWhen = defaultConfig.tiers.balanced.whenToUse!
  let largeDescription = defaultConfig.tiers.large.description!
  let largeWhen = defaultConfig.tiers.large.whenToUse!
  if (await input.confirm({ message: "Edit model descriptions and when-to-use guidance?", default: false })) {
    fastDescription = keepOrReplace(await input.input({ message: "Fast description", default: fastDescription }), fastDescription)
    fastWhen = keepOrReplace(await input.input({ message: "Fast when to use", default: fastWhen }), fastWhen)
    balancedDescription = keepOrReplace(await input.input({ message: "Balanced description", default: balancedDescription }), balancedDescription)
    balancedWhen = keepOrReplace(await input.input({ message: "Balanced when to use", default: balancedWhen }), balancedWhen)
    largeDescription = keepOrReplace(await input.input({ message: "Large description", default: largeDescription }), largeDescription)
    largeWhen = keepOrReplace(await input.input({ message: "Large when to use", default: largeWhen }), largeWhen)
  }

  let system = defaultConfig.router.prompts.system
  let userTemplate = defaultConfig.router.prompts.userTemplate
  if (await input.confirm({ message: "Edit router prompts?", default: false })) {
    system = keepOrReplace(await input.input({ message: "Router system prompt", default: system }), system)
    userTemplate = keepOrReplace(await input.input({ message: "Router user template", default: userTemplate }), userTemplate)
  }

  return mergeConfig(defaultConfig, {
    router: { model: routerModel, prompts: { system, userTemplate } },
    tiers: {
      fast: { model: fastModel, description: fastDescription, whenToUse: fastWhen },
      balanced: { model: balancedModel, description: balancedDescription, whenToUse: balancedWhen },
      large: { model: largeModel, description: largeDescription, whenToUse: largeWhen },
    },
  })
}
