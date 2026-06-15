---
description: Losslessly compress a long instruction/skill doc — drop duplicate blocks, then apply prose rules (no model call)
argument-hint: <document text, or paste a SKILL.md / CLAUDE.md>
---
Call the `compress_document` tool with the text below, then present:

1. The compressed document in a code block.
2. The stats line verbatim (tokens before → after, % saved, blocks before →
   after, duplicates removed, rules applied).

Do **not** rewrite, summarize, or re-order the text yourself — the tool is
deterministic: it only removes duplicate blocks and applies the prose rules,
and it never touches code. Relay its output.

Document to compress:
$ARGUMENTS
