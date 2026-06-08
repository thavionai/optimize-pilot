# Optimize Pilot

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/thavionai.optimize-pilot?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=thavionai.optimize-pilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A VS Code extension that **compresses your Copilot Chat prompts to save tokens** before they are sent to the model you selected — without changing what you mean.

It registers a chat participant, `@optimize`, in the Copilot Chat panel. You type your prompt, it strips away the parts that cost tokens but carry no instruction, shows you how much it saved, and forwards the slimmed-down prompt — together with any files you attached — to the model picked in the chat model dropdown.

## Features

- **Deterministic compression** — ~120 meaning-preserving rules (verbose phrases, filler/politeness, hedges, request framing) plus contractions. Local, instant, and free; never touches code.
- **Token savings, shown** — before/after counts and % saved, using the selected model's own tokenizer.
- **Attachments** — `#`-attached files are folded in: prose compressed, code preserved byte-for-byte.
- **Response brevity** (opt-in) — appends a "be concise" instruction to cut the model's *output* tokens, which usually dominate cost.
- **Fully configurable** — every rule group and behavior toggles via `promptOptimizer.*` settings.
- **Also a Claude Code plugin** — the same engine as a `/optimize` command + `optimize_prompt` MCP tool.

- **Repository:** https://github.com/thavionai/optimize-pilot
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=thavionai.optimize-pilot

## Install

**From the Marketplace** — search for *Optimize Pilot* in the Extensions view (`Cmd/Ctrl+Shift+X`), or:

```bash
code --install-extension thavionai.optimize-pilot
```

**From a `.vsix`** — download `optimize-pilot-<version>.vsix` from the
[releases page](https://github.com/thavionai/optimize-pilot/releases) and:

```bash
code --install-extension optimize-pilot-<version>.vsix
```

## How it works

```
@optimize Could you please refactor this function in order to utilize the cache? Thanks!
```

Optimize Pilot rewrites that to:

```
refactor this function to use the cache?
```

then sends it to the selected model and streams the answer back — reporting something like:

> **Tokens:** 18 → 8 (saved 10, 56%)
> **Model:** GPT-4o
> **Applied:** verbose phrases, filler words

### Why a chat participant?

GitHub Copilot Chat does not expose an API that lets a third-party extension rewrite text typed into its own input box. The supported path is the [Chat Participant API](https://code.visualstudio.com/api/extension-guides/chat) combined with the [Language Model API](https://code.visualstudio.com/api/extension-guides/language-model): `@optimize` receives your prompt, optimizes it locally, then calls the **same model you selected** via `vscode.lm`. So the model only ever sees the optimized prompt.

## Optimizations

All compression is **local, deterministic, and free** — no tokens are spent optimizing. Code (fenced blocks and inline `` `spans` ``) is never modified.

| Rule group | Example |
|---|---|
| Verbose phrases | `in order to` → `to`, `utilize` → `use`, `make a decision` → `decide` |
| Filler / politeness | removes `please`, `kindly`, `thanks`, hedges (`very`, `really`), and framing (`could you`, `your job is to`) |
| Contractions | `do not` → `don't`, `it is` → `it's`, `cannot` → `can't` |
| Whitespace | collapses repeated spaces and blank lines |

Request preambles like *"could you"* are only removed at the start of a sentence, so a genuine mid-sentence phrase is preserved.

### Attachments

Files you attach with `#` are folded into the forwarded request. **Prose**
files (`.md`, `.txt`, `.rst`, …) are compressed with the same rules; **code**
and structured data (`.ts`, `.py`, `.json`, `.yaml`, …) are sent **byte-for-byte**
— trimming code is risky (whitespace is syntax in some languages) and low-value,
so it's deliberately avoided. The token figures cover the whole bundle. Binary
and very large (>512 KB) files are skipped.

## Settings

| Setting | Default | Description |
|---|---|---|
| `promptOptimizer.collapseWhitespace` | `true` | Collapse runs of whitespace and excess blank lines. |
| `promptOptimizer.removeFillerWords` | `true` | Remove politeness/preamble words. |
| `promptOptimizer.simplifyVerbosePhrases` | `true` | Replace wordy phrases with shorter equivalents. |
| `promptOptimizer.contractions` | `true` | Contract two-word phrases (e.g. `do not` → `don't`, `it is` → `it's`). |
| `promptOptimizer.includeAttachments` | `true` | Fold `#`-attached files into the request: compress prose (`.md`/`.txt`), preserve code/JSON/YAML verbatim. |
| `promptOptimizer.responseBrevity` | `false` | Append a short "be concise" instruction to the forwarded prompt. Cuts **output** tokens (usually the bulk of the cost), unlike compression which only trims input. |
| `promptOptimizer.brevityInstruction` | `""` | Custom brevity text; empty uses the built-in instruction. |
| `promptOptimizer.forwardToModel` | `true` | Send the optimized prompt to the model and stream the answer. When `false`, only the optimized prompt is shown. |
| `promptOptimizer.showSavings` | `true` | Show before/after token counts and percentage saved. |

## Input vs. output tokens

Prompt compression only trims your **input**. In a typical chat, the model's
**output** is the bulk of the token cost — and no prompt optimizer can shrink
that. To cut output tokens, enable **`promptOptimizer.responseBrevity`**, which
appends a short "answer concisely" instruction to the forwarded prompt. That
single line usually saves far more than input compression.

## Claude Code plugin

This repo also ships a **Claude Code plugin** that reuses the same deterministic
engine — useful for compressing text on demand (e.g. to paste into another LLM,
a system prompt, or a doc). It does **not** intercept Claude Code's own prompts
(the host can't rewrite them) and won't reduce your Claude Code token usage; it's
a portable text-compressor.

It provides:
- **`/optimize <text>`** slash command — returns the compressed text + token-savings stats.
- **`optimize_prompt`** MCP tool — Claude can call it to shrink text. Zero npm dependencies (a plain-stdio MCP server), so it runs immediately after install.

Install via Claude Code's plugin marketplace:
```
/plugin marketplace add thavionai/optimize-pilot
/plugin install optimize-pilot@thavionai
```
(or add `https://github.com/thavionai/optimize-pilot` in **Manage Plugins → Marketplaces**.)

Plugin sources live in [`claude/`](./claude); the marketplace manifest is
[`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json).

## Requirements

- VS Code `1.96.0` or newer.
- GitHub Copilot Chat (or any extension that provides language models via `vscode.lm`).

## Development

```bash
npm install
npm run watch     # incremental build
# press F5 in VS Code to launch the Extension Development Host
npm test          # run the optimizer test suite
npx vsce package  # build a .vsix
```

## Releasing

To cut a release:

```bash
npm version patch     # bump package.json
npm test              # verify
npx vsce package      # build optimize-pilot-<version>.vsix
```

Then publish by uploading the `.vsix` in the Marketplace web UI
(<https://marketplace.visualstudio.com/manage> → publisher → extension →
**… → Update**).

CI (`.github/workflows/ci.yml`) runs type-check, lint, and tests on every push
and PR. A manual publish workflow (`.github/workflows/publish.yml`,
`workflow_dispatch`) is available for CLI publishing once a `VSCE_PAT` secret
(Azure DevOps PAT, **Marketplace → Manage** scope) is configured.

## License

MIT
