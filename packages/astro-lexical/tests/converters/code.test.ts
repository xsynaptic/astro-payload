import { fc, test as propertyTest } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import { getCodeText } from '#converters/code.ts';
import { corePreset } from '#presets.ts';
import { buildConverters } from '#registry.ts';
import { coreNodes } from '#schemas/lexical.ts';
import code from '#tests/fixtures/code.json' with { type: 'json' };
import { element, renderCore } from '#tests/render-test-utils.ts';
import ShikiCodeConverter from '#tests/test-converters/shiki-code.astro';

const [withLanguage, withoutLanguage] = code.root.children;

const namedEntities: Record<string, string> = { amp: '&', gt: '>', lt: '<', quot: '"' };

function decodeEntity(entity: string) {
	if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
	if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));

	return namedEntities[entity] ?? '';
}

function textContent(html: string) {
	return html
		.replaceAll(/<[^>]+>/g, '')
		.replaceAll(/&(#x[\da-f]+|#\d+|amp|gt|lt|quot);/gi, (_match, entity: string) =>
			decodeEntity(entity.toLowerCase()),
		);
}

function codeBlock(language: unknown, children: Array<unknown> = [highlight('x')]) {
	return { ...element, children, language, type: 'code' };
}

function highlight(text: string) {
	return { text, type: 'code-highlight', version: 1 };
}

const codeChild = fc.oneof(
	fc.string().map((text) => highlight(text)),
	fc.string().map((text) => ({ format: 0, text, type: 'text', version: 1 })),
	fc.constant({ type: 'linebreak', version: 1 }),
	fc.constant({
		detail: 2,
		format: 0,
		mode: 'normal',
		style: '',
		text: '\t',
		type: 'tab',
		version: 1,
	}),
	fc.constant({ type: 'tab', version: 1 }),
);

describe('code', () => {
	it('renders the captured blocks without an issue', async () => {
		const { issues } = await renderCore(code.root.children);

		expect(issues).toEqual([]);
	});

	it('marks the language on the block and renders highlight tokens as plain text', async () => {
		const { html } = await renderCore([withLanguage]);

		expect(html).toBe(
			'<pre data-language="javascript"><code class="language-javascript">function greet() {\n\treturn &#39;&lt;hello&gt;&#39;;\n}</code></pre>',
		);
	});

	it('renders a block without a language as bare code', async () => {
		const { html } = await renderCore([withoutLanguage]);

		expect(html).toBe('<pre><code>first line\n\tindented line</code></pre>');
	});

	// eslint-disable-next-line unicorn/no-null -- Lexical serializes an unset language as `null`
	it.each([null, ''])('renders a block whose language is %j as bare code', async (language) => {
		const { html, issues } = await renderCore([codeBlock(language)]);

		expect(issues).toEqual([]);
		expect(html).toBe('<pre><code>x</code></pre>');
	});

	it('leaves the class off a language that would split into several', async () => {
		const { html } = await renderCore([codeBlock('js hidden')]);

		expect(html).toBe('<pre data-language="js hidden"><code>x</code></pre>');
	});

	it('keeps the format of a plain text child, since only highlight tokens drop theirs', async () => {
		const { html } = await renderCore([
			codeBlock(undefined, [{ format: 1, text: 'bold', type: 'text', version: 1 }]),
		]);

		expect(html).toBe('<pre><code><strong>bold</strong></code></pre>');
	});

	it('reads the text of a block with its tabs and line breaks', () => {
		if (!withLanguage) throw new Error('fixture has no code block');

		expect(getCodeText(withLanguage)).toBe("function greet() {\n\treturn '<hello>';\n}");
	});

	it('reads no text from a child the code converters would not render', () => {
		const children = [highlight('kept'), { text: 'dropped', type: 'paragraph', version: 1 }];

		expect(getCodeText({ children })).toBe('kept');
	});

	propertyTest.prop([fc.array(codeChild)])(
		'renders exactly the text getCodeText reads',
		async (children) => {
			const { html, issues } = await renderCore([codeBlock('javascript', children)]);

			expect(issues).toEqual([]);
			expect(textContent(html)).toBe(getCodeText({ children }));
		},
	);

	it('hands a site converter the block text in place of the default', async () => {
		const blocks = [withLanguage, withoutLanguage];
		const converters = {
			...corePreset,
			...buildConverters({ nodeConverters: { code: ShikiCodeConverter }, nodes: coreNodes }),
		};
		const { html: defaultHtml } = await renderCore(blocks);
		const { html, issues } = await renderCore(blocks, {}, converters);

		expect(issues).toEqual([]);
		expect(html).not.toBe(defaultHtml);
		expect(textContent(html)).toBe(
			blocks.map((block) => (block ? getCodeText(block) : '')).join(''),
		);
	});
});
