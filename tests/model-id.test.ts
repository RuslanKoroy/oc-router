import { describe, expect, test } from "vitest"
import { formatModelID, isModelID, parseModelID } from "../src/model-id.js"

describe("model IDs", () => {
  test("parses provider/model IDs", () => {
    expect(parseModelID("anthropic/claude-sonnet-4-5")).toEqual({
      providerID: "anthropic",
      modelID: "claude-sonnet-4-5",
    })
  })

  test("keeps slashes inside model IDs", () => {
    expect(parseModelID("custom/org/model")).toEqual({ providerID: "custom", modelID: "org/model" })
  })

  test("rejects malformed IDs", () => {
    expect(() => parseModelID("anthropic")).toThrow("provider/model")
    expect(() => parseModelID("/model")).toThrow("provider/model")
    expect(() => parseModelID("provider/")).toThrow("provider/model")
  })

  test("formats parsed model IDs", () => {
    expect(formatModelID({ providerID: "openai", modelID: "gpt-5.2" })).toBe("openai/gpt-5.2")
  })

  test("checks if a value is a model ID", () => {
    expect(isModelID("openai/gpt-5.2")).toBe(true)
    expect(isModelID("openai")).toBe(false)
    expect(isModelID(42)).toBe(false)
  })
})
