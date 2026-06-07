# Change Log

All notable changes to the "prompt-optimizer" extension will be documented in this file.

## [0.0.2]

- Remove first-person request framing (*I would like to*, *I want to*, *I'd like you to*, *I'm trying to*) anywhere in the prompt, not just at the start of a sentence — so prompts like "As a dev, I would like to build X" now compress.
- Lowered the required VS Code version to `^1.96.0`.

## [0.0.1]

Initial release.

- `@optimize` chat participant that compresses your prompt and forwards it to the model selected in Copilot Chat.
- Local, deterministic optimizations: verbose-phrase shortening, filler/politeness removal, whitespace collapsing. Code blocks and inline spans are preserved.
- Before/after token counts and percentage saved, using the selected model's tokenizer.
- Configurable rule groups and behavior via `promptOptimizer.*` settings.
