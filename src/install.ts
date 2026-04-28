import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { defaultConfig, globalConfigPath, mergeConfig, projectConfigPath, writeRouterConfig } from "./config.js"
import { buildModelsReport, listOpenCodeModels } from "./models-report.js"
import type { RouterConfig, Tier } from "./types.js"

function readJson(path: string): any {
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function ensureOpenCodePlugin(path: string, pluginName = "oc-router") {
  const config = readJson(path)
  const current = Array.isArray(config.plugin) ? config.plugin : []
  const legacyPluginName = ["opencode", "router"].join("-")
  config.plugin = current.filter((item: unknown) => item !== pluginName && item !== legacyPluginName)
  config.default_agent = "router"
  writeJson(path, config)
}

export function writeOpenCodePluginFile(directory: string, pluginEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url))) {
  mkdirSync(directory, { recursive: true })
  const href = pathToFileURL(pluginEntry).href
  writeFileSync(join(directory, "oc-router.js"), `export { server as OpenCodeRouterPlugin } from ${JSON.stringify(href)}\n`)
}

export function writeOpenCodeCommands(directory: string) {
  mkdirSync(directory, { recursive: true })
  const commands: Record<string, string> = {
    "router-status.md": "---\ndescription: Show oc-router status\n---\n!`oc-router status`\n",
    "router-models.md": "---\ndescription: List models for oc-router\n---\n!`oc-router models`\n",
    "router-fast.md": "---\ndescription: Force fast model tier\n---\n/fast $ARGUMENTS\n",
    "router-balanced.md": "---\ndescription: Force balanced model tier\n---\n/balanced $ARGUMENTS\n",
    "router-large.md": "---\ndescription: Force large model tier\n---\n/large $ARGUMENTS\n",
  }
  for (const [name, content] of Object.entries(commands)) writeFileSync(join(directory, name), content)
}

export function writeOpenCodeAgentFiles(directory: string, config: RouterConfig) {
  mkdirSync(directory, { recursive: true })
  const tierLines = (["fast", "balanced", "large"] as Tier[])
    .map((tier) => {
      const item = config.tiers[tier]
      return `@${tier} -> ${item.model}: ${item.description ?? ""} Use when: ${item.whenToUse ?? ""}`.trim()
    })
  const routerBody = [
    "---",
    "description: OpenCode Router default agent that delegates each request to fast, balanced, or large",
    "mode: primary",
    `model: ${config.router.model}`,
    "permission:",
    "  read: deny",
    "  grep: deny",
    "  glob: deny",
    "  list: deny",
    "  bash: deny",
    "  edit: deny",
    "  write: deny",
    "  apply_patch: deny",
    "  task: allow",
    "---",
    `You are @router, the default Router agent for OpenCode Router running on ${config.router.model}.`,
    "You are the orchestrator, not the executor.",
    "Tier names are configurable slots. Follow each tier's description and Use when text over generic assumptions from the names fast, balanced, and large.",
    "Configured tier policy:",
    ...tierLines,
    "Delegate all exploration, command execution, edits, tests, and implementation to @fast, @balanced, or @large using the task tool.",
    "Never dispatch @fast for requests that create, edit, write, patch, or delete files; choose @balanced or @large instead.",
    "Do not launch multiple subagents in parallel. Dispatch exactly one tier subagent at a time, then wait for its result before deciding the next dispatch.",
    "For any request where @balanced or @large may need file context, first dispatch @fast to discover relevant files and produce CONTEXT HANDOFF.",
    "If @fast returns a CONTEXT HANDOFF block, copy it verbatim into the @balanced or @large prompt.",
    "Never dispatch @balanced or @large for file-dependent work without including CONTEXT HANDOFF, unless the user's prompt already contains all required file context.",
    "Keep only routing, decomposition, context handoff, and final synthesis in this primary conversation.",
    "Prefix your final response with [model: provider/model].",
  ].join("\n")
  writeFileSync(join(directory, "router.md"), `${routerBody}\n`)

  for (const tier of ["fast", "balanced", "large"] as Tier[]) {
    const item = config.tiers[tier]
    if (!item.model) continue
    const permissions = tier === "fast"
      ? "permission:\n  read: allow\n  grep: allow\n  glob: allow\n  list: allow\n  bash: allow\n  edit: deny\n  write: deny\n  apply_patch: deny\n  task: deny"
      : "permission:\n  '*': allow\n  task: deny"
    const handoffRules = tier === "fast"
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
    const body = [
      "---",
      `description: ${item.description ?? `${tier} OpenCode Router tier`}`,
      "mode: subagent",
      `model: ${item.model}`,
      permissions,
      "---",
      `You are @${tier}, an OpenCode Router tier agent running on ${item.model}.`,
      item.whenToUse ? `Use this tier for: ${item.whenToUse}` : undefined,
      "Do the assigned work directly and report concise results.",
      ...handoffRules,
      "Prefix your final response with [model: provider/model].",
      "Do not delegate further.",
    ].filter(Boolean).join("\n")
    writeFileSync(join(directory, `${tier}.md`), `${body}\n`)
  }
}

function reportPath(cwd: string, scope: "project" | "global") {
  return scope === "project" ? join(cwd, ".opencode", "router-models.md") : join(process.env.HOME ?? "", ".config", "oc-router", "models.md")
}

export function installRouter(input: { cwd: string; scope: "project" | "global"; yes: boolean; modelsOutput?: string; config?: RouterConfig }) {
  const routerPath = input.scope === "project" ? projectConfigPath(input.cwd) : globalConfigPath()
  const config = input.config ?? (existsSync(routerPath) ? mergeConfig(readJson(routerPath)) : defaultConfig)
  writeRouterConfig(routerPath, config)
  const modelsReportPath = reportPath(input.cwd, input.scope)
  mkdirSync(dirname(modelsReportPath), { recursive: true })
  writeFileSync(modelsReportPath, buildModelsReport({ modelsOutput: input.modelsOutput ?? listOpenCodeModels(input.cwd) }))

  if (input.scope === "project") {
    ensureOpenCodePlugin(join(input.cwd, "opencode.json"))
    writeOpenCodePluginFile(join(input.cwd, ".opencode", "plugins"))
    writeOpenCodeAgentFiles(join(input.cwd, ".opencode", "agents"), config)
    writeOpenCodeCommands(join(input.cwd, ".opencode", "commands"))
  } else {
    const globalOpenCode = join(process.env.HOME ?? "", ".config", "opencode", "opencode.json")
    ensureOpenCodePlugin(globalOpenCode)
    writeOpenCodePluginFile(join(process.env.HOME ?? "", ".config", "opencode", "plugins"))
    writeOpenCodeAgentFiles(join(process.env.HOME ?? "", ".config", "opencode", "agents"), config)
  }
  return { routerPath, modelsReportPath }
}
