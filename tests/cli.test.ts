import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "vitest"
import { isDirectCliRun, runCli } from "../src/cli.js"

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "oc-router-cli-"))
}

describe("CLI", () => {
  test("detects npm bin symlink as direct CLI run", () => {
    expect(isDirectCliRun("file:///pkg/dist/cli.js", "/usr/local/bin/oc-router", "/pkg/dist/cli.js")).toBe(true)
  })

  test("prints help", async () => {
    const lines: string[] = []
    const code = await runCli(["--help"], { cwd: tempRoot(), stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) })
    expect(code).toBe(0)
    expect(lines.join("\n")).toContain("oc-router")
  })

  test("initializes project config", async () => {
    const cwd = tempRoot()
    const code = await runCli(["init", "--yes", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined, modelsOutput: "openai/gpt-4o-mini" })
    expect(code).toBe(0)
    expect(readFileSync(join(cwd, ".opencode", "router.json"), "utf8")).toContain("fallbackTier")
    expect(readFileSync(join(cwd, ".opencode", "router-models.md"), "utf8")).toContain("OpenCode Router Models")
  })

  test("interactive init writes selected models and short instructions", async () => {
    const cwd = tempRoot()
    const lines: string[] = []
    const answers = ["1", "1", "3", "2", "", "", "", "", "", "", "no"]
    const code = await runCli(["init", "--project"], {
      cwd,
      stdout: (line) => lines.push(line),
      stderr: (line) => lines.push(line),
      modelsOutput: ["openai/gpt-5.4-mini", "opencode/claude-opus-4-5", "opencode/claude-sonnet-4-5"].join("\n"),
      select: async () => answers.shift() ?? "",
      input: async () => answers.shift() ?? "",
      confirm: async () => false,
    })

    const config = JSON.parse(readFileSync(join(cwd, ".opencode", "router.json"), "utf8"))
    expect(code).toBe(0)
    expect(config.router.model).toBe("openai/gpt-5.4-mini")
    expect(config.tiers.large.model).toBe("opencode/claude-opus-4-5")
    expect(lines.join("\n")).toContain("Next steps")
    expect(lines.join("\n")).toContain("oc-router status")
    expect(lines.join("\n")).toContain("Type any part of a model name or ID to filter")
    expect(lines.join("\n")).toContain("Model palette")
    expect(lines.join("\n")).not.toContain("1. openai/gpt-5.4-mini")
  })

  test("toggles enable and disable", async () => {
    const cwd = tempRoot()
    await runCli(["init", "--yes", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined, modelsOutput: "openai/gpt-4o-mini" })
    await runCli(["disable", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined })
    expect(JSON.parse(readFileSync(join(cwd, ".opencode", "router.json"), "utf8")).enabled).toBe(false)
    await runCli(["enable", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined })
    expect(JSON.parse(readFileSync(join(cwd, ".opencode", "router.json"), "utf8")).enabled).toBe(true)
  })

  test("prints status", async () => {
    const cwd = tempRoot()
    await runCli(["init", "--yes", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined, modelsOutput: "openai/gpt-4o-mini" })
    const lines: string[] = []
    const code = await runCli(["status", "--project"], { cwd, stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) })
    expect(code).toBe(0)
    expect(lines.join("\n")).toContain("Status: ok")
  })

  test("sets nested config values", async () => {
    const cwd = tempRoot()
    await runCli(["init", "--yes", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined, modelsOutput: "openai/gpt-4o-mini" })
    const code = await runCli(["config", "set", "tiers.fast.model", "openai/gpt-4o-mini", "--project"], { cwd, stdout: () => undefined, stderr: () => undefined })

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(join(cwd, ".opencode", "router.json"), "utf8")).tiers.fast.model).toBe("openai/gpt-4o-mini")
  })
})
