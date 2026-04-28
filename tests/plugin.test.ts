import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test, vi } from "vitest"
import { OpenCodeRouterPlugin } from "../src/plugin.js"

describe("OpenCodeRouterPlugin", () => {
  test("registers tier subagents and injects delegation protocol", async () => {
    const plugin = await OpenCodeRouterPlugin({ client: { app: { log: vi.fn() }, tui: { showToast: vi.fn() } }, directory: process.cwd(), worktree: process.cwd(), project: {}, serverUrl: new URL("http://localhost"), $: undefined } as any, {
      config: {
        tiers: {
          fast: { model: "openai/gpt-4o-mini", description: "quick reads", whenToUse: "read-only work" },
          balanced: { model: "anthropic/claude-sonnet-4-5", description: "normal coding", whenToUse: "implementation" },
          large: { model: "anthropic/claude-opus-4-5", description: "hard reasoning", whenToUse: "architecture" },
        },
      },
    } as any)

    const opencodeConfig: any = {}
    await plugin.config?.(opencodeConfig)
    const system = { system: [] as string[] }
    await plugin["experimental.chat.system.transform"]?.({ sessionID: "s1", model: { providerID: "zai", modelID: "glm" } } as any, system)

    expect(opencodeConfig.agent.fast).toMatchObject({ model: "openai/gpt-4o-mini", mode: "subagent", description: "quick reads" })
    expect(opencodeConfig.agent.fast.permission).toMatchObject({ edit: "deny", write: "deny", apply_patch: "deny" })
    expect(opencodeConfig.agent.balanced).toMatchObject({ model: "anthropic/claude-sonnet-4-5", mode: "subagent" })
    expect(opencodeConfig.agent.large).toMatchObject({ model: "anthropic/claude-opus-4-5", mode: "subagent" })
    expect(opencodeConfig.agent.fast.prompt).toContain("Return a CONTEXT HANDOFF block")
    expect(opencodeConfig.agent.fast.prompt).toContain("Do not create, edit, write, or patch files")
    expect(opencodeConfig.agent.fast.prompt).toContain("FILES READ")
    expect(opencodeConfig.agent.balanced.prompt).toContain("If the prompt contains CONTEXT HANDOFF")
    expect(opencodeConfig.agent.balanced.prompt).toContain("MISSING CONTEXT HANDOFF")
    expect(opencodeConfig.agent.balanced.prompt).toContain("If the prompt already contains all required instructions for a new file")
    expect(opencodeConfig.agent.large.prompt).toContain("If the prompt contains CONTEXT HANDOFF")
    expect(opencodeConfig.agent.large.prompt).toContain("MISSING CONTEXT HANDOFF")
    expect(opencodeConfig.agent.large.prompt).toContain("If the prompt already contains all required instructions for a new file")
    expect(system.system.join("\n")).toContain("Model Delegation Protocol")
    expect(system.system.join("\n")).toContain("Tier names are configurable slots")
    expect(system.system.join("\n")).toContain("Follow each tier's description and Use when text over generic assumptions")
    expect(system.system.join("\n")).toContain('Task(subagent_type="fast"')
    expect(system.system.join("\n")).toContain("BEFORE using read, grep, glob, list, bash, edit, write, or apply_patch")
    expect(system.system.join("\n")).toContain("If you do the work yourself instead of delegating, you are violating the user's routing requirement")
    expect(system.system.join("\n")).toContain("CONTEXT HANDOFF")
    expect(system.system.join("\n")).toContain("For any request where balanced or large may need file context")
    expect(system.system.join("\n")).toContain("first dispatch fast")
    expect(system.system.join("\n")).toContain("Never dispatch balanced or large for file-dependent work without including CONTEXT HANDOFF")
    expect(system.system.join("\n")).toContain("copy the CONTEXT HANDOFF block verbatim into the balanced or large prompt")
    expect(system.system.join("\n")).toContain("Do not ask balanced or large to reread files already listed in FILES READ")
    expect(system.system.join("\n")).toContain("Do not launch multiple subagents in parallel")
    expect(system.system.join("\n")).toContain("Dispatch exactly one tier subagent at a time")
  })

  test("labels assistant text and tool output with the active model", async () => {
    const plugin = await OpenCodeRouterPlugin({ client: { app: { log: vi.fn() }, tui: { showToast: vi.fn() } }, directory: process.cwd(), worktree: process.cwd(), project: {}, serverUrl: new URL("http://localhost"), $: undefined } as any, {} as any)

    await plugin["chat.params"]?.({ sessionID: "s1", agent: "build", model: { providerID: "openai", id: "gpt-5.5", name: "GPT-5.5" } } as any, { temperature: 0, topP: 1, topK: 0, maxOutputTokens: undefined, options: {} })
    const textOutput = { text: "Implemented the change." }
    await plugin["experimental.text.complete"]?.({ sessionID: "s1", messageID: "m1", partID: "p1" } as any, textOutput)
    const toolOutput = { title: "Bash", output: "tests passed", metadata: {} }
    await plugin["tool.execute.after"]?.({ sessionID: "s1", tool: "bash", callID: "c1", args: {} } as any, toolOutput)

    expect(textOutput.text).toContain("[model: openai/gpt-5.5]")
    expect(toolOutput.output).toContain("[model: openai/gpt-5.5]")
  })

  test("does not call OpenCode session APIs from chat.message by default", async () => {
    const client = {
      app: { log: vi.fn(async () => true) },
      tui: { showToast: vi.fn(async () => true) },
      session: { create: vi.fn(async () => ({ id: "router" })), prompt: vi.fn(async () => ({})) },
    }
    const plugin = await OpenCodeRouterPlugin({ client, directory: process.cwd(), worktree: process.cwd(), project: {}, serverUrl: new URL("http://localhost"), $: undefined } as any, {
      config: {
        tiers: {
          fast: { model: "openai/gpt-4o-mini" },
          balanced: { model: "anthropic/claude-sonnet-4-5" },
          large: { model: "anthropic/claude-opus-4-5" },
        },
      },
    } as any)

    const output = { message: {}, parts: [{ type: "text", text: "write code" }] as any[] }
    await plugin["chat.message"]?.({ sessionID: "s1" } as any, output as any)

    expect(client.session.create).not.toHaveBeenCalled()
    expect(client.session.prompt).not.toHaveBeenCalled()
    expect(output.message).toEqual({})
  })

  test("loads project router config from the OpenCode directory", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "oc-router-plugin-"))
    mkdirSync(join(cwd, ".opencode"), { recursive: true })
    writeFileSync(join(cwd, ".opencode", "router.json"), JSON.stringify({
      tiers: {
        fast: { model: "openai/gpt-4o-mini" },
        balanced: { model: "anthropic/claude-sonnet-4-5" },
        large: { model: "anthropic/claude-opus-4-5" },
      },
    }))
    const plugin = await OpenCodeRouterPlugin({ client: { app: { log: vi.fn() }, tui: { showToast: vi.fn() } }, directory: cwd, worktree: cwd, project: {}, serverUrl: new URL("http://localhost"), $: undefined } as any, {
      router: async () => ({ tier: "fast", confidence: 0.9, reason: "small", signals: [] }),
    } as any)

    const output = { message: {}, parts: [{ type: "text", text: "explain" }] as any[] }
    await plugin["chat.message"]?.({ sessionID: "s1" } as any, output as any)

    expect(output.message.model).toEqual({ providerID: "openai", modelID: "gpt-4o-mini" })
  })

  test("sets message model and injects banner", async () => {
    const plugin = await OpenCodeRouterPlugin({
      client: {
        app: { log: vi.fn(async () => true) },
        tui: { showToast: vi.fn(async () => true) },
        session: { prompt: vi.fn() },
      },
      directory: process.cwd(),
      worktree: process.cwd(),
      project: {},
      serverUrl: new URL("http://localhost:4096"),
      $: undefined,
    } as any, {
      config: {
        router: { model: "openai/gpt-4o-mini" },
        tiers: {
          fast: { model: "openai/gpt-4o-mini" },
          balanced: { model: "anthropic/claude-sonnet-4-5" },
          large: { model: "anthropic/claude-opus-4-5" },
        },
      },
      router: async () => ({ tier: "large", confidence: 0.9, reason: "hard", signals: [] }),
    } as any)

    const output = { message: { role: "user" }, parts: [{ type: "text", text: "design architecture" }] as any[] }
    await plugin["chat.message"]?.({ sessionID: "s1" } as any, output as any)

    expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-5" })
    expect(output.parts.some((part) => part.synthetic && part.text.includes("selected large"))).toBe(true)
  })

  test("strips forced prefix from text part", async () => {
    const plugin = await OpenCodeRouterPlugin({ client: { app: { log: vi.fn() }, tui: { showToast: vi.fn() } }, directory: process.cwd(), worktree: process.cwd(), project: {}, serverUrl: new URL("http://localhost"), $: undefined } as any, {
      config: {
        tiers: {
          fast: { model: "openai/gpt-4o-mini" },
          balanced: { model: "anthropic/claude-sonnet-4-5" },
          large: { model: "anthropic/claude-opus-4-5" },
        },
      },
    } as any)

    const output = { message: {}, parts: [{ type: "text", text: "/fast explain" }] as any[] }
    await plugin["chat.message"]?.({ sessionID: "s1" } as any, output as any)

    expect(output.parts[0].text).toBe("explain")
    expect(output.message.model).toEqual({ providerID: "openai", modelID: "gpt-4o-mini" })
  })
})
