import { describe, expect, it } from 'vitest';

import { textFormat } from '#constants.ts';
import { getActiveFormat, getTextStyle } from '#converters/text.ts';
import textFormats from '#tests/fixtures/text-formats.json' with { type: 'json' };
import textStyles from '#tests/fixtures/text-styles.json' with { type: 'json' };
import { renderCore } from '#tests/render-test-utils.ts';

describe('getActiveFormat', () => {
	it('resolves another format before code, so code renders innermost', () => {
		expect(getActiveFormat(textFormat.bold | textFormat.code)).toBe('bold');
		expect(getActiveFormat(textFormat.italic | textFormat.code)).toBe('italic');
	});

	it('resolves code once every other format is stripped', () => {
		expect(getActiveFormat(textFormat.code)).toBe('code');
	});

	it('resolves highlight first, so the mark spans every other format', () => {
		expect(getActiveFormat(textFormat.superscript | textFormat.highlight)).toBe('highlight');
	});

	it('resolves superscript first among the remaining wrapping formats', () => {
		expect(getActiveFormat(textFormat.bold | textFormat.italic | textFormat.superscript)).toBe(
			'superscript',
		);
	});

	it('wraps nothing for a case bit, which styles rather than wraps', () => {
		expect(getActiveFormat(0)).toBe('none');
		expect(getActiveFormat(textFormat.uppercase)).toBe('none');
	});
});

describe('getTextStyle', () => {
	it('keeps the last of a repeated property, as CSS does', () => {
		expect(getTextStyle({ style: 'color: red; color: blue' }, ['color'])).toEqual({
			color: 'blue',
		});
	});

	it.each([
		'background-image: url(https://example.com/x.png)',
		'background-image: URL(x.png)',
		'background-image: image-set("x.png" 1x)',
		'background-image: -webkit-image-set("x.png" 1x)',
		'background-image: cross-fade("x.png", "y.png")',
		String.raw`background-image: \75rl(x.png)`,
	])('drops a value that could fetch a resource: %s', (style) => {
		expect(getTextStyle({ style }, ['background-image'])).toBeUndefined();
	});

	it('takes lowercase over the other case bits, as upstream does', () => {
		expect(getTextStyle({ format: textFormat.lowercase | textFormat.capitalize })).toEqual({
			'text-transform': 'lowercase',
		});
		expect(getTextStyle({ format: textFormat.uppercase | textFormat.capitalize })).toEqual({
			'text-transform': 'uppercase',
		});
	});
});

describe('text format', () => {
	it.each([
		['highlight', '<mark>highlighted</mark>'],
		['lowercase', '<span style="text-transform:lowercase">lower</span>'],
		['uppercase', '<span style="text-transform:uppercase">upper</span>'],
		['capitalize', '<span style="text-transform:capitalize">capitalized words</span>'],
		['highlight over bold', '<mark><strong>bold highlight</strong></mark>'],
		[
			'a case bit around code',
			'<span style="text-transform:uppercase"><code>upper code</code></span>',
		],
	])('renders %s', async (_label, expected) => {
		const { html, issues } = await renderCore(textFormats.root.children);

		expect(issues).toEqual([]);
		expect(html).toContain(expected);
	});
});

describe('text style', () => {
	it('renders no authored style without an allowlist', async () => {
		const { html, issues } = await renderCore(textStyles.root.children);

		expect(issues).toEqual([]);
		expect(html).not.toContain('color');
		expect(html).toContain('<p>coloured positioned malformed ');
	});

	it('renders the allowlisted properties of a text node', async () => {
		const { html } = await renderCore(textStyles.root.children, {
			textStyleProperties: ['color', 'font-size'],
		});

		expect(html).toContain('<span style="color:#1a5fb4;font-size:18px">coloured</span>');
	});

	it('drops every property the allowlist leaves out', async () => {
		const { html } = await renderCore(textStyles.root.children, {
			textStyleProperties: ['color'],
		});

		expect(html).toContain('<span style="color:#1a5fb4">coloured</span> positioned');
	});

	it('drops declarations with no property, no value or no colon, and a resource value', async () => {
		const { html } = await renderCore(textStyles.root.children, {
			textStyleProperties: ['background-color', 'color', 'font-size', ''],
		});

		expect(html).toContain('</span> positioned malformed <span');
	});

	it('lets a case bit win over an allowlisted text-transform', async () => {
		const { html } = await renderCore(textStyles.root.children, {
			textStyleProperties: ['color', 'text-transform'],
		});

		expect(html).toContain(
			'<span style="color:#1a5fb4;text-transform:uppercase">styled upper</span>',
		);
	});
});
