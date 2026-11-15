import { beforeEach, describe, expect, it } from 'vitest';

import { element, renderCore } from '#tests/render-test-utils.ts';
import LinkWrapperForwarding from '#tests/test-converters/link-wrapper-forwarding.astro';
import LinkWrapper from '#tests/test-converters/link-wrapper.astro';
import RecordingText from '#tests/test-converters/recording-text.astro';
import { renderedTexts } from '#tests/test-converters/rendered-texts.ts';
import SlotContainer from '#tests/test-converters/slot-container.astro';
import SlotlessContainer from '#tests/test-converters/slotless-container.astro';

function text(value: string) {
	return { text: value, type: 'text', version: 1 };
}

function paragraph(...children: Array<unknown>) {
	return { ...element, children, type: 'paragraph' };
}

function quote(...children: Array<unknown>) {
	return { ...element, children, type: 'quote' };
}

function link(...children: Array<unknown>) {
	return { ...element, children, type: 'link', url: 'https://example.com/' };
}

beforeEach(() => {
	renderedTexts.length = 0;
});

describe('children in the default slot', () => {
	it('renders a container converter’s slot through the converter map', async () => {
		const { html } = await renderCore(
			[quote(paragraph(text('Inside')))],
			{},
			{
				nodes: { quote: SlotContainer, text: RecordingText },
			},
		);

		expect(html).toBe('<section><p><em>Inside</em></p></section>');
		expect(renderedTexts).toEqual(['Inside']);
	});

	it('runs no child converter when a converter leaves its slot out', async () => {
		const { html } = await renderCore(
			[quote(paragraph(text('Hidden')))],
			{},
			{
				nodes: { quote: SlotlessContainer, text: RecordingText },
			},
		);

		expect(html).toBe('<section data-slotless=""></section>');
		expect(renderedTexts).toEqual([]);
	});

	it('renders no children through a wrapper that forwards props but no slot', async () => {
		const { html } = await renderCore(
			[paragraph(link(text('Read')))],
			{},
			{
				nodes: { link: LinkWrapper, text: RecordingText },
			},
		);

		expect(html).toBe('<p><a href="https://example.com/"></a></p>');
		expect(renderedTexts).toEqual([]);
	});

	it('renders the children once when a wrapper forwards its slot', async () => {
		const { html } = await renderCore(
			[paragraph(link(text('Read')))],
			{},
			{
				nodes: { link: LinkWrapperForwarding, text: RecordingText },
			},
		);

		expect(html).toBe('<p><a href="https://example.com/"><em>Read</em></a></p>');
		expect(renderedTexts).toEqual(['Read']);
	});
});
