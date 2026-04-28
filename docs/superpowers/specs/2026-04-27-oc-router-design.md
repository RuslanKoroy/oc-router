# OpenCode Router Design

## Goal

Build `oc-router`, an npm-distributable OpenCode plugin that routes each user request to one of three configured model tiers: `fast`, `balanced`, or `large`. A separate router model makes the routing decision. The plugin must integrate with OpenCode's plugin hooks, use the user's configured OpenCode providers/models, expose a companion CLI for setup and management, and make the selected model visible on every request.

## OpenCode Integration Points

OpenCode plugins are JavaScript or TypeScript modules that export a server plugin. They can be loaded from npm through the `plugin` array in `opencode.json`.

The router will use these documented hooks and APIs:

- `chat.message`: receives the new user message before it is saved. The plugin can set `output.message.model` to the selected `{ providerID, modelID }`.
- `config`: receives the resolved OpenCode config so the plugin can inspect configured defaults.
- `event`: observes session and message lifecycle events for diagnostics and metadata.
- `client.config.providers()`: lists available providers/default models from OpenCode.
- `client.tui.showToast()`: shows selected-model notifications in the TUI.
- `client.app.log()`: writes structured plugin logs.

The plugin will not try to add new top-level `opencode router ...` commands because OpenCode plugins do not expose a documented extension point for CLI command registration. Instead, the npm package provides a first-class companion binary, `oc-router`, and installs OpenCode slash commands where appropriate.

## Package Shape

The package name is `oc-router`.

Exports:

- `server`: OpenCode plugin entrypoint for npm plugin loading.
- `./plugin`: direct plugin module for local loading and tests.
- `./cli`: CLI implementation.

Binaries:

- `oc-router`: setup and management CLI.

Primary files:

- `src/plugin.ts`: OpenCode plugin hook implementation.
- `src/router.ts`: model-tier decision orchestration.
- `src/config.ts`: config loading, validation, merging, and defaults.
- `src/models.ts`: model ID parsing, available model discovery helpers, and tier validation.
- `src/prompts.ts`: router model system/user prompt templates.
- `src/cli.ts`: companion CLI.
- `src/install.ts`: idempotent OpenCode config and command installation.
- `src/state.ts`: lightweight runtime state and diagnostics.

## Configuration

The router config is JSON and can exist at two levels:

- Global: `~/.config/oc-router/config.json`
- Project: `.opencode/router.json`

Project config overrides global config. Environment variables can override individual values for automation.

Core config fields:

- `enabled`: boolean, default `true`.
- `mode`: `auto`, `manual`, or `off`; default `auto`.
- `router.model`: OpenCode model ID, e.g. `anthropic/claude-haiku-4-5`.
- `router.temperature`: default `0`.
- `router.timeoutMs`: default `12000`.
- `router.maxRetries`: default `1`.
- `tiers.fast.model`: required after setup.
- `tiers.balanced.model`: required after setup.
- `tiers.large.model`: required after setup.
- `tiers.*.description`: optional human label for prompts and UI.
- `fallbackTier`: default `balanced`.
- `display.showToast`: default `true`.
- `display.injectMessage`: default `true`.
- `display.includeReason`: default `true`.
- `routing.preferCheapForReadOnly`: default `true`.
- `routing.largeKeywords`: configurable regex/string hints.
- `routing.fastKeywords`: configurable regex/string hints.
- `routing.forceTierPrefixes`: default `[{prefix:"/fast",tier:"fast"},{prefix:"/balanced",tier:"balanced"},{prefix:"/large",tier:"large"}]`.

Manual overrides:

- A request starting with `/fast`, `/balanced`, or `/large` forces that tier and strips the prefix before the model sees the content.
- A request starting with `/router off` or `/router auto` is handled by OpenCode slash-command templates or by the companion CLI, not by hidden mutation of normal user prompts.

## Routing Flow

For each new user message:

1. If disabled, leave the message model unchanged.
2. Read current merged router config.
3. Extract user-visible text parts and small metadata such as agent, requested model, session ID, and file/image presence.
4. Check forced tier prefixes.
5. If no forced tier, ask the configured router model for a structured JSON decision.
6. Validate the decision against available configured tiers.
7. Set `output.message.model` to the selected tier model.
8. Inject a synthetic message part showing the selected tier/model when `display.injectMessage` is enabled.
9. Show a TUI toast when available and enabled.
10. Log the routing decision and any fallback.

The router model is used only to classify the request. It never receives secrets beyond the user's prompt text and minimal context. Tool outputs and large file contents are not sent to the router by default.

## Router Prompt

The router system prompt requires deterministic classification into exactly one tier.

It emphasizes:

- Use `fast` for simple edits, formatting, small explanations, direct commands, and low-risk searches.
- Use `balanced` for normal coding tasks, moderate debugging, small features, and ambiguous requests.
- Use `large` for architecture, large refactors, multi-file changes, high-risk debugging, security-sensitive work, complex reasoning, or when failure cost is high.
- Prefer cheaper tiers when quality is unlikely to change materially.
- Escalate when uncertainty is high.

The structured response schema:

```json
{
  "tier": "fast|balanced|large",
  "confidence": 0.0,
  "reason": "short user-facing reason",
  "signals": ["short signal labels"]
}
```

Invalid, missing, or low-confidence responses fall back to `fallbackTier`.

## CLI Design

`oc-router` commands:

- `oc-router init`: interactive setup, writes config, updates `opencode.json` plugin list, and optionally writes OpenCode commands.
- `oc-router models`: prints OpenCode models using `opencode models --verbose` when available and helps choose tier/router models.
- `oc-router config get`: prints merged config.
- `oc-router config set <path> <value>`: updates global or project config.
- `oc-router status`: validates plugin installation, model IDs, config paths, and OpenCode availability.
- `oc-router enable` / `oc-router disable`: toggles config.
- `oc-router doctor`: deeper diagnostics with actionable fixes.

The CLI is intentionally separate from the `opencode` executable because OpenCode does not document top-level CLI extension by plugins. The installation flow will clearly print the exact OpenCode config changes it applies.

## OpenCode Slash Commands

The installer can create project or global command files:

- `/router-status`: asks OpenCode to summarize current router status using `!\`oc-router status\``.
- `/router-models`: injects `!\`oc-router models\`` output.
- `/router-fast`, `/router-balanced`, `/router-large`: convenience commands that prepend the corresponding forced tier prefix.

These commands integrate with OpenCode's documented custom command system without relying on undocumented CLI internals.

## Display

Every routed request gets an explicit synthetic text part like:

```text
[oc-router] selected balanced -> anthropic/claude-sonnet-4-5 (reason: normal coding task with moderate complexity)
```

This is visible in the conversation and becomes part of the request context, satisfying the requirement that each request clearly show which model is used. TUI toast provides immediate visual feedback:

```text
oc-router: balanced -> anthropic/claude-sonnet-4-5
```

## Error Handling

Failures are non-fatal:

- Missing config: leave OpenCode's current model unchanged and show one warning toast.
- Router model failure: use `fallbackTier`.
- Invalid tier model: use OpenCode current/default model and log an error.
- TUI unavailable: skip toast.
- Config parse error: disable routing for that request and log a structured error.

The plugin must never block normal OpenCode usage because of router problems.

## Testing

Unit tests cover:

- Config merge and validation.
- Model ID parsing.
- Forced prefix detection and stripping.
- Router decision parsing and fallback behavior.
- `chat.message` mutation for each tier.
- Synthetic display part formatting.

Integration-style tests use mocked OpenCode plugin context and mocked SDK client methods.

CLI tests cover:

- `init --yes` config generation.
- `status` success/failure cases.
- `enable`/`disable` toggles.

## Non-Goals

- Patching OpenCode internals.
- Registering undocumented top-level `opencode router` subcommands.
- Sending full files or tool outputs to the router model by default.
- Replacing OpenCode's built-in `/models` selector.
