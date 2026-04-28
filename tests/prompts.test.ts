import { describe, expect, test } from "vitest"
import { defaultConfig } from "../src/config.js"
import { buildRouterPrompt } from "../src/prompts.js"

describe("router prompts", () => {
  test("treats tier names as configurable slots and prioritizes configured usage text", () => {
    const prompt = buildRouterPrompt({
      ...defaultConfig,
      tiers: {
        fast: {
          model: "deepinfra/DeepSeek-V4-Flash",
          description: "router and codebase-study model",
          whenToUse: "router decisions, file reading, codebase study, documentation study, and documentation writing",
        },
        balanced: {
          model: "zai-coding-plan/glm-5.1",
          description: "frontend and long-running engineering model",
          whenToUse: "web design, polished frontend artifacts, interactive pages, and long agentic engineering tasks",
        },
        large: {
          model: "openai/gpt-5.5",
          description: "backend and complex-debugging model",
          whenToUse: "complex debugging, integration work, backend and full-stack implementation",
        },
      },
    }, "Build an interactive landing page")

    expect(prompt).toContain("Tier names are configurable slots")
    expect(prompt).toContain("Follow each tier's description and whenToUse text over generic assumptions")
    expect(prompt).toContain("web design, polished frontend artifacts, interactive pages")
    expect(prompt).toContain("complex debugging, integration work, backend and full-stack implementation")
  })

  test("tells the router that file writes must not use the fast tier", () => {
    const prompt = buildRouterPrompt(defaultConfig, "Create a file named notes.md")

    expect(prompt).toContain("Never choose fast for requests that create, edit, write, patch, or delete files")
  })
})
