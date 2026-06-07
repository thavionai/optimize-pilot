// Local, deterministic prompt-compression engine.
//
// The goal is to cut tokens while preserving meaning. Code (fenced blocks and
// inline spans) is masked out before any prose rule runs and restored at the
// end, so source snippets are never rewritten.

export interface OptimizerOptions {
	/** Collapse runs of whitespace and excess blank lines. */
	collapseWhitespace: boolean;
	/** Drop politeness/preamble words that carry no instruction. */
	removeFillerWords: boolean;
	/** Swap wordy phrases for shorter, equivalent ones. */
	simplifyVerbosePhrases: boolean;
}

export interface OptimizationResult {
	/** The compressed prompt. */
	optimized: string;
	/** Human-readable names of the rule groups that actually changed text. */
	applied: string[];
}

export const DEFAULT_OPTIONS: OptimizerOptions = {
	collapseWhitespace: true,
	removeFillerWords: true,
	simplifyVerbosePhrases: true,
};

// Wordy phrase -> shorter equivalent. All replacements are meaning-preserving.
const VERBOSE_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
	[/\bin order to\b/gi, 'to'],
	[/\bdue to the fact that\b/gi, 'because'],
	[/\bin the event that\b/gi, 'if'],
	[/\b(?:in spite|despite) of the fact that\b/gi, 'although'],
	[/\bfor the purpose of\b/gi, 'for'],
	[/\bwith (?:regard|respect) to\b/gi, 'regarding'],
	[/\bin relation to\b/gi, 'regarding'],
	[/\ba large number of\b/gi, 'many'],
	[/\b(?:the|a) majority of\b/gi, 'most'],
	[/\bat (?:this point in time|the present time)\b/gi, 'now'],
	[/\bin the near future\b/gi, 'soon'],
	[/\bprior to\b/gi, 'before'],
	[/\bsubsequent to\b/gi, 'after'],
	[/\bmake use of\b/gi, 'use'],
	[/\butilize\b/gi, 'use'],
];

// Phrases that add nothing to an instruction and can simply be deleted.
const FILLER_NOISE: ReadonlyArray<RegExp> = [
	/\bit is important to note that\b/gi,
	/\bplease note that\b/gi,
	/\bneedless to say\b/gi,
	/\bas a matter of fact\b/gi,
	/\bin my opinion\b/gi,
	/\b(?:basically|actually|essentially)\b/gi,
];

// Pure politeness — always safe to drop anywhere.
const POLITENESS: ReadonlyArray<RegExp> = [
	/\bplease\b/gi,
	/\bkindly\b/gi,
	/\b(?:thank you|thanks)(?: (?:very much|so much|a lot|in advance))?[.!]?/gi,
];

// Request preambles — only stripped at the start of a line or sentence so we
// never mangle a genuine mid-sentence question like "how can you tell".
// The leading boundary is captured and re-emitted via `$1`.
const PREAMBLES: ReadonlyArray<RegExp> = [
	/(^|[\n.!?]\s*)i (?:was )?wondering if you (?:could|can|would) /gi,
	/(^|[\n.!?]\s*)i(?:'d| would)? (?:like|want)(?: you)? to /gi,
	/(^|[\n.!?]\s*)i need you to /gi,
	/(^|[\n.!?]\s*)(?:can|could|would|will) you(?:,? please)? /gi,
];

// A non-printing sentinel that no whitespace/punctuation rule can touch, used
// to fence off masked code while prose rules run.
const SENTINEL = String.fromCharCode(0);
const PLACEHOLDER = new RegExp(SENTINEL + '(\\d+)' + SENTINEL, 'g');

function maskCode(input: string): { masked: string; segments: string[] } {
	const segments: string[] = [];
	const stash = (m: string): string => {
		const i = segments.length;
		segments.push(m);
		return SENTINEL + i + SENTINEL;
	};
	// Fenced blocks first, then inline spans.
	const masked = input
		.replace(/```[\s\S]*?```/g, stash)
		.replace(/`[^`\n]+`/g, stash);
	return { masked, segments };
}

function restoreCode(text: string, segments: string[]): string {
	return text.replace(PLACEHOLDER, (_, i) => segments[Number(i)] ?? '');
}

function collapseWhitespace(s: string): string {
	return s
		.replace(/[ \t]+/g, ' ')    // runs of spaces/tabs -> single space
		.replace(/ *\n */g, '\n')   // trim spaces hugging newlines
		.replace(/\n{3,}/g, '\n\n') // at most one blank line
		.trim();
}

/**
 * Compress `input` according to `options`, leaving code untouched.
 */
export function optimizePrompt(
	input: string,
	options: OptimizerOptions = DEFAULT_OPTIONS,
): OptimizationResult {
	const applied: string[] = [];
	const { masked, segments } = maskCode(input);
	let out = masked;

	if (options.simplifyVerbosePhrases) {
		const before = out;
		for (const [re, rep] of VERBOSE_PHRASES) {
			out = out.replace(re, rep);
		}
		if (out !== before) {
			applied.push('verbose phrases');
		}
	}

	if (options.removeFillerWords) {
		const before = out;
		for (const re of FILLER_NOISE) {
			out = out.replace(re, '');
		}
		for (const re of POLITENESS) {
			out = out.replace(re, '');
		}
		for (const re of PREAMBLES) {
			out = out.replace(re, '$1');
		}
		if (out !== before) {
			applied.push('filler words');
		}
	}

	// Clean up artifacts left by deletions (double spaces, space-before-punctuation).
	if (options.removeFillerWords || options.simplifyVerbosePhrases) {
		out = out.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;:!?])/g, '$1');
	}

	if (options.collapseWhitespace) {
		const before = out;
		out = collapseWhitespace(out);
		if (out !== before) {
			applied.push('whitespace');
		}
	} else {
		out = out.trim();
	}

	return { optimized: restoreCode(out, segments), applied };
}

/** Rough fallback token estimate (~4 chars/token) when a model can't count. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}
