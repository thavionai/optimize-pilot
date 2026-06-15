// Helpers for folding attached files into the forwarded prompt.
//
// Prose attachments (markdown, plain text, etc.) are compressed with the prose
// engine; log/console files get output compression (dedupe/noise/truncate);
// everything else — source code, JSON, YAML, CSV — is preserved byte-for-byte,
// because trimming code is risky and low-value.

import {
	optimizePrompt,
	compressOutput,
	OptimizerOptions,
	DEFAULT_OPTIONS,
} from './optimizer';

const PROSE_EXTENSIONS = new Set([
	'md', 'markdown', 'mdx', 'txt', 'text', 'rst', 'adoc', 'asciidoc', 'org',
]);

// Log-like files are line-oriented noise, not prose — they get output
// compression rather than the prose rules.
const LOG_EXTENSIONS = new Set(['log', 'out', 'err']);

function ext(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** True when a filename looks like prose we can safely compress. */
export function isProse(name: string): boolean {
	return PROSE_EXTENSIONS.has(ext(name));
}

/** True when a filename looks like line-oriented log/console output. */
export function isLog(name: string): boolean {
	return LOG_EXTENSIONS.has(ext(name));
}

export interface ResolvedAttachment {
	/** Display name (file basename or "selection"). */
	name: string;
	/** Raw text content. */
	content: string;
}

/** How an attachment's content was handled. */
export type AttachmentMode = 'prose' | 'output' | 'preserved';

export interface ProcessedAttachment {
	name: string;
	content: string;
	/** "prose" = prose rules, "output" = log compression, "preserved" = verbatim. */
	mode: AttachmentMode;
}

/**
 * Compress prose attachments with the prose rules and log attachments with
 * output compression; preserve everything else verbatim.
 */
export function processAttachment(
	att: ResolvedAttachment,
	options: OptimizerOptions = DEFAULT_OPTIONS,
	compressLogs = true,
): ProcessedAttachment {
	if (isProse(att.name)) {
		const { optimized } = optimizePrompt(att.content, options);
		return { name: att.name, content: optimized, mode: 'prose' };
	}
	if (compressLogs && isLog(att.name)) {
		const { compressed } = compressOutput(att.content);
		return { name: att.name, content: compressed, mode: 'output' };
	}
	return { name: att.name, content: att.content, mode: 'preserved' };
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
