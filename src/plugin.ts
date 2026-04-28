import type { Plugin } from "@opencode-ai/plugin"
import { loadRouterConfig, mergeConfig } from "./config.js"
import { formatActiveModelLabel, injectRoutingBanner, showRoutingToast } from "./display.js"
import { parseModelID } from "./model-id.js"
import { buildRouterPrompt } from "./prompts.js"
import { routeMessage, type RouterCall } from "./router.js"
import type { PartialRouterConfig, RouterConfig, RoutingResult, Tier } from "./types.js"

type Options = {
  config?: PartialRouterConfig
  router?: RouterCall
}

function textFromParts(parts: any[]): string {
  return parts.filter((part) => part.type === "text" && typeof part.text === "string" && !part.synthetic).map((part) => part.text).join("\n")
}

function replaceFirstTextPart(parts: any[], text: string) {
  const part = parts.find((item) => item.type === "text" && typeof item.text === "string" && !item.synthetic)
  if (part) part.text = text
}

function configuredTiers(config: RouterConfig) {
  return (Object.entries(config.tiers) as Array<[Tier, RouterConfig["tiers"][Tier]]>).filter(([, tier]) => tier.model)
}

function buildDelegationProtocol(config: RouterConfig) {
  const tiers = configuredTiers(config)
    .map(([name, tier]) => `@${name} -> ${tier.model}: ${tier.description ?? ""} Use when: ${tier.whenToUse ?? ""}`.trim())
    .join("\n")
  return [
    "## Model Delegation Protocol — MANDATORY",
    "You are the orchestrator, not the executor. The user installed OpenCode Router specifically so work is delegated to cheaper or stronger tier models.",
    "Tier names are configurable slots. Follow each tier's description and Use when text over generic assumptions from the names fast, balanced, and large.",
    "BEFORE using read, grep, glob, list, bash, edit, write, or apply_patch, decide the tier and dispatch the matching subagent unless this is final synthesis only.",
    "If you do the work yourself instead of delegating, you are violating the user's routing requirement.",
    "",
    "Available tier subagents:",
    tiers,
    "",
    "Routing rules:",
    '- Choose the best configured tier from the descriptions above, then dispatch it with Task(subagent_type="fast" | "balanced" | "large", prompt="...").',
    "- Never dispatch fast for requests that create, edit, write, patch, or delete files; choose balanced or large instead.",
    "- Do not launch multiple subagents in parallel. Dispatch exactly one tier subagent at a time, then wait for its result before deciding the next dispatch.",
    "- Keep only orchestration, decomposition, and final synthesis in the primary conversation.",
    "- If the user explicitly says not to delegate, obey the user and work directly.",
    "- Every final answer must state which model wrote it using [model: provider/model].",
    "",
    "### Context handoff rules",
    "For any request where balanced or large may need file context, first dispatch fast to discover relevant files and produce CONTEXT HANDOFF.",
    "When @fast returns a CONTEXT HANDOFF block, copy the CONTEXT HANDOFF block verbatim into the balanced or large prompt.",
    "Never dispatch balanced or large for file-dependent work without including CONTEXT HANDOFF, unless the user's prompt already contains all required file context.",
    "Do not ask balanced or large to reread files already listed in FILES READ unless exact current contents are needed for an edit, the handoff is incomplete, or state may have changed.",
    "If balanced or large rereads a listed file, require it to include REREAD REASON: <why the handoff was insufficient> in its response.",
    "The subagent prompt must include provenance: file paths, line numbers when available, and the exact snippets/facts already discovered.",
  ].join("\n")
}

function buildTierAgentPrompt(name: Tier, tier: RouterConfig["tiers"][Tier]) {
  const handoffRules = name === "fast"
    ? [
      "Do not create, edit, write, or patch files. Do not use bash to modify files.",
      "Return a CONTEXT HANDOFF block that downstream agents can reuse without rereading the same files.",
      "Use this exact format:",
      "CONTEXT HANDOFF",
      "FILES READ:",
      "- path:line-line - why it mattered",
      "RELEVANT SNIPPETS:",
      "- path:line-line",
      "  ```",
      "  exact relevant snippet or concise excerpt",
      "  ```",
      "FACTS:",
      "- concrete fact learned from the files, with path:line provenance",
      "RISKS / UNKNOWN:",
      "- what was not verified or may need a stronger tier",
      "NEXT DISPATCH PROMPT:",
      "- a ready-to-paste prompt for @balanced or @large that includes this handoff and the next action",
    ]
    : [
      "If the prompt contains CONTEXT HANDOFF, use it as your primary context before reading files.",
      "If the prompt already contains all required instructions for a new file, create or write that file directly without requesting CONTEXT HANDOFF.",
      "Do not reread files listed under FILES READ just to understand the task.",
      "Only reread a listed file if exact current contents are needed for editing, the handoff is incomplete, or state may have changed.",
      "If you reread a listed file, include REREAD REASON: <specific reason> in your response.",
      "If the prompt does not contain CONTEXT HANDOFF and the task requires reading existing project files before you can safely proceed, do not read files. Respond with MISSING CONTEXT HANDOFF and explain that @router must first dispatch @fast.",
    ]
  return [
    `You are @${name}, an OpenCode Router tier agent running on ${tier.model}.`,
    tier.whenToUse ? `Use this tier for: ${tier.whenToUse}` : undefined,
    "Do the assigned work directly and report concise results.",
    ...handoffRules,
    "Prefix your final response with [model: provider/model].",
    "Do not delegate further.",
  ].filter(Boolean).join("\n")
}

function tierPermission(name: Tier) {
  return name === "fast"
    ? { read: "allow", grep: "allow", glob: "allow", list: "allow", bash: "allow", edit: "deny", write: "deny", apply_patch: "deny", task: "deny" }
    : { "*": "allow", task: "deny" }
}

function buildRouterAgentPrompt(config: RouterConfig) {
  return [
    `You are @router, the default Router agent for OpenCode Router running on ${config.router.model}.`,
    buildDelegationProtocol(config),
    "Use only the task tool for work that requires exploration, commands, edits, tests, or implementation.",
    "Keep only routing, decomposition, context handoff, and final synthesis in this primary conversation.",
  ].join("\n\n")
}

function modelLabel(input: any) {
  const providerID = input.provider?.info?.id ?? input.model?.providerID
  const modelID = input.model?.id ?? input.model?.modelID
  if (providerID && modelID) return `${providerID}/${modelID}`
  if (typeof input.model?.id === "string") return input.model.id
  return undefined
}

function forcedRoutingResult(config: RouterConfig, text: string): RoutingResult | undefined {
  const trimmed = text.trimStart()
  for (const item of config.routing.forceTierPrefixes) {
    if (!trimmed.startsWith(item.prefix)) continue
    const modelID = config.tiers[item.tier].model
    if (!modelID) return undefined
    return {
      changed: true,
      tier: item.tier,
      model: parseModelID(modelID),
      text: trimmed.slice(item.prefix.length).trimStart(),
      reason: `forced by ${item.tier} prefix`,
      signals: [],
      fallback: false,
    }
  }
  return undefined
}

export const OpenCodeRouterPlugin: Plugin = async (ctx, options?: Options) => {
  let config: RouterConfig = mergeConfig(loadRouterConfig({ projectPath: `${ctx.worktree}/.opencode/router.json` }).config, options?.config)
  const router = options?.router
  const sessionModels = new Map<string, string>()
  const subagentSessions = new Set<string>()

  return {
    config(input) {
      config = mergeConfig(loadRouterConfig({ projectPath: `${ctx.worktree}/.opencode/router.json` }).config, options?.config, (input as any).router)
      ;(input as any).agent ??= {}
      ;(input as any).default_agent = "router"
      ;(input as any).agent.router = {
        model: config.router.model,
        mode: "primary",
        description: "OpenCode Router default agent that delegates each request to fast, balanced, or large",
        permission: {
          read: "deny",
          grep: "deny",
          glob: "deny",
          list: "deny",
          bash: "deny",
          edit: "deny",
          write: "deny",
          apply_patch: "deny",
          task: "allow",
        },
        prompt: buildRouterAgentPrompt(config),
      }
      for (const [name, tier] of configuredTiers(config)) {
        ;(input as any).agent[name] = {
          model: tier.model,
          mode: "subagent",
          description: tier.description,
          permission: tierPermission(name),
          prompt: buildTierAgentPrompt(name, tier),
        }
      }
      return Promise.resolve()
    },
    async "chat.params"(input) {
      const label = modelLabel(input)
      if (label) sessionModels.set(input.sessionID, label)
    },
    async "experimental.chat.system.transform"(input, output) {
      if (input.sessionID && subagentSessions.has(input.sessionID)) return
      output.system.push(buildDelegationProtocol(config))
    },
    async "experimental.text.complete"(input, output) {
      const label = input.sessionID ? sessionModels.get(input.sessionID) : undefined
      if (!label || !output.text || output.text.includes(formatActiveModelLabel(label))) return
      output.text = `${formatActiveModelLabel(label)}\n${output.text}`
    },
    async "tool.execute.after"(input, output) {
      const label = sessionModels.get(input.sessionID)
      if (!label || typeof output.output !== "string" || output.output.includes(formatActiveModelLabel(label))) return
      output.output = `${output.output}\n\n${formatActiveModelLabel(label)}`
    },
    async "chat.message"(input, output) {
      try {
        if (input.agent && configuredTiers(config).some(([name]) => name === input.agent)) subagentSessions.add(input.sessionID)
        const text = textFromParts(output.parts)
        const prompt = buildRouterPrompt(config, text)
        const result = router ? await routeMessage({ config, text, prompt, router }) : forcedRoutingResult(config, text)
        if (!result || !result.changed || !result.model) return

        output.message.model = result.model
        if (result.text !== text) replaceFirstTextPart(output.parts, result.text)
        injectRoutingBanner(output, result, config)
        await showRoutingToast(ctx.client as any, result, config)
        await ctx.client.app?.log?.({
          body: {
            service: "oc-router",
            level: "info",
            message: "routed message",
            extra: { sessionID: input.sessionID, tier: result.tier, model: result.model, fallback: result.fallback },
          },
        })
      } catch (error) {
        await ctx.client.app?.log?.({
          body: {
            service: "oc-router",
            level: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        })
      }
    },
  }
}
