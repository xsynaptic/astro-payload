import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import type { RenderIssue } from '#issues.ts';
import type { PayloadRichTextConfig } from '#payload/types.ts';

import { payloadPreset } from '#payload/presets.ts';
import PayloadRichText from '#payload/rich-text.astro';
import { corePreset } from '#presets.ts';

import textState from './fixtures/text-state.json' with { type: 'json' };

const [fixtureParagraph] = textState.root.children;
const [, redText] = fixtureParagraph?.children ?? [];

const textStateClasses = {
	color: { 'bg-blue': 'highlight-blue', 'text-red': 'ink-red' },
	underline: { dashed: 'underline-dashed' },
};

async function renderTextState(
	children: Array<unknown>,
	config: Partial<PayloadRichTextConfig> = {},
) {
	const issues: Array<RenderIssue> = [];
	const container = await AstroContainer.create();
	const html = await container.renderToString(PayloadRichText, {
		props: {
			config: {
				context: undefined,
				internalDocToHref: () => '/internal',
				onIssue: (issue: RenderIssue) => {
					issues.push(issue);
				},
				siteHref: (href: string) => href,
				...config,
			},
			converters: { ...corePreset, ...payloadPreset },
			data: { root: { ...textState.root, children } },
		},
	});

	return { html, issues };
}

function paragraphWith(...children: Array<unknown>) {
	return [{ ...fixtureParagraph, children }];
}

describe('text state', () => {
	it('renders each mapped state as a class on the span around the formatted text', async () => {
		const { html, issues } = await renderTextState(textState.root.children, { textStateClasses });

		expect(issues).toEqual([]);
		expect(html).toContain('Synthetic text with <span class="ink-red">red text</span> and ');
		expect(html).toContain(
			'<span class="highlight-blue underline-dashed"><strong>a dashed blue highlight</strong></span>.',
		);
	});

	it('renders state with no mapping as plain text', async () => {
		const { html, issues } = await renderTextState(textState.root.children);

		expect(issues).toEqual([]);
		expect(html).toContain(
			'<p>Synthetic text with red text and <strong>a dashed blue highlight</strong>.</p>',
		);
	});

	it('maps only the values the option names', async () => {
		const { html } = await renderTextState(textState.root.children, {
			textStateClasses: { color: { 'text-red': 'ink-red' } },
		});

		expect(html).toContain('<strong>a dashed blue highlight</strong>.');
		expect(html).not.toContain('<span><strong>');
	});

	it('puts the class and the allowlisted style on one span', async () => {
		const { html } = await renderTextState(paragraphWith({ ...redText, style: 'color: #1a5fb4' }), {
			textStateClasses,
			textStyleProperties: ['color'],
		});

		expect(html).toContain('<span class="ink-red" style="color:#1a5fb4">red text</span>');
	});

	it('ignores a state key or value the option inherits rather than names', async () => {
		const { html, issues } = await renderTextState(
			paragraphWith({ ...redText, $: { color: 'toString', constructor: 'name' } }),
			{ textStateClasses },
		);

		expect(issues).toEqual([]);
		expect(html).toContain('<p>red text</p>');
	});

	it('accepts node state that is not a string without mapping it', async () => {
		const { html, issues } = await renderTextState(
			paragraphWith({ ...redText, $: { color: { nested: 'text-red' } } }),
			{ textStateClasses },
		);

		expect(issues).toEqual([]);
		expect(html).toContain('<p>red text</p>');
	});
});
