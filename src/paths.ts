import { join } from "node:path"
import { homedir } from "node:os"

const isWindows = process.platform === "win32"

/**
 * Returns the user's home directory, respecting platform conventions.
 * On Windows prefers USERPROFILE, then APPDATA's parent, then os.homedir().
 */
export function getHomeDir(): string {
  if (isWindows) {
    return process.env.USERPROFILE || process.env.APPDATA?.replace(/[\\/]AppData[\\/]Roaming$/i, "") || homedir()
  }
  return process.env.HOME || homedir()
}

/**
 * Returns the base directory for user-level application configuration.
 * - Windows: %APPDATA%  (e.g. C:\Users\alice\AppData\Roaming)
 * - macOS:   ~/Library/Application Support  (if XDG not set, falls back to ~/.config)
 * - Linux:   ~/.config
 *
 * Note: OpenCode uses system-level paths for managed settings
 * (macOS: /Library/Application Support/opencode, Linux: /etc/opencode,
 *  Windows: %ProgramData%\opencode), but oc-router stores user-level
 * configs which belong in the user config directory.
 */
export function getConfigDir(): string {
  if (isWindows) {
    return process.env.APPDATA || join(getHomeDir(), "AppData", "Roaming")
  }
  // On macOS, XDG_CONFIG_HOME is not set by default, but ~/.config is
  // still the conventional location for user-level configs.
  return process.env.XDG_CONFIG_HOME || join(getHomeDir(), ".config")
}

/**
 * Returns the directory for oc-router configuration.
 * - Windows: %APPDATA%/oc-router
 * - Unix:    ~/.config/oc-router
 */
export function routerConfigDir(): string {
  return join(getConfigDir(), "oc-router")
}

/**
 * Returns the directory for OpenCode configuration.
 * - Windows: %APPDATA%/opencode
 * - Unix:    ~/.config/opencode
 */
export function opencodeConfigDir(): string {
  return join(getConfigDir(), "opencode")
}

/**
 * Global oc-router config file path.
 * - Windows: %APPDATA%/oc-router/config.json
 * - Unix:    ~/.config/oc-router/config.json
 */
export function globalConfigPath(): string {
  return join(routerConfigDir(), "config.json")
}

/**
 * Global oc-router models report path.
 * - Windows: %APPDATA%/oc-router/models.md
 * - Unix:    ~/.config/oc-router/models.md
 */
export function globalModelsReportPath(): string {
  return join(routerConfigDir(), "models.md")
}

/**
 * Project-level config path.
 * Always relative to cwd — works the same on all platforms.
 */
export function projectConfigPath(cwd = process.cwd()): string {
  return join(cwd, ".opencode", "router.json")
}

/**
 * Project-level models report path.
 * Always relative to cwd — works the same on all platforms.
 */
export function projectModelsReportPath(cwd = process.cwd()): string {
  return join(cwd, ".opencode", "router-models.md")
}

/**
 * Global OpenCode config file path.
 * - Windows: %APPDATA%/opencode/opencode.json
 * - Unix:    ~/.config/opencode/opencode.json
 */
export function globalOpenCodeConfigPath(): string {
  return join(opencodeConfigDir(), "opencode.json")
}

/**
 * Global OpenCode plugins directory.
 * - Windows: %APPDATA%/opencode/plugins
 * - Unix:    ~/.config/opencode/plugins
 */
export function globalOpenCodePluginsDir(): string {
  return join(opencodeConfigDir(), "plugins")
}

/**
 * Global OpenCode agents directory.
 * - Windows: %APPDATA%/opencode/agents
 * - Unix:    ~/.config/opencode/agents
 */
export function globalOpenCodeAgentsDir(): string {
  return join(opencodeConfigDir(), "agents")
}

/**
 * Project-level OpenCode plugins directory.
 * Always relative to cwd — works the same on all platforms.
 */
export function projectOpenCodePluginsDir(cwd = process.cwd()): string {
  return join(cwd, ".opencode", "plugins")
}

/**
 * Project-level OpenCode agents directory.
 * Always relative to cwd — works the same on all platforms.
 */
export function projectOpenCodeAgentsDir(cwd = process.cwd()): string {
  return join(cwd, ".opencode", "agents")
}

/**
 * Project-level OpenCode commands directory.
 * Always relative to cwd — works the same on all platforms.
 */
export function projectOpenCodeCommandsDir(cwd = process.cwd()): string {
  return join(cwd, ".opencode", "commands")
}

/**
 * Project-level OpenCode config file (opencode.json).
 * Always relative to cwd — works the same on all platforms.
 */
export function projectOpenCodeConfigPath(cwd = process.cwd()): string {
  return join(cwd, "opencode.json")
}