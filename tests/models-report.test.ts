import { describe, expect, test } from "vitest"
import { buildModelsReport } from "../src/models-report.js"

describe("models report", () => {
  test("renders date, available models, providers, IDs, and config examples", () => {
    const markdown = buildModelsReport({
      generatedAt: new Date("2026-04-27T10:20:30.000Z"),
      modelsOutput: [
        "anthropic/claude-sonnet-4-5  Claude Sonnet 4.5",
        "openai/gpt-4o-mini  GPT 4o mini",
      ].join("\n"),
    })

    expect(markdown).toContain("# OpenCode Router Models")
    expect(markdown).toContain("Generated: 2026-04-27T10:20:30.000Z")
    expect(markdown).toContain("anthropic/claude-sonnet-4-5")
    expect(markdown).toContain("openai/gpt-4o-mini")
    expect(markdown).toContain("## Providers")
    expect(markdown).not.toContain("## Model IDs")
    expect(markdown).toContain("- `anthropic`")
    expect(markdown).toContain("- `openai`")
    expect(markdown).toContain('"fast"')
    expect(markdown).toContain('"balanced"')
    expect(markdown).toContain('"large"')
    expect(markdown).toContain('"router"')
    expect(markdown).toContain("## Advanced Optional Task-Oriented Configuration")
    expect(markdown).toContain("This is optional; the default setup above still routes by speed, cost, and model size.")
    expect(markdown).toContain("openai/gpt-5.5")
    expect(markdown).toContain("zai-coding-plan/glm-5.1")
    expect(markdown).toContain("deepinfra/DeepSeek-V4-Flash")
    expect(markdown).toContain("complex debugging, integration work, backend and full-stack implementation")
    expect(markdown).toContain("web design, polished frontend artifacts, interactive pages, and long agentic engineering tasks")
    expect(markdown).toContain("router decisions, file reading, codebase study, documentation study, and documentation writing")
    expect(markdown).toContain("Tier names are configurable slots")
  })

  test("formats verbose models by provider without raw output block", () => {
    const markdown = buildModelsReport({
      generatedAt: new Date("2026-04-27T10:20:30.000Z"),
      modelsOutput: [
        "opencode/claude-haiku-4-5",
        JSON.stringify({
          id: "claude-haiku-4-5",
          providerID: "opencode",
          name: "Claude Haiku 4.5",
          limit: { context: 200000, output: 8192 },
          cost: { input: 1, output: 5 },
          capabilities: { reasoning: true, toolcall: true, attachment: false },
        }, null, 2),
        "anthropic/claude-sonnet-4-5",
        JSON.stringify({
          id: "claude-sonnet-4-5",
          providerID: "anthropic",
          name: "Claude Sonnet 4.5",
          limit: { context: 200000, output: 64000 },
          cost: { input: 3, output: 15 },
          capabilities: { reasoning: true, toolcall: true, attachment: true },
        }, null, 2),
      ].join("\n"),
    })

    expect(markdown).not.toContain("Raw output")
    expect(markdown).not.toContain("```text")
    expect(markdown).toContain("### Provider: `anthropic`")
    expect(markdown).toContain("### Provider: `opencode`")
    expect(markdown).toContain("| Model ID | Name | Context | Output | Input $/M | Output $/M | Capabilities |")
    expect(markdown).toContain("`anthropic/claude-sonnet-4-5`")
    expect(markdown).toContain("Claude Sonnet 4.5")
    expect(markdown).toContain("reasoning, tools, attachments")
  })
})
