import * as assert from 'assert';
import { optimizePrompt, estimateTokens, DEFAULT_OPTIONS } from '../optimizer';

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
		});
		assert.strictEqual(optimized, 'Please   keep   this.');
	});

	test('estimateTokens approximates by length', () => {
		assert.strictEqual(estimateTokens('abcd'), 1);
		assert.strictEqual(estimateTokens('abcde'), 2);
	});
});
