# oc-router

`oc-router` is an OpenCode plugin plus companion CLI that routes each user request to a configured model tier: `fast`, `balanced`, or `large`.

The routing decision is made by a separate router model. The selected model is written into the OpenCode message before the assistant responds, and a visible banner is injected into every routed request.

## Install

The `oc-router` package name is not published to npm yet. Until it is published, install it from this checkout or from a packed tarball.

From this checkout, install the local package with:

```bash
npm install -g "/home/user128/oc-router"
oc-router init --global
```

Or create and install a local tarball:

```bash
npm pack
npm install -g ./oc-router-0.1.0.tgz
oc-router init --global
```

`init` starts an onboarding wizard by default. It groups detected OpenCode models by provider, lets you choose router/fast/balanced/large models with arrow keys, supports custom `provider/model` IDs, optionally edits model descriptions and router prompts, then prints the next steps.

For non-interactive setup, use:

```bash
oc-router init --global --yes
```

For a single project:

```bash
npm install --save-dev "/home/user128/oc-router"
oc-router init --project --yes
```

The installer writes a local OpenCode plugin loader and removes any conflicting npm plugin entry named `oc-router` from `opencode.json`:

```json
{
  "plugin": []
}
```

OpenCode loads the generated local plugin file from `.opencode/plugins/oc-router.js` or `~/.config/opencode/plugins/oc-router.js` at startup.

`init` also writes a Markdown model report:

- Global: `~/.config/oc-router/models.md`
- Project: `.opencode/router-models.md`

The report includes the generation date, model tables grouped by provider, detected provider IDs, and copy-paste configuration examples for `router`, `fast`, `balanced`, and `large`.

## Configure

Global config:

```text
~/.config/oc-router/config.json
```

Project config:

```text
.opencode/router.json
```

Project config overrides global config.

Example:

```json
{
  "enabled": true,
  "mode": "auto",
  "router": {
    "model": "provider/router-model",
    "temperature": 0,
    "timeoutMs": 12000,
    "maxRetries": 1,
    "prompts": {
      "system": "Classify each OpenCode user request into exactly one model tier: fast, balanced, or large. Return only JSON matching the router decision schema. Use balanced as the default tier. Use fast only for reading and exploring code, simple commands, and low-risk information gathering. Use large for architecture, research, high-quality code generation, non-obvious solutions, and difficult problems.",
      "userTemplate": "Available tiers:\n{tiers}\n\nRequest:\n{request}"
    }
  },
  "tiers": {
    "fast": {
      "model": "provider/fast-model",
      "description": "Fast, cheap model for lightweight OpenCode work.",
      "whenToUse": "Use only for reading and studying code, simple commands, quick searches, summaries, and low-risk exploration. Do not use for writing production code or solving complex problems."
    },
    "balanced": {
      "model": "provider/balanced-model",
      "description": "Default model for day-to-day OpenCode work.",
      "whenToUse": "Use by default for normal development tasks, routine edits, ordinary debugging, tests, documentation, and tasks that are not clearly fast-only or large-worthy."
    },
    "large": {
      "model": "provider/large-model",
      "description": "Most capable model for high-value reasoning and implementation.",
      "whenToUse": "Use for architecture, research, complex debugging, difficult problems, non-obvious solutions, high-quality code generation, security-sensitive changes, and work where mistakes are expensive."
    }
  },
  "fallbackTier": "balanced"
}
```

`router.prompts.system` and `router.prompts.userTemplate` are editable. The user template supports:

- `{tiers}`: rendered descriptions and `whenToUse` guidance for `fast`, `balanced`, and `large`
- `{request}`: current user request text

Model IDs use OpenCode's normal `provider/model` format. Run:

```bash
opencode models --verbose
```

or:

```bash
oc-router models
```

## CLI

```bash
oc-router init --project --yes
oc-router status --project
oc-router doctor --project
oc-router models
oc-router config get --project
oc-router config set tiers.fast.model openai/gpt-4o-mini --project
oc-router enable --project
oc-router disable --project
```

## Forced Tiers

Prefix a request to force a tier:

```text
/fast explain this function
/balanced add tests for this module
/large design the migration plan
```

The prefix is stripped before the final model receives the request.

## Visible Model Banner

Each routed request receives a synthetic context part:

```text
[oc-router] selected balanced -> anthropic/claude-sonnet-4-5 (reason: normal coding task)
```

In the TUI, the plugin also attempts to show a toast:

```text
oc-router: balanced -> anthropic/claude-sonnet-4-5
```

## OpenCode Commands

`oc-router init --project` creates these optional slash commands in `.opencode/commands`:

- `/router-status`
- `/router-models`
- `/router-fast`
- `/router-balanced`
- `/router-large`

## Limitations

OpenCode plugins do not document a way to register new top-level `opencode router ...` commands. This package therefore provides the `oc-router` companion binary and integrates with OpenCode through documented plugin hooks and slash commands.

Router failures are non-fatal. If the router model fails or returns an invalid decision, the plugin uses `fallbackTier`; if that cannot be used, it leaves OpenCode's current model unchanged.
