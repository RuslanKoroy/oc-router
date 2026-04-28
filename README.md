# 🚦 oc-router

[![OpenCode](https://img.shields.io/badge/OpenCode-0.11.0%2B-blue?style=for-the-badge)](https://opencode.ai/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![GitHub Repo](https://img.shields.io/badge/GitHub-oc--router-181717?style=for-the-badge&logo=github)](https://github.com/RuslanKoroy/oc-router)

**oc-router** is an intelligent routing helper for [OpenCode](https://opencode.ai/) that chooses the right model tier for every task, keeps context handoffs clean, and makes multi-model workflows predictable.

⭐ **Star the project:** [github.com/RuslanKoroy/oc-router](https://github.com/RuslanKoroy/oc-router)  
👀 **Watch releases:** [GitHub Watch](https://github.com/RuslanKoroy/oc-router/subscription)  
🐛 **Report issues:** [GitHub Issues](https://github.com/RuslanKoroy/oc-router/issues)

---

## 📌 Introduction

OpenCode is powerful because it can work with different models and agents. In practice, however, not every task needs the same level of reasoning:

- Small file edits should be fast and inexpensive.
- Medium implementation work needs balanced reasoning.
- Architecture, debugging, security-sensitive changes, and expensive mistakes deserve the strongest model.

**oc-router** adds a routing layer that helps OpenCode pick the right tier automatically or lets you force a tier manually when you already know what you need.

### Key benefits

- ⚡ **Reduce latency** by sending simple tasks to fast models.
- 💰 **Control cost** by reserving large models for high-value work.
- 🧠 **Improve quality** with explicit escalation rules for difficult tasks.
- 🧭 **Keep workflows transparent** with visible tier banners, toast messages, and context handoff prompts.
- 🔒 **Constrain capabilities** per tier with permissions and tool access rules.

> [!IMPORTANT]
> oc-router is designed for **OpenCode 0.11.0+**. Older OpenCode versions may not support the same agent, tool, or configuration behavior.

---

## ✨ Features

- 🤖 **Automatic routing** — classify a user request and select the best tier.
- 🎯 **Manual routing** — force a tier with prefixes such as `/fast`, `/balanced`, or `/large`.
- 🔁 **Context handoff** — generate clear handoff prompts for `@fast`, `@balanced`, and `@large` agents.
- 🎨 **Tier identity** — customize names, colors, icons, and prompt templates.
- 🛡️ **Permissions by tier** — restrict tools, shell access, file writes, network usage, and Git operations.
- 👤 **Persona overrides** — define tier-specific roles and behavior.
- 🖥️ **Display controls** — configure banners, banner position, toast notifications, and concise routing summaries.
- 🧩 **Project-aware configuration** — combine global defaults with project-local overrides.
- 🛠️ **Developer-friendly CLI** — inspect, validate, reset, and manage router configuration.

---

## 📦 Installation

### From source (clone and install)

```bash
git clone https://github.com/RuslanKoroy/oc-router.git
cd oc-router
npm install -g .
```

### Platform-specific scripts

**Linux / macOS:**

```bash
./install.sh
npm install -g .
```

**Windows (PowerShell):**

```powershell
.\install.ps1
npm install -g .
```

**Windows (CMD):**

```cmd
npm install -g .
```

### Verify installation

```bash
oc-router doctor
```

After installation, restart OpenCode or reload your shell session.

### Development install

Use this mode when you want to modify oc-router locally.

```bash
git clone https://github.com/RuslanKoroy/oc-router.git
cd oc-router
npm install
npm run build
npm link
```

---

## 🚀 Quick Start

### 1. Install oc-router

```bash
git clone https://github.com/RuslanKoroy/oc-router.git
cd oc-router
./install.sh
```

### 2. Initialize configuration

```bash
oc-router init --global
```

### 3. Verify installation

```bash
oc-router --version
oc-router status
```

### 4. Use OpenCode normally

```text
Fix the failing tests and explain the root cause.
```

oc-router will classify the request and route it to the most suitable tier.

---

### Initialize oc-router

Create your initial configuration file:

```bash
# Global configuration (recommended for terminal-wide usage)
oc-router init --global

# Project-specific configuration
oc-router init --project
```

> 💡 **What's the difference?**
> 
> - `--global`: Creates `~/.config/oc-router/config.json` (Linux/macOS) or `%APPDATA%\oc-router\config.json` (Windows)
> - `--project`: Creates `.oc-router/config.json` in your current repository
>
> **Recommendation**: Use `--global` for terminal-wide settings, and `--project` for repository-specific overrides.

---

## ⚙️ Configuration

oc-router configuration defines how routing decisions are made, how tiers behave, how routing is displayed, and what each tier is allowed to do.

Configuration can be stored globally for all projects or locally inside a project.

### Configuration file locations

#### Linux / macOS
- **Global:** `~/.config/oc-router/config.json` or `~/.oc-router/config.json`
- **Project:** `.oc-router/config.json` (repository root)

#### Windows
- **Global:** `%APPDATA%\oc-router\config.json` (typically `C:\Users\<Username>\AppData\Roaming\oc-router\`)
- **Project:** `.oc-router\config.json` (repository root)

> 💡 **Tip:** Run `oc-router config show` to see the actual path to your current config file.

### Complete JSON example

The following example shows a comprehensive configuration with realistic defaults and all major option groups.

```jsonc
{
  // Schema version for future migrations.
  "version": 1,

  // Routing controls how oc-router chooses an agent tier.
  "routing": {
    // Supported values:
    // - "auto": classify each request and select a tier automatically
    // - "manual": route only when a forced prefix is used
    // - "off": disable routing behavior
    "mode": "auto",

    // Prefixes that force a tier when used at the beginning of a message.
    "forcedPrefixes": {
      "fast": "/fast",
      "balanced": "/balanced",
      "large": "/large"
    },

    // When true, oc-router includes a concise reason for the selected tier.
    "showDecisionReason": true,

    // If classification fails, this tier is used as a safe fallback.
    "fallbackTier": "balanced"
  },

  // Router model settings control the lightweight classifier itself.
  "routerModel": {
    "provider": "openai",
    "model": "gpt-4.1-mini",
    "temperature": 0,
    "maxTokens": 256,
    "timeoutMs": 10000,
    "retryAttempts": 1,
    "fallbackOnError": true
  },

  // Display options control what users see when routing happens.
  "display": {
    "banner": {
      "enabled": true,
      // Supported values: "top", "bottom", "inline", "hidden"
      "position": "top",
      "showTierIcon": true,
      "showTierName": true,
      "showModel": true,
      "showReason": true
    },
    "toast": {
      "enabled": true,
      "durationMs": 3500,
      "showOnAutomaticRouting": true,
      "showOnForcedRouting": true,
      "showOnFailure": true
    },
    "colors": {
      "enabled": true,
      "respectNoColor": true
    }
  },

  // Tier definitions describe the available execution profiles.
  "tiers": {
    "fast": {
      "label": "Fast",
      "icon": "⚡",
      "color": "cyan",
      "description": "Low-latency tier for simple edits, summaries, and straightforward commands.",
      "model": {
        "provider": "anthropic",
        "model": "claude-3-5-haiku-latest",
        "temperature": 0.2,
        "maxTokens": 4096
      },
      "promptTemplate": "You are @fast, an OpenCode Router tier agent. Optimize for speed, concise answers, and safe simple edits. Escalate when requirements are ambiguous or risky.",
      "permissions": {
        "tools": {
          "read": true,
          "write": true,
          "edit": true,
          "bash": true,
          "webfetch": false,
          "browser": false
        },
        "filesystem": {
          "allowWrite": true,
          "allowDelete": false,
          "allowedPaths": ["./"],
          "blockedPaths": [".env", ".env.*", "**/secrets/**"]
        },
        "shell": {
          "enabled": true,
          "allowNetwork": false,
          "allowLongRunning": false,
          "blockedCommands": ["rm -rf", "git push", "sudo"]
        },
        "git": {
          "status": true,
          "diff": true,
          "commit": false,
          "push": false,
          "forcePush": false
        }
      },
      "capabilities": {
        "bestFor": ["small edits", "formatting", "simple documentation", "quick explanations"],
        "avoidFor": ["architecture", "security-sensitive changes", "complex debugging"]
      },
      "persona": {
        "role": "Fast implementation assistant",
        "tone": "brief, direct, practical",
        "overrideSystemStyle": false
      }
    },

    "balanced": {
      "label": "Balanced",
      "icon": "⚖️",
      "color": "yellow",
      "description": "Default tier for normal feature work, refactoring, and medium-complexity debugging.",
      "model": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-latest",
        "temperature": 0.2,
        "maxTokens": 8192
      },
      "promptTemplate": "You are @balanced, an OpenCode Router tier agent. Balance speed and depth. Ask only necessary clarifying questions, make surgical changes, and verify results.",
      "permissions": {
        "tools": {
          "read": true,
          "write": true,
          "edit": true,
          "bash": true,
          "webfetch": true,
          "browser": true
        },
        "filesystem": {
          "allowWrite": true,
          "allowDelete": true,
          "allowedPaths": ["./"],
          "blockedPaths": [".env", ".env.*", "**/credentials/**", "**/secrets/**"]
        },
        "shell": {
          "enabled": true,
          "allowNetwork": true,
          "allowLongRunning": false,
          "blockedCommands": ["rm -rf /", "sudo", "chmod -R 777"]
        },
        "git": {
          "status": true,
          "diff": true,
          "commit": true,
          "push": false,
          "forcePush": false
        }
      },
      "capabilities": {
        "bestFor": ["feature implementation", "refactoring", "test fixes", "documentation rewrites"],
        "avoidFor": ["high-risk migrations", "deep architecture decisions"]
      },
      "persona": {
        "role": "Balanced software engineering assistant",
        "tone": "professional, clear, solution-oriented",
        "overrideSystemStyle": false
      }
    },

    "large": {
      "label": "Large",
      "icon": "🧠",
      "color": "magenta",
      "description": "Highest-reasoning tier for architecture, security, difficult bugs, and expensive decisions.",
      "model": {
        "provider": "openai",
        "model": "gpt-5.5",
        "temperature": 0.1,
        "maxTokens": 16384
      },
      "promptTemplate": "You are @large, an OpenCode Router tier agent. Use deep reasoning for architecture, research, complex debugging, security-sensitive changes, and high-quality code generation.",
      "permissions": {
        "tools": {
          "read": true,
          "write": true,
          "edit": true,
          "bash": true,
          "webfetch": true,
          "browser": true
        },
        "filesystem": {
          "allowWrite": true,
          "allowDelete": true,
          "allowedPaths": ["./"],
          "blockedPaths": [".env", ".env.*", "**/*.pem", "**/*.key", "**/secrets/**"]
        },
        "shell": {
          "enabled": true,
          "allowNetwork": true,
          "allowLongRunning": true,
          "blockedCommands": ["rm -rf /", "mkfs", "dd if=", "chmod -R 777"]
        },
        "git": {
          "status": true,
          "diff": true,
          "commit": true,
          "push": true,
          "forcePush": false
        }
      },
      "capabilities": {
        "bestFor": ["architecture", "security review", "complex debugging", "large refactors", "non-obvious solutions"],
        "avoidFor": ["tiny formatting changes", "trivial one-line edits"]
      },
      "persona": {
        "role": "Senior architecture and debugging assistant",
        "tone": "precise, rigorous, concise",
        "overrideSystemStyle": true,
        "customInstructions": "Prefer correctness over speed. Surface assumptions, risks, and verification steps."
      }
    }
  },

  // Context handoff settings control prompts generated for @tier agents.
  "contextHandoff": {
    "enabled": true,
    "includeFilesRead": true,
    "includeCommandsRun": true,
    "includeCurrentPlan": true,
    "includeKnownRisks": true,
    "maxTokens": 4000
  },

  // Failure handling keeps OpenCode usable when the router cannot classify a request.
  "failureHandling": {
    "onRouterTimeout": "fallback-tier",
    "onInvalidConfig": "manual-only",
    "onMissingTier": "fallback-tier",
    "fallbackMessage": "Router classification failed; using the configured fallback tier."
  }
}
```

> [!TIP]
> The example uses `jsonc` so comments can explain each option. If your configuration loader requires strict JSON, remove comments before saving.

### Global vs project configuration

oc-router can load configuration from two levels:

| Scope | Purpose | Typical location |
|---|---|---|
| Global config | Defaults shared across all projects | OpenCode or user configuration directory |
| Project config | Repository-specific overrides | Project-local oc-router configuration file |

Recommended behavior:

1. Put stable defaults in the global config.
2. Put project-specific model choices, permissions, and tier behavior in project config.
3. Keep secrets out of config files. Use your provider or OpenCode secret management instead.

### CLI commands for config management

```bash
oc-router config show
oc-router config validate
oc-router config set routing.mode auto
oc-router config set routing.fallbackTier balanced
oc-router config reset
```

---

## 🧑‍💻 Usage

### Automatic routing

When routing mode is set to `auto`, write your request normally:

```text
Analyze this failing integration test, identify the root cause, and implement a fix.
```

oc-router classifies the request and selects a tier such as `balanced` or `large`.

### Forced tier prefixes

Use a forced prefix when you already know which tier should handle the task.

```text
/fast Fix the typo in the README heading.
```

```text
/balanced Add tests for the config parser and update the implementation.
```

```text
/large Review this authentication flow for security issues and propose a safer architecture.
```

| Prefix | Tier | Best for |
|---|---|---|
| `/fast` | `fast` | Simple edits, short answers, low-risk tasks |
| `/balanced` | `balanced` | Normal coding, tests, refactoring, documentation |
| `/large` | `large` | Architecture, security, hard debugging, high-risk changes |

---

## 🧰 CLI Commands

| Command | Description | Example |
|---|---|---|
| `oc-router --help` | Show CLI help | `oc-router --help` |
| `oc-router --version` | Show installed version | `oc-router --version` |
| `oc-router init` | Create initial configuration | `oc-router init --global` |
| `oc-router models` | Discover available models | `oc-router models` |
| `oc-router status` | Check current routing status | `oc-router status` |
| `oc-router enable` | Enable a tier | `oc-router enable fast` |
| `oc-router disable` | Disable a tier | `oc-router disable large` |
| `oc-router config show` | Print effective configuration | `oc-router config show` |
| `oc-router config validate` | Validate configuration syntax and required fields | `oc-router config validate` |
| `oc-router config set <path> <value>` | Set a configuration value | `oc-router config set routing.mode auto` |
| `oc-router config get <path>` | Read a configuration value | `oc-router config get routing.mode` |
| `oc-router config reset` | Reset configuration to defaults | `oc-router config reset` |
| `oc-router route <prompt>` | Classify a prompt and print selected tier | `oc-router route "Fix this failing test"` |
| `oc-router tiers list` | List configured tiers | `oc-router tiers list` |
| `oc-router tiers show <tier>` | Show one tier definition | `oc-router tiers show large` |
| `oc-router doctor` | Run environment and installation checks | `oc-router doctor` |

> [!NOTE]
> Exact command availability may depend on the installed oc-router version. Use `oc-router --help` as the source of truth for your local installation.

---

## 🏗️ Architecture

oc-router sits between the user request and OpenCode tier execution.

```text
┌──────────────────┐
│   User Prompt    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    oc-router     │
│  prefix parser   │
└────────┬─────────┘
         │
         ├────────────── forced prefix ───────────────┐
         │                                            │
         ▼                                            ▼
┌──────────────────┐                         ┌────────────────────┐
│ Router Classifier│                         │ Selected Tier      │
│ auto/manual/off  │                         │ fast/balanced/large│
└────────┬─────────┘                         └────────┬───────────┘
         │                                            │
         ▼                                            ▼
┌──────────────────┐                         ┌───────────────────┐
│ Fallback Policy  │────────────────────────▶│ OpenCode Agent    │
└──────────────────┘                         └───────────────────┘
```

### Tier selection guide

| Signal | Suggested tier |
|---|---|
| Typo, formatting, tiny documentation edit | `fast` |
| Normal feature, tests, CLI behavior, moderate refactor | `balanced` |
| Architecture, security, concurrency, data loss risk, unclear bug | `large` |
| Router error or uncertain classification | Configured fallback tier |

---

## 🧯 Troubleshooting

### Router does not activate

**Symptoms**

- Forced prefixes are ignored.
- No routing banner or toast appears.

**Solutions**

```bash
oc-router doctor
oc-router config show
oc-router config validate
```

Also verify that you are using **OpenCode 0.11.0+**.

### Invalid configuration

**Symptoms**

- oc-router falls back to manual mode.
- Configuration validation fails.

**Solutions**

- Validate JSON syntax.
- Remove comments if the loader expects strict JSON.
- Check that every tier referenced by routing settings exists in `tiers`.

```bash
oc-router config validate
```

### Wrong tier selected

**Symptoms**

- Simple tasks go to `large`.
- Complex tasks go to `fast`.

**Solutions**

- Add stronger tier descriptions.
- Update `capabilities.bestFor` and `capabilities.avoidFor`.
- Use forced prefixes for critical tasks.

```text
/large Debug this race condition and explain the failure mode.
```

### Colors or banners look broken

**Symptoms**

- Terminal output has incorrect colors.
- Banner appears in an inconvenient location.

**Solutions**

```bash
oc-router config set display.colors.enabled false
oc-router config set display.banner.position inline
```

### Router model timeout

**Symptoms**

- Automatic routing is slow.
- Fallback tier is used frequently.

**Solutions**

- Reduce `routerModel.timeoutMs` only if you prefer faster fallback.
- Increase `routerModel.timeoutMs` if your provider is slow.
- Keep `routerModel.fallbackOnError` enabled.

---

## 🛠️ Development

### Requirements

- Node.js 18+
- npm
- OpenCode 0.11.0+
- TypeScript

### Build

```bash
npm install
npm run build
```

### Test

```bash
npm test
```

### Development workflow

```bash
git clone https://github.com/RuslanKoroy/oc-router.git
cd oc-router
npm install
npm run build
npm test
```

---

## 🙌 Credits

Created and maintained by **RuslanKoroy**.

- GitHub: [RuslanKoroy](https://github.com/RuslanKoroy)
- Telegram: [t.me/xkcd0000](https://t.me/xkcd0000)
- TG Channel: [t.me/curseknowledge](https://t.me/curseknowledge)
- Repository: [github.com/RuslanKoroy/oc-router](https://github.com/RuslanKoroy/oc-router)

If oc-router helps your OpenCode workflow, consider starring the repository and sharing feedback.
