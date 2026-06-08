# Change Log

All notable changes to the "prompt-optimizer" extension will be documented in this file.

## [0.0.8]

- New **response brevity** feature (`promptOptimizer.responseBrevity`, off by default): appends a short "answer concisely" instruction to the forwarded prompt, cutting the model's **output** tokens — which are usually the bulk of a chat's cost. Customizable via `promptOptimizer.brevityInstruction`. The token-savings figure still reports input compression only, so it stays honest.

## [0.0.7]

- New **contractions** pass (`promptOptimizer.contractions`, on by default): contracts two-word phrases to save tokens — `do not` → `don't`, `it is` → `it's`, `cannot` → `can't`, `you are` → `you're`, `I will` → `I'll`, etc. Never contracts `have to` (which means *must*). Applies to almost every prompt.

## [0.0.6]

- Even more rules: extra de-nominalizations (*make a comparison between* → *compare*, *provide a description of* → *describe*, *give rise to* → *cause*, *put emphasis on* → *emphasize*, *take a look at* → *review*, *have an impact on* → *affect*), causation/basis reductions (*as a result of* → *because of*, *on the basis of* → *based on*, *in order for* → *for*), and prompt-framing removal (*your job is to*, *my goal is to*, *I was hoping you could*, *would it be possible to*).
- More filler (*by and large*, *to tell you the truth*, *do me a favor and*, *as far as I'm concerned*).

## [0.0.5]

- More optimization rules: de-nominalizations (*make a decision* → *decide*, *provide an explanation for* → *explain*, *is dependent on* → *depends on*, *come to the conclusion that* → *conclude that*), more synonym swaps (*the way in which* → *how*, *a wide variety of* → *various*, *all of the* → *all the*, *a total of* → removed, *in spite of* → *despite*, *in regards to* → *regarding*), more filler removal (*the bottom line is*, *as previously mentioned*, *that being said*, *for all intents and purposes*), more politeness (*at your earliest convenience*, *when you get a chance*).
- New "hedges" group removes empty intensifiers (*very*, *really*, *quite*, *kind of*, *sort of*, *pretty much*) under the `removeFillerWords` setting.

## [0.0.4]

- Renamed the extension identifier to `optimize-pilot` (the Marketplace requires globally-unique names and `prompt-optimizer` was taken). The display name stays "Prompt Optimizer". Install with `thavionai.optimize-pilot`.

## [0.0.3]

- Greatly expanded the rule set: ~60 verbose-phrase reductions (e.g. *is able to* → *can*, *take into account* → *consider*, *on a daily basis* → *daily*, *whether or not* → *whether*), more filler/noise removal (*it is worth noting that*, *feel free to*, *obviously*), more politeness patterns (*if possible*, *if you don't mind*), and more first-person framing (*I'm looking to*, *what I would like you to do is*).
- Smarter cleanup: removes orphaned leading punctuation and collapses doubled commas left behind by deletions.

## [0.0.2]

- Remove first-person request framing (*I would like to*, *I want to*, *I'd like you to*, *I'm trying to*) anywhere in the prompt, not just at the start of a sentence — so prompts like "As a dev, I would like to build X" now compress.
- Lowered the required VS Code version to `^1.96.0`.

## [0.0.1]

Initial release.

- `@optimize` chat participant that compresses your prompt and forwards it to the model selected in Copilot Chat.
- Local, deterministic optimizations: verbose-phrase shortening, filler/politeness removal, whitespace collapsing. Code blocks and inline spans are preserved.
- Before/after token counts and percentage saved, using the selected model's tokenizer.
- Configurable rule groups and behavior via `promptOptimizer.*` settings.
