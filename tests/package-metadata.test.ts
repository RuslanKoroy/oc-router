import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const root = join(import.meta.dirname, "..")
const legacyName = ["opencode", "router"].join("-")

function projectFiles(directory: string): string[] {
  const ignored = new Set(["node_modules", "dist", ".git"])
  const files: string[] = []
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) files.push(...projectFiles(path))
    else if (/\.(ts|js|json|md)$/.test(entry)) files.push(path)
  }
  return files
}

describe("package metadata", () => {
  test("uses the oc-router package and command name", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    const readme = readFileSync(join(root, "README.md"), "utf8")

    expect(pkg.name).toBe("oc-router")
    expect(readme).not.toContain("npm install -g oc-router")
    expect(readme).toContain("The `oc-router` package name is not published to npm yet")
    expect(readme).toContain("npm install -g \"/home/user128/oc-router\"")
    expect(readme).toContain("npm pack")
    expect(readme).toContain("npm install -g ./oc-router-0.1.0.tgz")
  })

  test("does not contain the legacy package name in project files", () => {
    const offenders = projectFiles(root).filter((file) => readFileSync(file, "utf8").includes(legacyName))

    expect(offenders.map((file) => file.slice(root.length + 1))).toEqual([])
  })
})
