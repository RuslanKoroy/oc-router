# oc-router — Release Package

## Package Info

| Field     | Value                                                      |
|-----------|------------------------------------------------------------|
| **Name**  | `oc-router`                                                |
| **Version** | `0.1.0`                                                  |
| **License** | MIT                                                      |
| **Type**  | ESM (`"type": "module"`)                                   |
| **Entry** | `dist/index.js`                                            |

## Included Files

```
release/
├── package.json          # npm package manifest (name, exports, bin, files)
├── package-lock.json     # Dependency lockfile for reproducible installs
├── README.md             # Full documentation (English)
├── .gitignore            # Standard gitignore (node_modules, dist, .env, etc.)
├── tsconfig.json         # TypeScript configuration (for reference)
├── RELEASE_NOTES.md      # This file
└── dist/                 # Compiled JavaScript + TypeScript declarations
    ├── cli.js            # CLI entry point (bin: oc-router)
    ├── cli.d.ts
    ├── plugin.js         # OpenCode plugin entry point
    ├── plugin.d.ts
    ├── index.js          # Main module export
    ├── index.d.ts
    ├── router.js         # Routing logic
    ├── router.d.ts
    ├── config.js         # Configuration management
    ├── config.d.ts
    ├── display.js        # Banner / toast display
    ├── display.d.ts
    ├── prompts.js        # Prompt templates
    ├── prompts.d.ts
    ├── install.js        # Installation routines (init, agents, plugin)
    ├── install.d.ts
    ├── onboarding.js     # First-run onboarding
    ├── onboarding.d.ts
    ├── models-report.js  # Models discovery and reporting
    ├── models-report.d.ts
    ├── model-id.js       # Model ID utilities
    ├── model-id.d.ts
    ├── paths.js          # Platform path resolution
    ├── paths.d.ts
    ├── types.js          # Shared type definitions
    └── types.d.ts
```

## npm Exports

```json
{
  ".":      "./dist/index.js",
  "./plugin": "./dist/plugin.js",
  "./cli":  "./dist/cli.js"
}
```

## CLI Binary

```
oc-router → ./dist/cli.js
```

## Verification Checklist

Before publishing, verify:

1. **Build is fresh** — `dist/` contains `.js` and `.d.ts` for every source file.
2. **package.json is valid** — `npm pack --dry-run` should list `dist/` and `README.md`.
3. **No secrets** — grep for `password`, `token`, `api_key` in all files (only config examples should appear).
4. **No source code** — `src/` is intentionally excluded; only compiled `dist/` is shipped.
5. **No dev files** — `node_modules/`, `.git/`, `tests/`, `vitest.config.ts` are excluded.
6. **CLI works** — `node dist/cli.js --version` should print `0.1.0`.
7. **Imports resolve** — `node -e "import('oc-router').then(m => console.log(Object.keys(m)))"` should work after install.

## Quick Publish Test

```bash
cd release/
npm pack --dry-run          # Preview what would be published
npm publish --dry-run       # Full dry run
```
