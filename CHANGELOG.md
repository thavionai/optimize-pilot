# Change Log

All notable changes to the "prompt-optimizer" extension will be documented in this file.

## [0.0.1]

Initial release.

- `@optimize` chat participant that compresses your prompt and forwards it to the model selected in Copilot Chat.
- Local, deterministic optimizations: verbose-phrase shortening, filler/politeness removal, whitespace collapsing. Code blocks and inline spans are preserved.
- Before/after token counts and percentage saved, using the selected model's tokenizer.
- Configurable rule groups and behavior via `promptOptimizer.*` settings.
