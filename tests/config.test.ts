import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { defaultConfig, loadRouterConfig, setEnabled, validateRouterConfig, writeRouterConfig } from "../src/config.js"

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "oc-router-"))
}

describe("router config", () => {
  test("provides safe defaults", () => {
    expect(defaultConfig.enabled).toBe(true)
    expect(defaultConfig.mode).toBe("auto")
    expect(defaultConfig.fallbackTier).toBe("balanced")
    expect(defaultConfig.display.injectMessage).toBe(true)
    expect(defaultConfig.router.prompts.system).toContain("Classify")
    expect(defaultConfig.router.model).toBe("provider/router-model")
    expect(defaultConfig.tiers.fast.model).toBe("provider/fast-model")
    expect(defaultConfig.tiers.fast.description).toBeTruthy()
    expect(defaultConfig.tiers.fast.whenToUse).toContain("reading")
    expect(defaultConfig.tiers.balanced.model).toBe("provider/balanced-model")
    expect(defaultConfig.tiers.balanced.whenToUse).toContain("default")
    expect(defaultConfig.tiers.large.model).toBe("provider/large-model")
    expect(defaultConfig.tiers.large.whenToUse).toContain("architecture")
  })

  test("merges global and project config", () => {
    const root = tempRoot()
    const globalPath = join(root, "global.json")
    const projectPath = join(root, "project.json")
    writeFileSync(globalPath, JSON.stringify({ tiers: { fast: { model: "openai/gpt-4o-mini" } } }))
    writeFileSync(projectPath, JSON.stringify({ fallbackTier: "large", tiers: { large: { model: "openai/gpt-5" } } }))

    const loaded = loadRouterConfig({ globalPath, projectPath })

    expect(loaded.config.tiers.fast.model).toBe("openai/gpt-4o-mini")
    expect(loaded.config.tiers.large.model).toBe("openai/gpt-5")
    expect(loaded.config.fallbackTier).toBe("large")
  })

  test("validates required models when enabled", () => {
    const result = validateRouterConfig(defaultConfig)
    expect(result.ok).toBe(true)
  })

  test("accepts complete enabled config", () => {
    const result = validateRouterConfig({
      ...defaultConfig,
      router: { ...defaultConfig.router, model: "openai/gpt-4o-mini" },
      tiers: {
        fast: { model: "openai/gpt-4o-mini" },
        balanced: { model: "anthropic/claude-sonnet-4-5" },
        large: { model: "anthropic/claude-opus-4-5" },
      },
    })
    expect(result).toEqual({ ok: true, errors: [] })
  })

  test("writes config and toggles enabled", () => {
    const root = tempRoot()
    const configPath = join(root, "router.json")
    writeRouterConfig(configPath, { ...defaultConfig, enabled: true })
    setEnabled(configPath, false)

    expect(JSON.parse(readFileSync(configPath, "utf8")).enabled).toBe(false)
  })
})
