import { describe, expect, test } from "vitest"
import { createModelSearchSource, createOnboardingConfig, getModelSelectChoices, renderModelChoices } from "../src/onboarding.js"

const modelsOutput = [
  "openai/gpt-5.4-mini GPT-5.4 mini",
  "opencode/claude-sonnet-4-5 Claude Sonnet 4.5",
  "opencode/claude-opus-4-5 Claude Opus 4.5",
].join("\n")

describe("onboarding", () => {
  test("renders numbered model choices", () => {
    const choices = renderModelChoices(modelsOutput)
    expect(choices).toContain("1. openai/gpt-5.4-mini")
    expect(choices).toContain("2. opencode/claude-opus-4-5")
    expect(choices).toContain("3. opencode/claude-sonnet-4-5")
  })

  test("builds arrow-select choices grouped by provider", () => {
    const choices = getModelSelectChoices(modelsOutput)

    expect(choices[0]).toEqual({ name: "OpenAI", value: "__separator_openai", disabled: true })
    expect(choices[1]).toMatchObject({ name: "  GPT-5.4 mini", value: "openai/gpt-5.4-mini" })
    expect(choices.some((choice) => choice.name === "OpenCode" && choice.disabled === true)).toBe(true)
    expect(choices.at(-1)).toEqual({ name: "Enter custom model ID", value: "__custom" })
  })

  test("filters searchable model choices by model name or ID", async () => {
    const source = createModelSearchSource(modelsOutput)

    const byName = await source("sonnet")
    const byId = await source("gpt-5.4")

    expect(byName).toEqual([
      { name: "OpenCode", value: "__separator_opencode", disabled: true },
      { name: "  Claude Sonnet 4.5", value: "opencode/claude-sonnet-4-5", description: "opencode/claude-sonnet-4-5" },
      { name: "Enter custom model ID", value: "__custom" },
    ])
    expect(byId).toContainEqual({ name: "  GPT-5.4 mini", value: "openai/gpt-5.4-mini", description: "openai/gpt-5.4-mini" })
  })

  test("creates config through select/input/confirm prompt adapters", async () => {
    const selected = ["openai/gpt-5.4-mini", "openai/gpt-5.4-mini", "opencode/claude-sonnet-4-5", "opencode/claude-opus-4-5"]
    const inputs = ["", "", "", "", "", ""]
    const config = await createOnboardingConfig({
      modelsOutput,
      select: async () => selected.shift()!,
      input: async () => inputs.shift() ?? "",
      confirm: async () => false,
    })

    expect(config.router.model).toBe("openai/gpt-5.4-mini")
    expect(config.tiers.balanced.model).toBe("opencode/claude-sonnet-4-5")
    expect(config.tiers.large.model).toBe("opencode/claude-opus-4-5")
  })

  test("creates config from selected models and optional custom text", async () => {
    const answers = [
      "1",
      "1",
      "3",
      "2",
      "Custom fast description",
      "Custom fast use",
      "",
      "",
      "",
      "",
      "yes",
      "Custom system prompt",
      "Custom {tiers} / {request}",
    ]
    const config = await createOnboardingConfig({ modelsOutput, ask: async () => answers.shift() ?? "" })

    expect(config.router.model).toBe("openai/gpt-5.4-mini")
    expect(config.tiers.fast.model).toBe("openai/gpt-5.4-mini")
    expect(config.tiers.balanced.model).toBe("opencode/claude-sonnet-4-5")
    expect(config.tiers.large.model).toBe("opencode/claude-opus-4-5")
    expect(config.tiers.fast.description).toBe("Custom fast description")
    expect(config.tiers.fast.whenToUse).toBe("Custom fast use")
    expect(config.router.prompts.system).toBe("Custom system prompt")
    expect(config.router.prompts.userTemplate).toBe("Custom {tiers} / {request}")
  })
})
