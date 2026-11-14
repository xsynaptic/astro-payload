import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, test } from 'vitest';

import { isSafeHref, toSafeHref } from '#safe-href.ts';

const safe = [
	'https://example.com/path?query=1#top',
	'http://localhost:4322/page',
	'HTTPS://EXAMPLE.COM',
	'mailto:editor@example.com',
	'tel:+15555550100',
	'/posts/a-slug',
	'#section',
];

const unsafe = [
	'javascript:alert(document.domain)',
	'JaVaScRiPt:alert(1)',
	'java\nscript:alert(1)',
	'\u{1}javascript:alert(1)',
	'data:text/html,<script>alert(1)</script>',
	'vbscript:msgbox(1)',
	'//example.com/path',
	String.raw`/\example.com/path`,
	'/\t/example.com/path',
	String.raw` /\example.com`,
	'example.com',
	'',
];

describe('toSafeHref', () => {
	test.each(safe)('keeps %j', (value) => {
		expect(toSafeHref(value)).toBe(value);
	});

	test.each(unsafe)('replaces %j with a fragment', (value) => {
		expect(toSafeHref(value)).toBe('#');
	});

	test('judges the value a browser would see once it strips surrounding whitespace', () => {
		expect(toSafeHref('  https://example.com\n')).toBe('https://example.com');
		expect(toSafeHref(' \tjavascript:alert(1)')).toBe('#');
	});

	test('treats a missing value as unsafe', () => {
		expect(toSafeHref(undefined)).toBe('#');
	});
});

describe('isSafeHref', () => {
	test.each(safe)('accepts %j', (value) => {
		expect(isSafeHref(value)).toBe(true);
	});

	test.each(unsafe)('rejects %j', (value) => {
		expect(isSafeHref(value)).toBe(false);
	});
});

const site = new URL('https://site.example/');
const leadingWhitespace = fc.string({ maxLength: 2, unit: fc.constantFrom(' ', '\t', '\n') });
const pathTail = fc.string({
	maxLength: 8,
	unit: fc.constantFrom('/', '\\', '\t', '\n', '\r', ' ', 'e', '.', ':', '@', '?', '#'),
});

describe('relative hrefs', () => {
	propertyTest.prop([leadingWhitespace, pathTail])(
		'a relative href that passes resolves to the site it appears on',
		(whitespace, tail) => {
			const href = toSafeHref(`${whitespace}/${tail}`);
			if (href === '#') return;

			expect(new URL(href, site).origin).toBe(site.origin);
		},
	);
});
