---
description: Compress text with the deterministic optimizer (token savings, no model call)
argument-hint: <text to compress>
---
Call the `optimize_prompt` tool with the text below, then present:

1. The optimized text in a code block.
2. The one-line stats the tool returns (estimated tokens before → after, % saved, rules applied).

Do **not** rewrite, summarize, or add to the text yourself — the optimizer is
deterministic and rule-based; just relay its output verbatim.

Text to compress:
$ARGUMENTS
