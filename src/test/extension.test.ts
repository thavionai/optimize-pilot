import * as assert from 'assert';
import {
	optimizePrompt,
	estimateTokens,
	DEFAULT_OPTIONS,
	compressOutput,
	discover,
	compileCustomRules,
} from '../optimizer';
import { isProse, isLog, processAttachment, formatBundle } from '../attachments';

suite('optimizePrompt', () => {
	test('collapses whitespace and trims', () => {
		const { optimized } = optimizePrompt('Write   a\n\n\n\nfunction   .   ');
		assert.strictEqual(optimized, 'Write a\n\nfunction.');
	});

	test('removes politeness words', () => {
		const { optimized, applied } = optimizePrompt(
			'Please write a function. Thanks in advance!',
		);
		assert.strictEqual(optimized, 'write a function.');
		assert.ok(applied.includes('filler words'));
	});

	test('strips "could you" question framing at sentence start', () => {
		const { optimized } = optimizePrompt('Could you write a parser?');
		assert.strictEqual(optimized, 'write a parser?');
	});

	test('keeps mid-sentence "can you" intact', () => {
		const { optimized } = optimizePrompt('Explain how a compiler can you trust it');
		assert.ok(
			optimized.includes('can you'),
			`expected mid-sentence phrase preserved, got: ${optimized}`,
		);
	});

	test('removes first-person framing anywhere, not just sentence start', () => {
		const { optimized, applied } = optimizePrompt(
			'As a quant developer, I would like to develop a daily bot.',
		);
		assert.strictEqual(
			optimized,
			'As a quant developer, develop a daily bot.',
		);
		assert.ok(applied.includes('filler words'));
	});

	test('removes "I want to" / "I\'m trying to" framing', () => {
		assert.strictEqual(
			optimizePrompt('I want to build a parser.').optimized,
			'build a parser.',
		);
		assert.strictEqual(
			optimizePrompt("I'm trying to debug this loop.").optimized,
			'debug this loop.',
		);
	});

	test('shortens verbose phrases', () => {
		const { optimized } = optimizePrompt(
			'Refactor this in order to utilize the cache.',
		);
		assert.strictEqual(optimized, 'Refactor this to use the cache.');
	});

	test('shortens an extended set of verbose phrases', () => {
		assert.strictEqual(
			optimizePrompt('The model is able to run on a daily basis.').optimized,
			'The model can run daily.',
		);
		assert.strictEqual(
			optimizePrompt('Take into account the fact that the majority of users are mobile.').optimized,
			'consider that most users are mobile.',
		);
		assert.strictEqual(
			optimizePrompt('Handle a large number of requests whether or not it scales.').optimized,
			'Handle many requests whether it scales.',
		);
	});

	test('de-nominalizes buried verbs', () => {
		assert.strictEqual(
			optimizePrompt('Please make a decision and provide an explanation for the result.').optimized,
			'decide and explain the result.',
		);
		assert.strictEqual(
			optimizePrompt('The output is dependent on a wide variety of factors.').optimized,
			'The output depends on various factors.',
		);
	});

	test('reduces all/both/half of the and a total of', () => {
		assert.strictEqual(
			optimizePrompt('Refactor all of the modules in such a way that they pass.').optimized,
			'Refactor all the modules so that they pass.',
		);
		assert.strictEqual(
			optimizePrompt('Add a total of 5 retries.').optimized,
			'Add 5 retries.',
		);
	});

	test('removes hedges and empty intensifiers', () => {
		assert.strictEqual(
			optimizePrompt('This is a very really quite fragile module.').optimized,
			'This is a fragile module.',
		);
	});

	test('removes prompt/instruction framing', () => {
		assert.strictEqual(
			optimizePrompt('Your job is to make a comparison between the two algorithms.').optimized,
			'compare the two algorithms.',
		);
		assert.strictEqual(
			optimizePrompt('I was hoping you could provide a description of the API.').optimized,
			'describe the API.',
		);
		assert.strictEqual(
			optimizePrompt('Would it be possible to take a look at the config?').optimized,
			'review the config?',
		);
	});

	test('handles more de-nominalizations and causation', () => {
		assert.strictEqual(
			optimizePrompt('This has an impact on latency and gives rise to retries.').optimized,
			'This affects latency and causes retries.',
		);
	});

	test('strips orphaned leading punctuation after removal', () => {
		assert.strictEqual(
			optimizePrompt('If possible, refactor this.').optimized,
			'refactor this.',
		);
		assert.strictEqual(
			optimizePrompt("Refactor this, if you don't mind.").optimized,
			'Refactor this.',
		);
	});

	test('does not produce doubled commas', () => {
		const { optimized } = optimizePrompt(
			'Could you, please, write tests as well as docs?',
		);
		assert.ok(!/,,/.test(optimized), `doubled comma in: ${optimized}`);
		assert.ok(optimized.includes('and docs'));
	});

	test('preserves fenced code blocks verbatim', () => {
		const input = 'Optimize:\n```js\nconst   x =   1;  // please keep spacing\n```';
		const { optimized } = optimizePrompt(input);
		assert.ok(
			optimized.includes('const   x =   1;  // please keep spacing'),
			`code spacing/words should be untouched, got: ${optimized}`,
		);
	});

	test('preserves inline code spans', () => {
		const { optimized } = optimizePrompt('Use `a   please   b` here.');
		assert.ok(optimized.includes('`a   please   b`'));
	});

	test('handles code block at start and end', () => {
		const input = '```\nfoo\n```';
		const { optimized } = optimizePrompt(input);
		assert.strictEqual(optimized, '```\nfoo\n```');
	});

	test('respects disabled options', () => {
		const input = 'Please   keep   this.';
		const { optimized } = optimizePrompt(input, {
			...DEFAULT_OPTIONS,
			removeFillerWords: false,
			collapseWhitespace: false,
			simplifyVerbosePhrases: false,
			contractions: false,
		});
		assert.strictEqual(optimized, 'Please   keep   this.');
	});

	test('contracts two-word phrases', () => {
		assert.strictEqual(
			optimizePrompt('Do not change it; it is not ready and cannot run.').optimized,
			"don't change it; it isn't ready and can't run.",
		);
		const { applied } = optimizePrompt('It is broken.');
		assert.ok(applied.includes('contractions'));
	});

	test('does not contract "have to"', () => {
		assert.strictEqual(
			optimizePrompt('You have to handle errors but you have options.').optimized,
			"You have to handle errors but you've options.",
		);
	});

	test('estimateTokens approximates by length', () => {
		assert.strictEqual(estimateTokens('abcd'), 1);
		assert.strictEqual(estimateTokens('abcde'), 2);
	});
});

suite('customRules', () => {
	test('applies a literal user rule on word boundaries', () => {
		const { optimized, applied } = optimizePrompt('do it as soon as possible', {
			...DEFAULT_OPTIONS,
			customRules: [{ find: 'as soon as possible', replace: 'ASAP' }],
		});
		assert.strictEqual(optimized, 'do it ASAP');
		assert.ok(applied.includes('custom rules'));
	});

	test('ignores a malformed regex rule without throwing', () => {
		const rules = compileCustomRules([{ find: '(', replace: 'x', regex: true }]);
		assert.strictEqual(rules.length, 0);
	});

	test('never touches code spans', () => {
		const { optimized } = optimizePrompt('use `as soon as possible` here', {
			...DEFAULT_OPTIONS,
			customRules: [{ find: 'as soon as possible', replace: 'ASAP' }],
		});
		assert.ok(optimized.includes('`as soon as possible`'));
	});
});

suite('compressOutput', () => {
	test('collapses exact-repeat lines with a count', () => {
		const { compressed } = compressOutput('err\nerr\nerr\nok');
		assert.ok(compressed.includes('(×3)'), compressed);
		assert.ok(compressed.includes('ok'));
	});

	test('truncates oversized output to head + tail', () => {
		const lines = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n');
		const { compressed, linesBefore } = compressOutput(lines);
		assert.strictEqual(linesBefore, 500);
		assert.ok(compressed.includes('hidden by optimize-pilot'));
		assert.ok(compressed.includes('line 0'));
		assert.ok(compressed.includes('line 499'));
	});

	test('strips ANSI colour codes', () => {
		const { compressed } = compressOutput('\x1b[31mred\x1b[0m line');
		assert.strictEqual(compressed, 'red line');
	});
});

suite('discover', () => {
	test('reports per-group savings and totals', () => {
		const r = discover('Could you please write a function in order to parse it?');
		assert.ok(r.saved > 0);
		assert.ok(r.estTokensAfter < r.estTokensBefore);
		assert.ok(r.groups.length > 0);
	});
});

suite('attachments', () => {
	test('classifies prose vs code vs log by extension', () => {
		assert.ok(isProse('README.md'));
		assert.ok(isProse('notes.txt'));
		assert.ok(isLog('build.log'));
		assert.ok(!isProse('server.ts'));
		assert.ok(!isProse('config.yaml'));
		assert.ok(!isProse('Dockerfile')); // no extension -> preserve
	});

	test('compresses log attachments with output compression', () => {
		const a = processAttachment({
			name: 'build.log',
			content: 'warn\nwarn\nwarn\nwarn\ndone',
		});
		assert.strictEqual(a.mode, 'output');
		assert.ok(a.content.includes('(×4)'));
	});

	test('compresses prose attachments', () => {
		const a = processAttachment({
			name: 'doc.md',
			content: 'Please do not change it; I would like you to review it.',
		});
		assert.strictEqual(a.mode, 'prose');
		assert.strictEqual(a.content, "don't change it; review it.");
	});

	test('preserves code attachments byte-for-byte', () => {
		const code = 'def  f( x ):\n    return   x  # please keep';
		const a = processAttachment({ name: 'a.py', content: code });
		assert.strictEqual(a.mode, 'preserved');
		assert.strictEqual(a.content, code);
	});

	test('formatBundle delimits attachments and drops empty prompt', () => {
		const bundle = formatBundle('', [
			{ name: 'a.py', content: 'x=1', mode: 'preserved' },
		]);
		assert.ok(bundle.startsWith('----- Attached file: a.py -----'));
		assert.ok(bundle.includes('x=1'));
		assert.ok(!bundle.startsWith('\n'));
	});
});
