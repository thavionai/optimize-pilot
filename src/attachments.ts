// Helpers for folding attached files into the forwarded prompt.
//
// Prose attachments (markdown, plain text, etc.) are compressed with the same
// engine; everything else — source code, JSON, YAML, CSV — is preserved
// byte-for-byte, because trimming code is risky and low-value.

import { optimizePrompt, OptimizerOptions, DEFAULT_OPTIONS } from './optimizer';

const PROSE_EXTENSIONS = new Set([
	'md', 'markdown', 'mdx', 'txt', 'text', 'rst', 'adoc', 'asciidoc', 'org',
]);

/** True when a filename looks like prose we can safely compress. */
export function isProse(name: string): boolean {
	const dot = name.lastIndexOf('.');
	if (dot < 0) {
		return false; // no extension -> treat as code/data, preserve
	}
	return PROSE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export interface ResolvedAttachment {
	/** Display name (file basename or "selection"). */
	name: string;
	/** Raw text content. */
	content: string;
}

export interface ProcessedAttachment {
	name: string;
	content: string;
	/** Whether the content was compressed (prose) or preserved (code). */
	prose: boolean;
}

/** Compress prose attachments; preserve everything else verbatim. */
export function processAttachment(
	att: ResolvedAttachment,
	options: OptimizerOptions = DEFAULT_OPTIONS,
): ProcessedAttachment {
	if (isProse(att.name)) {
		const { optimized } = optimizePrompt(att.content, options);
		return { name: att.name, content: optimized, prose: true };
	}
	return { name: att.name, content: att.content, prose: false };
}

/**
 * Combine the (already optimized) prompt with processed attachments into one
 * message. Uses plain delimiters rather than code fences so file contents that
 * themselves contain ``` are never ambiguous.
 */
export function formatBundle(
	prompt: string,
	attachments: ProcessedAttachment[],
): string {
	const blocks = attachments.map(
		(a) =>
			`----- Attached file: ${a.name} -----\n${a.content}\n----- End: ${a.name} -----`,
	);
	return [prompt.trim(), ...blocks].filter((s) => s.length > 0).join('\n\n');
}
