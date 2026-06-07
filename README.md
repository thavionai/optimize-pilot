# Prompt Optimizer

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/thavionai.prompt-optimizer?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=thavionai.prompt-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A VS Code extension that **compresses your Copilot Chat prompts to save tokens** before they are sent to the model you selected — without changing what you mean.

It registers a chat participant, `@optimize`, in the Copilot Chat panel. You type your prompt, it strips away the parts that cost tokens but carry no instruction, shows you how much it saved, and forwards the slimmed-down prompt to the model picked in the chat model dropdown.

- **Repository:** https://github.com/thavionai/prompt-optimizer
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=thavionai.prompt-optimizer

## Install

**From the Marketplace** — search for *Prompt Optimizer* in the Extensions view (`Cmd/Ctrl+Shift+X`), or:

```bash
code --install-extension thavionai.prompt-optimizer
```

**From a `.vsix`** — download `prompt-optimizer-<version>.vsix` and:

```bash
code --install-extension prompt-optimizer-0.0.1.vsix
```

## How it works

```
@optimize Could you please refactor this function in order to utilize the cache? Thanks!
```

Prompt Optimizer rewrites that to:

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
| Verbose phrases | `in order to` → `to`, `utilize` → `use`, `due to the fact that` → `because` |
| Filler / politeness | removes `please`, `kindly`, `thanks`, and leading `could you` / `I'd like you to` |
| Whitespace | collapses repeated spaces and blank lines |

Request preambles like *"could you"* are only removed at the start of a sentence, so a genuine mid-sentence phrase is preserved.

## Settings

| Setting | Default | Description |
|---|---|---|
| `promptOptimizer.collapseWhitespace` | `true` | Collapse runs of whitespace and excess blank lines. |
| `promptOptimizer.removeFillerWords` | `true` | Remove politeness/preamble words. |
| `promptOptimizer.simplifyVerbosePhrases` | `true` | Replace wordy phrases with shorter equivalents. |
| `promptOptimizer.forwardToModel` | `true` | Send the optimized prompt to the model and stream the answer. When `false`, only the optimized prompt is shown. |
| `promptOptimizer.showSavings` | `true` | Show before/after token counts and percentage saved. |

## Requirements

- VS Code `1.120.0` or newer.
- GitHub Copilot Chat (or any extension that provides language models via `vscode.lm`).

## Development

```bash
npm install
npm run watch     # incremental build
# press F5 in VS Code to launch the Extension Development Host
npm test          # run the optimizer test suite
npx vsce package  # build a .vsix
```

## License

MIT
