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
// More specific phrases come before the generic ones that would also match them
// (e.g. "due to the fact that" before "the fact that").
const VERBOSE_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
	// purpose
	[/\bin order to\b/gi, 'to'],
	[/\bso as to\b/gi, 'to'],
	[/\bfor the purpose of\b/gi, 'for'],
	// causation ("...the fact that" specifics first)
	[/\bdue to the fact that\b/gi, 'because'],
	[/\bowing to the fact that\b/gi, 'because'],
	[/\bin view of the fact that\b/gi, 'because'],
	[/\bin light of the fact that\b/gi, 'because'],
	[/\bby virtue of the fact that\b/gi, 'because'],
	[/\bon the grounds that\b/gi, 'because'],
	[/\bfor the reason that\b/gi, 'because'],
	[/\bgiven the fact that\b/gi, 'since'],
	// concession
	[/\b(?:in spite|despite) of the fact that\b/gi, 'although'],
	[/\bregardless of the fact that\b/gi, 'although'],
	// condition
	[/\bin the event that\b/gi, 'if'],
	[/\bon the off chance that\b/gi, 'if'],
	// reference / relation
	[/\bwith (?:regard|regards|respect) to\b/gi, 'regarding'],
	[/\bwith reference to\b/gi, 'regarding'],
	[/\bin relation to\b/gi, 'regarding'],
	[/\bin connection with\b/gi, 'regarding'],
	[/\bwhen it comes to\b/gi, 'for'],
	// instrument / accompaniment
	[/\bin accordance with\b/gi, 'per'],
	[/\bin conjunction with\b/gi, 'with'],
	[/\bwith the help of\b/gi, 'using'],
	[/\bby means of\b/gi, 'by'],
	[/\bwith the exception of\b/gi, 'except'],
	[/\bin the absence of\b/gi, 'without'],
	// time
	[/\b(?:in|during) the course of\b/gi, 'during'],
	[/\buntil such time as\b/gi, 'until'],
	[/\bduring the time that\b/gi, 'while'],
	[/\bat (?:this point in time|the present time|the present moment)\b/gi, 'now'],
	[/\bin the (?:near|not too distant) future\b/gi, 'soon'],
	[/\bprior to\b/gi, 'before'],
	[/\bin advance of\b/gi, 'before'],
	[/\bsubsequent to\b/gi, 'after'],
	[/\bfollowing the completion of\b/gi, 'after'],
	[/\bon a regular basis\b/gi, 'regularly'],
	[/\bon a (daily|weekly|monthly|quarterly|yearly) basis\b/gi, '$1'],
	[/\bin a timely manner\b/gi, 'promptly'],
	[/\bat all times\b/gi, 'always'],
	// quantity
	[/\ba large number of\b/gi, 'many'],
	[/\ba (?:significant|substantial|considerable) number of\b/gi, 'many'],
	[/\ba (?:small|limited) number of\b/gi, 'a few'],
	[/\ba (?:sufficient|adequate) number of\b/gi, 'enough'],
	[/\ba number of\b/gi, 'several'],
	[/\b(?:the|a) majority of\b/gi, 'most'],
	[/\ba great deal of\b/gi, 'much'],
	[/\bin most cases\b/gi, 'usually'],
	[/\bin many cases\b/gi, 'often'],
	// capability / action
	[/\b(?:has|have) the ability to\b/gi, 'can'],
	[/\b(?:has|have) the capacity to\b/gi, 'can'],
	[/\b(?:is|are) able to\b/gi, 'can'],
	[/\bmakes use of\b/gi, 'uses'],
	[/\bmake use of\b/gi, 'use'],
	[/\butilizes\b/gi, 'uses'],
	[/\butilize\b/gi, 'use'],
	[/\butilization\b/gi, 'use'],
	[/\btakes into (?:account|consideration)\b/gi, 'considers'],
	[/\btake into (?:account|consideration)\b/gi, 'consider'],
	// redundant pairs
	[/\beach and every\b/gi, 'every'],
	[/\bany and all\b/gi, 'all'],
	[/\bfirst and foremost\b/gi, 'first'],
	[/\bend result\b/gi, 'result'],
	[/\bfinal outcome\b/gi, 'outcome'],
	[/\bfuture plans\b/gi, 'plans'],
	[/\bpast history\b/gi, 'history'],
	[/\bcompletely eliminate\b/gi, 'eliminate'],
	[/\babsolutely essential\b/gi, 'essential'],
	[/\bbasic fundamentals\b/gi, 'fundamentals'],
	// connectives / generic (run after the specifics above)
	[/\bas well as\b/gi, 'and'],
	[/\bin addition to\b/gi, 'besides'],
	[/\bthe reason why\b/gi, 'why'],
	[/\b(?:the question )?as to whether\b/gi, 'whether'],
	[/\bwhether or not\b/gi, 'whether'],
	[/\bthe fact that\b/gi, 'that'],
];

// Phrases that add nothing to an instruction and can simply be deleted.
const FILLER_NOISE: ReadonlyArray<RegExp> = [
	/\bit is important to note that\b/gi,
	/\bit is worth noting that\b/gi,
	/\bit should be noted that\b/gi,
	/\bit goes without saying that\b/gi,
	/\bit is recommended that\b/gi,
	/\bplease (?:note|be advised) that\b/gi,
	/\bneedless to say\b/gi,
	/\bas a matter of fact\b/gi,
	/\bfor what it'?s worth\b/gi,
	/\bat the end of the day\b/gi,
	/\bin (?:my|our) (?:honest )?opinion\b/gi,
	/\bas you (?:can see|know|are aware)\b/gi,
	/\b(?:to be honest|in all honesty|honestly speaking)\b/gi,
	/\bfeel free to\b/gi,
	/\bgo ahead and\b/gi,
	/\b(?:basically|actually|essentially|simply|obviously|clearly|literally)\b/gi,
];

// Pure politeness — always safe to drop anywhere.
const POLITENESS: ReadonlyArray<RegExp> = [
	/\bplease\b/gi,
	/\bkindly\b/gi,
	/\bif (?:it'?s |it is )?possible\b/gi,
	/\bif you don'?t mind\b/gi,
	/\b(?:thank you|thanks)(?: (?:very much|so much|a lot|in advance))?[.!]?/gi,
];

// First-person request framing — safe to drop anywhere, leaving the imperative.
// e.g. "As a dev, I would like to build X" -> "As a dev, build X".
const FIRST_PERSON_PREAMBLES: ReadonlyArray<RegExp> = [
	/\bwhat i(?:'d| would)? (?:want|like)(?: you)? to do is (?:to )?/gi,
	/\bi (?:was )?wondering if you (?:could|can|would) /gi,
	/\bi(?:'d| would)? appreciate (?:it )?if you (?:could|would|can) /gi,
	/\bi(?:'d| would)? like for you to /gi,
	/\bi(?:'d| would)? (?:just )?(?:like|want)(?: you)? to /gi,
	/\bi(?:'m| am) (?:looking|hoping) to /gi,
	/\bi(?:'m| am) interested in /gi,
	/\bi need you to /gi,
	/\bi'?m trying to /gi,
];

// Question framing — only stripped at the start of a sentence so a genuine
// mid-sentence "how can you tell" is preserved. Leading boundary kept via `$1`.
const SENTENCE_START_PREAMBLES: ReadonlyArray<RegExp> = [
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
		for (const re of FIRST_PERSON_PREAMBLES) {
			out = out.replace(re, '');
		}
		for (const re of SENTENCE_START_PREAMBLES) {
			out = out.replace(re, '$1');
		}
		if (out !== before) {
			applied.push('filler words');
		}
	}

	// Clean up artifacts left by deletions: double spaces, space-before-punctuation,
	// a comma/semicolon swallowed by stronger punctuation, and orphaned leading
	// punctuation (e.g. removing "if possible," from the start of a sentence).
	if (options.removeFillerWords || options.simplifyVerbosePhrases) {
		out = out
			.replace(/[ \t]{2,}/g, ' ')
			.replace(/([,;:])(?:\s*[,;:])+/g, '$1')
			.replace(/ +([.,;:!?])/g, '$1')
			.replace(/([,;:]) *([.!?])/g, '$2')
			.replace(/^[ \t,;:]+/, '')
			.replace(/\n[ \t,;:]+/g, '\n');
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
