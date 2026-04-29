import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { ensureOpenCodePlugin, installRouter, writeOpenCodeAgentFiles, writeOpenCodeCommands, writeOpenCodePluginFile } from "../src/install.js"
import { defaultConfig } from "../src/config.js"
import { pickModelsForTiers } from "../src/models-report.js"

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "oc-router-install-"))
}

describe("installer", () => {
  test("removes conflicting npm plugin id and ensures current plugin is present", () => {
    const root = tempRoot()
    const path = join(root, "opencode.json")
    const legacyPlugin = ["opencode", "router"].join("-")
    writeFileSync(path, JSON.stringify({ plugin: ["existing", "oc-router", legacyPlugin] }))

    ensureOpenCodePlugin(path, "oc-router")
    ensureOpenCodePlugin(path, "oc-router")

    const plugins = JSON.parse(readFileSync(path, "utf8")).plugin
    expect(plugins).toEqual(["existing", "oc-router"])
    expect(plugins.filter((p: string) => p === "oc-router")).toHaveLength(1)
  })

  test("writes a local OpenCode plugin loader", () => {
    const root = tempRoot()
    writeOpenCodePluginFile(join(root, ".opencode", "plugins"), "/tmp/oc-router/dist/index.js")

    const loader = readFileSync(join(root, ".opencode", "plugins", "oc-router.js"), "utf8")
    expect(loader).toContain("/tmp/oc-router/dist/index.js")
    expect(loader).toContain("export { server as OpenCodeRouterPlugin }")
  })

  test("writes concrete OpenCode tier agent files", () => {
    const root = tempRoot()
    writeOpenCodeAgentFiles(join(root, ".opencode", "agents"), defaultConfig)

    const router = readFileSync(join(root, ".opencode", "agents", "router.md"), "utf8")
    const fast = readFileSync(join(root, ".opencode", "agents", "fast.md"), "utf8")
    const balanced = readFileSync(join(root, ".opencode", "agents", "balanced.md"), "utf8")
    const large = readFileSync(join(root, ".opencode", "agents", "large.md"), "utf8")
    expect(router).toContain("mode: primary")
    expect(router).toContain("model: provider/router-model")
    expect(router).toContain("default Router agent")
    expect(router).toContain("read: deny")
    expect(router).toContain("grep: deny")
    expect(router).toContain("glob: deny")
    expect(router).toContain("list: deny")
    expect(router).toContain("bash: deny")
    expect(router).toContain("edit: deny")
    expect(router).toContain("write: deny")
    expect(router).toContain("task: allow")
    expect(router).toContain("For any request where @balanced or @large may need file context")
    expect(router).toContain("first dispatch @fast")
    expect(router).toContain("Never dispatch @balanced or @large for file-dependent work without including CONTEXT HANDOFF")
    expect(router).toContain("Do not launch multiple subagents in parallel")
    expect(fast).toContain("mode: subagent")
    expect(fast).toContain("model: provider/fast-model")
    expect(fast).toContain("edit: deny")
    expect(fast).toContain("write: deny")
    expect(fast).toContain("apply_patch: deny")
    expect(fast).toContain("Do not create, edit, write, or patch files")
    expect(fast).toContain("CONTEXT HANDOFF")
    expect(fast).toContain("FILES READ")
    expect(fast).toContain("RELEVANT SNIPPETS")
    expect(balanced).toContain("model: provider/balanced-model")
    expect(balanced).toContain("If the prompt contains CONTEXT HANDOFF")
    expect(balanced).toContain("If the prompt already contains all required instructions for a new file")
    expect(balanced).toContain("REREAD REASON")
    expect(balanced).toContain("MISSING CONTEXT HANDOFF")
    expect(large).toContain("model: provider/large-model")
    expect(large).toContain("If the prompt contains CONTEXT HANDOFF")
    expect(large).toContain("If the prompt already contains all required instructions for a new file")
    expect(large).toContain("REREAD REASON")
    expect(large).toContain("MISSING CONTEXT HANDOFF")
  })

  test("writes OpenCode command files", () => {
    const root = tempRoot()
    writeOpenCodeCommands(join(root, ".opencode", "commands"))

    expect(readFileSync(join(root, ".opencode", "commands", "router-status.md"), "utf8")).toContain("oc-router status")
    expect(readFileSync(join(root, ".opencode", "commands", "router-fast.md"), "utf8")).toContain("/fast $ARGUMENTS")
  })

  test("installs router config, models report, and OpenCode integration", () => {
    const root = tempRoot()
    installRouter({ cwd: root, scope: "project", yes: true, modelsOutput: "openai/gpt-4o-mini\nanthropic/claude-sonnet-4-5" })

    expect(existsSync(join(root, ".opencode", "router.json"))).toBe(true)
    expect(readFileSync(join(root, ".opencode", "router-models.md"), "utf8")).toContain("openai/gpt-4o-mini")
    expect(readFileSync(join(root, ".opencode", "plugins", "oc-router.js"), "utf8")).toContain("dist/index.js")
    expect(readFileSync(join(root, ".opencode", "agents", "router.md"), "utf8")).toContain("mode: primary")
    const opencodeConfig = JSON.parse(readFileSync(join(root, "opencode.json"), "utf8"))
    expect(opencodeConfig.default_agent).toBe("router")
    expect(opencodeConfig.plugin).toContain("oc-router")
  })

  test("sets router as default OpenCode agent while preserving config", () => {
    const root = tempRoot()
    const path = join(root, "opencode.json")
    writeFileSync(path, JSON.stringify({ model: "openai/gpt-4o", plugin: ["existing", "oc-router"] }))

    ensureOpenCodePlugin(path, "oc-router")

    const config = JSON.parse(readFileSync(path, "utf8"))
    expect(config).toMatchObject({ model: "openai/gpt-4o", default_agent: "router", plugin: ["existing", "oc-router"] })
  })

  test("preserves an existing router config during non-interactive init", () => {
    const root = tempRoot()
    const routerPath = join(root, ".opencode", "router.json")
    mkdirSync(join(root, ".opencode"), { recursive: true })
    writeFileSync(routerPath, JSON.stringify({ tiers: { large: { model: "openai/gpt-5.5" } } }))

    installRouter({ cwd: root, scope: "project", yes: true, modelsOutput: "openai/gpt-5.5" })

    expect(JSON.parse(readFileSync(routerPath, "utf8")).tiers.large.model).toBe("openai/gpt-5.5")
  })

  test("uses real models from modelsOutput when no config exists and --yes is passed", () => {
    const root = tempRoot()
    const modelsOutput = "openai/gpt-4o-mini\nanthropic/claude-sonnet-4-5\nanthropic/claude-opus-4-5"

    installRouter({ cwd: root, scope: "project", yes: true, modelsOutput })

    const routerJson = JSON.parse(readFileSync(join(root, ".opencode", "router.json"), "utf8"))
    // Should have real model IDs, NOT placeholder "provider/*" values
    expect(routerJson.tiers.fast.model).toBe("openai/gpt-4o-mini")
    expect(routerJson.tiers.balanced.model).toBe("anthropic/claude-sonnet-4-5")
    expect(routerJson.tiers.large.model).toBe("anthropic/claude-opus-4-5")
    expect(routerJson.router.model).toBe("openai/gpt-4o-mini")
    // None should be placeholders
    expect(routerJson.tiers.fast.model).not.toContain("provider/")
    expect(routerJson.tiers.balanced.model).not.toContain("provider/")
    expect(routerJson.tiers.large.model).not.toContain("provider/")
  })

  test("writes agent files with real models from modelsOutput", () => {
    const root = tempRoot()
    const modelsOutput = "openai/gpt-4o-mini\nanthropic/claude-sonnet-4-5\nanthropic/claude-opus-4-5"

    installRouter({ cwd: root, scope: "project", yes: true, modelsOutput })

    const fast = readFileSync(join(root, ".opencode", "agents", "fast.md"), "utf8")
    const balanced = readFileSync(join(root, ".opencode", "agents", "balanced.md"), "utf8")
    const large = readFileSync(join(root, ".opencode", "agents", "large.md"), "utf8")
    expect(fast).toContain("model: openai/gpt-4o-mini")
    expect(balanced).toContain("model: anthropic/claude-sonnet-4-5")
    expect(large).toContain("model: anthropic/claude-opus-4-5")
    // Should NOT have placeholder models
    expect(fast).not.toContain("provider/fast-model")
    expect(balanced).not.toContain("provider/balanced-model")
    expect(large).not.toContain("provider/large-model")
  })

  test("pickModelsForTiers returns correct models from output", () => {
    const modelsOutput = "openai/gpt-4o-mini\nanthropic/claude-sonnet-4-5\nanthropic/claude-opus-4-5"
    const picks = pickModelsForTiers(modelsOutput)
    expect(picks.fast).toBe("openai/gpt-4o-mini")
    expect(picks.balanced).toBe("anthropic/claude-sonnet-4-5")
    expect(picks.large).toBe("anthropic/claude-opus-4-5")
    expect(picks.router).toBe("openai/gpt-4o-mini")
  })

  test("pickModelsForTiers handles single model gracefully", () => {
    const modelsOutput = "openai/gpt-4o"
    const picks = pickModelsForTiers(modelsOutput)
    expect(picks.fast).toBe("openai/gpt-4o")
    expect(picks.balanced).toBe("openai/gpt-4o") // falls back to same
    expect(picks.large).toBe("openai/gpt-4o") // falls back to same
  })

  test("pickModelsForTiers returns undefined for empty output", () => {
    const picks = pickModelsForTiers("No models detected")
    expect(picks.router).toBeUndefined()
    expect(picks.fast).toBeUndefined()
    expect(picks.balanced).toBeUndefined()
    expect(picks.large).toBeUndefined()
  })
})
