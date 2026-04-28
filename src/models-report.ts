import { spawnSync } from "node:child_process"

export function listOpenCodeModels(cwd: string) {
  const result = spawnSync("opencode", ["models", "--verbose"], { cwd, encoding: "utf8", timeout: 10_000 })
  if (result.error) return "Unable to run `opencode models --verbose`. Is OpenCode installed and available in PATH?"
  return (result.stdout || result.stderr || "No models returned by `opencode models --verbose`.").trim()
}

function extractModelIDs(modelsOutput: string) {
  const ids = new Set<string>()
  for (const match of modelsOutput.matchAll(/\b([a-zA-Z0-9_.-]+\/[\w./:-]+)\b/g)) ids.add(match[1])
  return [...ids].sort()
}

type ModelInfo = {
  id: string
  provider: string
  name: string
  context?: number
  output?: number
  inputCost?: number
  outputCost?: number
  capabilities: string[]
}

function providerFromModelID(id: string) {
  return id.slice(0, id.indexOf("/"))
}

function parseJsonAfter(lines: string[], start: number) {
  const chunks: string[] = []
  let depth = 0
  let started = false
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (!started && !line.trim().startsWith("{")) continue
    started = true
    chunks.push(line)
    for (const char of line) {
      if (char === "{") depth++
      if (char === "}") depth--
    }
    if (started && depth === 0) return { json: chunks.join("\n"), end: i }
  }
  return undefined
}

function capabilityLabels(value: any) {
  const caps = value?.capabilities ?? {}
  const labels: string[] = []
  if (caps.reasoning) labels.push("reasoning")
  if (caps.toolcall) labels.push("tools")
  if (caps.attachment) labels.push("attachments")
  if (caps.input?.image) labels.push("images")
  if (caps.input?.pdf) labels.push("pdf")
  return labels
}

function parseModels(modelsOutput: string): ModelInfo[] {
  const lines = modelsOutput.split(/\r?\n/)
  const models = new Map<string, ModelInfo>()
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(/^([a-zA-Z0-9_.-]+\/[\w./:-]+)\b(.*)$/)
    if (!match) continue
    const fullID = match[1]
    const provider = providerFromModelID(fullID)
    const parsed = parseJsonAfter(lines, i + 1)
    if (parsed) {
      try {
        const data = JSON.parse(parsed.json)
        models.set(fullID, {
          id: fullID,
          provider: data.providerID ?? provider,
          name: data.name ?? data.id ?? fullID,
          context: data.limit?.context,
          output: data.limit?.output,
          inputCost: data.cost?.input,
          outputCost: data.cost?.output,
          capabilities: capabilityLabels(data),
        })
        i = parsed.end
        continue
      } catch {
        // Fall through to compact line parsing.
      }
    }
    models.set(fullID, {
      id: fullID,
      provider,
      name: match[2].trim() || fullID.slice(fullID.indexOf("/") + 1),
      capabilities: [],
    })
  }
  return [...models.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id))
}

function formatNumber(value: number | undefined) {
  return value === undefined ? "-" : String(value)
}

function tableForProvider(models: ModelInfo[]) {
  return [
    "| Model ID | Name | Context | Output | Input $/M | Output $/M | Capabilities |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...models.map((model) => `| \`${model.id}\` | ${model.name} | ${formatNumber(model.context)} | ${formatNumber(model.output)} | ${formatNumber(model.inputCost)} | ${formatNumber(model.outputCost)} | ${model.capabilities.join(", ") || "-"} |`),
  ].join("\n")
}

export function buildModelsReport(input: { generatedAt?: Date; modelsOutput: string }) {
  const generatedAt = input.generatedAt ?? new Date()
  const models = parseModels(input.modelsOutput)
  const modelIDs = models.length ? models.map((model) => model.id) : extractModelIDs(input.modelsOutput)
  const providers = [...new Set((models.length ? models.map((model) => model.provider) : modelIDs.map(providerFromModelID)))].sort()
  const fast = modelIDs.find((id) => /mini|haiku|flash|small|lite|fast/i.test(id)) ?? modelIDs[0] ?? "provider/fast-model"
  const balanced = modelIDs.find((id) => /sonnet|gpt-5|gpt-4|pro|medium/i.test(id)) ?? modelIDs[1] ?? fast
  const large = modelIDs.find((id) => /opus|large|max|xhigh/i.test(id)) ?? modelIDs[2] ?? balanced
  const grouped = providers.map((provider) => {
    const items = models.filter((model) => model.provider === provider)
    return `### Provider: \`${provider}\`\n\n${items.length ? tableForProvider(items) : "No structured model details detected for this provider."}`
  }).join("\n\n")

  return `# OpenCode Router Models

Generated: ${generatedAt.toISOString()}

## Available OpenCode Models

${grouped || "No models detected. Run `opencode models --verbose` after configuring providers."}

## Providers

${providers.length ? providers.map((provider) => `- \`${provider}\``).join("\n") : "- No providers detected."}

## Example Configuration

Copy this into your router config and adjust model IDs as needed:

\`\`\`json
{
  "router": {
    "model": "${fast}",
    "prompts": {
      "system": "Classify each OpenCode user request into exactly one model tier: fast, balanced, or large. Return only JSON matching the router decision schema.",
      "userTemplate": "Available tiers:\\n{tiers}\\n\\nRequest:\\n{request}"
    }
  },
  "tiers": {
    "fast": {
      "model": "${fast}",
      "description": "fast model for lightweight OpenCode work",
      "whenToUse": "Use only for reading and studying code, simple commands, quick searches, summaries, and low-risk exploration."
    },
    "balanced": {
      "model": "${balanced}",
      "description": "default model for day-to-day OpenCode work",
      "whenToUse": "Use by default for normal development tasks, routine edits, ordinary debugging, tests, and documentation."
    },
    "large": {
      "model": "${large}",
      "description": "most capable model for high-value reasoning and implementation",
      "whenToUse": "Use for architecture, research, complex debugging, difficult problems, non-obvious solutions, high-quality code generation, and security-sensitive changes."
    }
  },
  "fallbackTier": "balanced"
}
\`\`\`

## Advanced Optional Task-Oriented Configuration

This is optional; the default setup above still routes by speed, cost, and model size. Use this variant if you want the three tier slots to mean "best model for this kind of work" instead of "small / medium / large".

Tier names are configurable slots. In this preset, \`fast\` means the router/context specialist, \`balanced\` means the frontend/design/agentic-engineering specialist, and \`large\` means the hardest backend/debugging specialist.

Copy this into your router config and adjust provider/model IDs if your local names differ:

\`\`\`json
{
  "router": {
    "model": "deepinfra/DeepSeek-V4-Flash",
    "prompts": {
      "system": "Classify each OpenCode user request into exactly one configured tier: fast, balanced, or large. Tier names are configurable slots, not speed labels. Follow the tier descriptions and whenToUse text. Return only JSON matching the router decision schema.",
      "userTemplate": "Available configured tiers:\\n{tiers}\\n\\nRequest:\\n{request}"
    }
  },
  "tiers": {
    "fast": {
      "model": "deepinfra/DeepSeek-V4-Flash",
      "description": "router and codebase-context model",
      "whenToUse": "Use for router decisions, file reading, codebase study, documentation study, and documentation writing; also use for summaries, search-heavy exploration, and preparing CONTEXT HANDOFF blocks for downstream agents."
    },
    "balanced": {
      "model": "zai-coding-plan/glm-5.1",
      "description": "frontend, design, and long-running engineering model",
      "whenToUse": "Use for web design, polished frontend artifacts, interactive pages, and long agentic engineering tasks; also use for UI/UX work, creative implementation, broad but not backend-critical changes, and high-quality user-facing pages."
    },
    "large": {
      "model": "openai/gpt-5.5",
      "description": "complex debugging, integration, backend, and full-stack model",
      "whenToUse": "Use for complex debugging, integration work, backend and full-stack implementation, architecture, security-sensitive changes, difficult reasoning, cross-service problems, migrations, and work where subtle correctness matters."
    }
  },
  "fallbackTier": "balanced"
}
\`\`\`

## CLI Examples

\`\`\`bash
oc-router config set router.model ${fast}
oc-router config set tiers.fast.model ${fast}
oc-router config set tiers.balanced.model ${balanced}
oc-router config set tiers.large.model ${large}
oc-router status
\`\`\`
`
}
