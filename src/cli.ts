#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { realpathSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { confirm as confirmPrompt, input as inputPrompt, search as searchPrompt, select as selectPrompt } from "@inquirer/prompts"
import { defaultConfig, loadRouterConfig, projectConfigPath, setEnabled, validateRouterConfig, writeRouterConfig } from "./config.js"
import { installRouter } from "./install.js"
import { listOpenCodeModels } from "./models-report.js"
import { createOnboardingConfig } from "./onboarding.js"

type IO = {
  cwd: string
  stdout: (line: string) => void
  stderr: (line: string) => void
  modelsOutput?: string
  select?: (input: { message: string; choices: Array<{ name: string; value: string; description?: string; disabled?: boolean }>; default?: string }) => Promise<string>
  search?: (input: { message: string; source: (term: string | undefined) => Array<{ name: string; value: string; description?: string; disabled?: boolean }>; default?: string }) => Promise<string>
  input?: (input: { message: string; default?: string }) => Promise<string>
  confirm?: (input: { message: string; default?: boolean }) => Promise<boolean>
}

function onboardingIntro() {
  return [
    "",
    "OpenCode Router",
    "Smart model routing for every prompt.",
    "",
    "Model palette",
    "Type any part of a model name or ID to filter, then use arrows to choose.",
    "Pick 'Enter custom model ID' if the model is not listed.",
    "",
    "Setup flow",
    "1. Router model chooses the tier for each request.",
    "2. Fast / balanced / large models handle the actual work.",
    "3. Optional descriptions and prompts tune routing behavior.",
    "",
  ].join("\n")
}

function help() {
  return `oc-router\n\nCommands:\n  init [--yes] [--project|--global]\n  models\n  config get\n  status [--project]\n  doctor [--project]\n  enable [--project]\n  disable [--project]`
}

function scope(args: string[]) {
  return args.includes("--global") ? "global" : "project"
}

function selectedPath(args: string[], cwd: string) {
  return scope(args) === "project" ? projectConfigPath(cwd) : undefined
}

export async function runCli(args = process.argv.slice(2), io: IO = { cwd: process.cwd(), stdout: console.log, stderr: console.error }) {
  const command = args[0]
  if (!command || command === "--help" || command === "-h") {
    io.stdout(help())
    return 0
  }

  if (command === "init") {
    const yes = args.includes("--yes")
    const modelsOutput = io.modelsOutput ?? listOpenCodeModels(io.cwd)
    let config = undefined
    if (!yes) {
      io.stdout(onboardingIntro())
      config = await createOnboardingConfig({
        modelsOutput,
        select: io.select ?? ((args) => selectPrompt(args)),
        search: io.search ?? (io.select ? undefined : ((args) => searchPrompt(args))),
        input: io.input ?? ((args) => inputPrompt(args)),
        confirm: io.confirm ?? ((args) => confirmPrompt(args)),
      })
    }
    const result = installRouter({ cwd: io.cwd, scope: scope(args), yes, modelsOutput, config })
    io.stdout(`Installed oc-router config at ${result.routerPath}`)
    io.stdout(`Wrote OpenCode models report at ${result.modelsReportPath}`)
    io.stdout("\nNext steps:")
    io.stdout(`1. Review ${result.routerPath}`)
    io.stdout(`2. Review ${result.modelsReportPath}`)
    io.stdout("3. Run `oc-router status`")
    io.stdout("4. Restart OpenCode so it reloads the plugin/config")
    return 0
  }

  if (command === "models") {
    const result = spawnSync("opencode", ["models", "--verbose"], { cwd: io.cwd, encoding: "utf8" })
    if (result.error) {
      io.stderr("Unable to run `opencode models --verbose`. Is OpenCode installed?")
      return 1
    }
    io.stdout(result.stdout.trim())
    return result.status ?? 0
  }

  if (command === "config" && args[1] === "get") {
    const loaded = loadRouterConfig({ projectPath: selectedPath(args, io.cwd) })
    io.stdout(JSON.stringify(loaded.config, null, 2))
    return 0
  }

  if (command === "config" && args[1] === "set") {
    const key = args[2]
    const value = args[3]
    if (!key || value === undefined) {
      io.stderr("Usage: oc-router config set <path> <value>")
      return 1
    }
    const path = selectedPath(args, io.cwd) ?? projectConfigPath(io.cwd)
    const loaded = loadRouterConfig({ projectPath: path })
    const next: any = loaded.config
    const parts = key.split(".")
    let target = next
    for (const part of parts.slice(0, -1)) {
      target[part] ??= {}
      target = target[part]
    }
    const leaf = parts[parts.length - 1]
    target[leaf] = value === "true" ? true : value === "false" ? false : value
    writeRouterConfig(path, next)
    io.stdout(`Set ${key}`)
    return 0
  }

  if (command === "enable" || command === "disable") {
    setEnabled(selectedPath(args, io.cwd) ?? projectConfigPath(io.cwd), command === "enable")
    io.stdout(`Router ${command === "enable" ? "enabled" : "disabled"}`)
    return 0
  }

  if (command === "status" || command === "doctor") {
    const loaded = loadRouterConfig({ projectPath: selectedPath(args, io.cwd) })
    const validation = validateRouterConfig(loaded.config)
    io.stdout(`Config: ${loaded.projectPath}`)
    io.stdout(`Enabled: ${loaded.config.enabled}`)
    io.stdout(`Fallback tier: ${loaded.config.fallbackTier}`)
    if (validation.ok) {
      io.stdout("Status: ok")
      return 0
    }
    io.stderr(`Status: invalid\n${validation.errors.join("\n")}`)
    return 1
  }

  if (command === "config" && args[1] === "defaults") {
    io.stdout(JSON.stringify(defaultConfig, null, 2))
    return 0
  }

  io.stderr(`Unknown command: ${command}\n${help()}`)
  return 1
}

export function isDirectCliRun(moduleUrl: string, argvPath: string | undefined, realPath = argvPath ? realpathSync(argvPath) : undefined) {
  if (!realPath) return false
  return moduleUrl === pathToFileURL(realPath).href
}

if (isDirectCliRun(import.meta.url, process.argv[1])) {
  runCli().then((code) => process.exit(code))
}
