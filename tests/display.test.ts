import { describe, expect, test, vi } from "vitest"
import { defaultConfig } from "../src/config.js"
import { formatRoutingBanner, injectRoutingBanner, showRoutingToast } from "../src/display.js"

const result = {
  changed: true,
  tier: "balanced" as const,
  model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
  text: "hello",
  reason: "normal task",
  signals: [],
  fallback: false,
}

describe("display helpers", () => {
  test("formats routing banners with reason", () => {
    expect(formatRoutingBanner(result, defaultConfig)).toBe("[oc-router] selected balanced -> anthropic/claude-sonnet-4-5 (reason: normal task)")
  })

  test("formats routing banners without reason", () => {
    expect(formatRoutingBanner(result, { ...defaultConfig, display: { ...defaultConfig.display, includeReason: false } })).toBe("[oc-router] selected balanced -> anthropic/claude-sonnet-4-5")
  })

  test("injects a synthetic text part", () => {
    const output = { parts: [{ type: "text", text: "hello" }] as any[] }
    injectRoutingBanner(output, result, defaultConfig)
    expect(output.parts[1]).toMatchObject({ type: "text", synthetic: true })
    expect(output.parts[1].text).toContain("selected balanced")
  })

  test("skips injection when disabled", () => {
    const output = { parts: [{ type: "text", text: "hello" }] as any[] }
    injectRoutingBanner(output, result, { ...defaultConfig, display: { ...defaultConfig.display, injectMessage: false } })
    expect(output.parts).toHaveLength(1)
  })

  test("shows TUI toast when enabled", async () => {
    const showToast = vi.fn(async () => true)
    await showRoutingToast({ tui: { showToast } }, result, defaultConfig)
    expect(showToast).toHaveBeenCalledWith({ body: { message: "oc-router: balanced -> anthropic/claude-sonnet-4-5", variant: "info" } })
  })
})
