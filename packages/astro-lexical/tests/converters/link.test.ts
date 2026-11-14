import { describe, expect, it } from 'vitest';

import { LexicalAutolinkNodeSchema, LexicalLinkNodeSchema } from '#schemas/lexical.ts';
import links from '#tests/fixtures/links.json' with { type: 'json' };
import { renderCore } from '#tests/render-test-utils.ts';

const [urlOnly, attributes, nullAttributes, autolink, unlinked, unsafe] = links.root.children;

describe('upstream link', () => {
	it('parses every captured link under its own schema without dropping a key', () => {
		for (const { children } of links.root.children) {
			for (const node of children) {
				const schema = node.type === 'autolink' ? LexicalAutolinkNodeSchema : LexicalLinkNodeSchema;

				expect(schema.parse(node)).toEqual(node);
			}
		}
	});

	it('renders the captured links without an issue', async () => {
		const { issues } = await renderCore(links.root.children);

		expect(issues).toEqual([]);
	});

	it('renders a link with only a url as a bare anchor', async () => {
		const { html } = await renderCore([urlOnly]);

		expect(html).toMatch(/<a href="https:\/\/example\.com\/url-only">Url only<\/a>/);
	});

	it('renders rel, target and title from the node itself', async () => {
		const { html } = await renderCore([attributes]);

		expect(html).toMatch(
			/<a href="https:\/\/example\.com\/attributes" rel="noopener noreferrer" target="_blank" title="Example title">All attributes<\/a>/,
		);
	});

	it('leaves out attributes Lexical serialized as null', async () => {
		const { html } = await renderCore([nullAttributes]);

		expect(html).toMatch(/<a href="\/about">Null attributes<\/a>/);
	});

	it('renders an autolink as an anchor to its url', async () => {
		const { html } = await renderCore([autolink]);

		expect(html).toMatch(
			/<a href="https:\/\/example\.com\/autolink">https:\/\/example\.com\/autolink<\/a>/,
		);
	});

	it('renders the text of an autolink the author undid without an anchor', async () => {
		const { html } = await renderCore([unlinked]);

		expect(html).not.toContain('<a');
		expect(html).toContain('https://example.com/unlinked');
	});

	it('renders a script-scheme url Lexical serialized as is as an inert anchor', async () => {
		const { html } = await renderCore([unsafe]);

		expect(html).not.toContain('javascript:');
		expect(html).toMatch(/<a href="#">Unsafe<\/a>/);
	});
});
