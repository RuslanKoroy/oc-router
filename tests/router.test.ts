import { describe, expect, test } from "vitest"
import { defaultConfig } from "../src/config.js"
import { routeMessage } from "../src/router.js"

const completeConfig = {
  ...defaultConfig,
  router: { ...defaultConfig.router, model: "openai/gpt-4o-mini" },
  tiers: {
    fast: { model: "openai/gpt-4o-mini", description: "quick" },
    balanced: { model: "anthropic/claude-sonnet-4-5", description: "daily" },
    large: { model: "anthropic/claude-opus-4-5", description: "hard" },
  },
}

describe("routeMessage", () => {
  test("uses forced tier prefixes and strips them", async () => {
    const result = await routeMessage({ config: completeConfig, text: "/large refactor this", router: async () => ({ tier: "fast", confidence: 1, reason: "ignored", signals: [] }) })

    expect(result.tier).toBe("large")
    expect(result.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-5" })
    expect(result.text).toBe("refactor this")
  })

  test("leaves message unchanged when disabled", async () => {
    const result = await routeMessage({ config: { ...completeConfig, enabled: false }, text: "hello", router: async () => ({ tier: "large", confidence: 1, reason: "ignored", signals: [] }) })

    expect(result.changed).toBe(false)
  })

  test("uses router JSON decisions", async () => {
    const result = await routeMessage({ config: completeConfig, text: "fix typo", router: async () => ({ tier: "fast", confidence: 0.9, reason: "small edit", signals: ["small"] }) })

    expect(result.tier).toBe("fast")
    expect(result.reason).toBe("small edit")
  })

  test("falls back on invalid router decisions", async () => {
    const result = await routeMessage({ config: completeConfig, text: "build app", router: async () => ({ tier: "tiny", confidence: 0.9, reason: "bad", signals: [] }) })

    expect(result.tier).toBe("balanced")
    expect(result.fallback).toBe(true)
  })

  test("falls back on low confidence", async () => {
    const result = await routeMessage({ config: completeConfig, text: "unclear", router: async () => ({ tier: "fast", confidence: 0.2, reason: "uncertain", signals: [] }) })

    expect(result.tier).toBe("balanced")
    expect(result.fallback).toBe(true)
  })

  test("falls back when router throws", async () => {
    const result = await routeMessage({ config: completeConfig, text: "debug", router: async () => { throw new Error("network") } })

    expect(result.tier).toBe("balanced")
    expect(result.fallback).toBe(true)
  })
})
