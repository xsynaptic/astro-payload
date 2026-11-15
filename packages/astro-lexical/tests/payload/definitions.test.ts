import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { ConverterMap, CoreRichTextDefinitions } from '#definitions.ts';
import type { PayloadRichTextDefinitions } from '#payload/definitions.ts';
import type { PayloadRichTextProps } from '#payload/types.ts';
import type { RichTextProps } from '#types.ts';

import { defineNode } from '#definitions.ts';
import { parseRichText } from '#parse.ts';
import { defineBlock } from '#payload/blocks.ts';
import { definePayloadRichText } from '#payload/definitions.ts';
import PayloadRichText from '#payload/rich-text.astro';
import { PayloadUploadNodeSchema } from '#payload/schemas.ts';
import { coreRichText, editorState, element, stubConverter } from '#tests/render-test-utils.ts';

import inlineBlock from './fixtures/inline-block.json' with { type: 'json' };
import BadgeConverter from './test-converters/badge.astro';

const calloutConverter = stubConverter('callout');

const CalloutFieldsSchema = z.object({
	blockType: z.literal('callout'),
	content: z.string(),
});

const BadgeFieldsSchema = z.object({
	blockType: z.literal('badge'),
	label: z.string(),
	tone: z.enum(['info', 'warning']).optional(),
});

const richText = definePayloadRichText({
	blocks: [defineBlock(CalloutFieldsSchema)],
	inlineBlocks: [defineBlock(BadgeFieldsSchema)],
});

const CaptionedUploadNodeSchema = PayloadUploadNodeSchema.extend({
	fields: z.object({ caption: z.string() }),
});

const captionedRichText = definePayloadRichText({
	nodes: [defineNode(CaptionedUploadNodeSchema)],
});

const payloadConfig = {
	context: undefined,
	internalDocToHref: () => '/internal',
	siteHref: (href: string) => href,
};

function callout(fields: Record<string, unknown>) {
	return { fields: { blockType: 'callout', ...fields }, format: '', type: 'block', version: 2 };
}

function parsePayload(children: Array<unknown>) {
	return parseRichText(richText, editorState(children));
}

function payloadProps<T extends PayloadRichTextDefinitions>(props: PayloadRichTextProps<T>) {
	return props;
}

function richTextProps<T extends CoreRichTextDefinitions>(props: RichTextProps<T>) {
	return props;
}

describe('definePayloadRichText', () => {
	it('dispatches a block on its blockType and keeps its alignment', () => {
		const block = { ...callout({ content: 'Hi' }), format: 'center' };

		expect(parsePayload([block])).toEqual({ data: editorState([block]), issues: [] });
	});

	it('drops a block whose fields fail its schema and reports the field', () => {
		const { data, issues } = parsePayload([callout({}), callout({ content: 'Kept' })]);

		expect(data?.root.children).toEqual([callout({ content: 'Kept' })]);
		expect(issues).toMatchObject([
			{
				issues: [{ path: ['fields', 'content'] }],
				kind: 'invalid',
				nodeLabel: 'block:callout',
				path: ['root', 'children', 0],
			},
		]);
	});

	it('names the block type of an unregistered block', () => {
		const { issues } = parsePayload([{ fields: { blockType: 'video' }, type: 'block' }]);

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'block:video' }]);
	});

	it('falls back to the node type when the block names none', () => {
		const { issues } = parsePayload([{ fields: {}, type: 'block' }]);

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'block' }]);
	});

	it('never resolves a blockType through the prototype', () => {
		const { issues } = parsePayload([{ fields: { blockType: 'constructor' }, type: 'block' }]);

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'block:constructor' }]);
	});

	it('keeps blocks and inline blocks apart, so a slug registered as one is unknown as the other', () => {
		const { issues } = parsePayload([
			{ fields: { blockType: 'badge', label: 'Wrong list' }, type: 'block' },
		]);

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'block:badge' }]);
	});

	it('names the core walker an unknown block without knowing blocks', () => {
		const { issues } = parseRichText(coreRichText, editorState([callout({ content: 'Hi' })]));

		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'block' }]);
	});

	it('replaces a Payload default with a passed node', () => {
		const AppUploadNodeSchema = z.object({
			type: z.literal('upload'),
			value: z.union([z.number(), z.string()]),
		});
		const appRichText = definePayloadRichText({ nodes: [defineNode(AppUploadNodeSchema)] });
		const bareUpload = { relationTo: 'media', type: 'upload', value: 274, version: 3 };

		expect(parseRichText(appRichText, editorState([bareUpload]))).toEqual({
			data: editorState([{ type: 'upload', value: 274 }]),
			issues: [],
		});
	});

	it('accepts a passed node built on the preset schema', () => {
		const upload = {
			fields: { caption: 'A synthetic caption' },
			relationTo: 'media',
			type: 'upload',
			// eslint-disable-next-line unicorn/no-null -- Payload writes `null` for a deleted or unpublished target
			value: null,
			version: 3,
		};

		expect(parseRichText(captionedRichText, editorState([upload])).issues).toEqual([]);
	});
});

describe('inline block render', () => {
	const converters = {
		blocks: { callout: calloutConverter },
		inlineBlocks: { badge: BadgeConverter },
	} satisfies ConverterMap<typeof richText>;

	async function render(value: unknown) {
		const { data, issues } = parseRichText(richText, value);
		const container = await AstroContainer.create();
		const html = await container.renderToString(PayloadRichText, {
			props: { config: payloadConfig, converters, data },
		});

		return { html, issues };
	}

	it('renders an inline block inside its paragraph through the converter its blockType names', async () => {
		const { html, issues } = await render(inlineBlock);

		expect(issues).toEqual([]);
		expect(html).toContain(
			'<p>A synthetic sentence with a <mark data-tone="info">Synthetic badge</mark> inside it.</p>',
		);
	});

	it('throws on a block the converter map does not cover, since only a cast gets it there', async () => {
		const { data } = parseRichText(richText, inlineBlock);
		const container = await AstroContainer.create();

		await expect(
			container.renderToString(PayloadRichText, {
				props: { config: payloadConfig, converters: { blocks: converters.blocks }, data },
			}),
		).rejects.toThrow(/no converter for node "inlineBlock:badge"/);
	});
});

describe('Payload ConverterMap', () => {
	it('requires a converter for every block and inline block', () => {
		// @ts-expect-error: the inline block `badge` has no converter
		const missing = { blocks: { callout: calloutConverter } } satisfies ConverterMap<
			typeof richText
		>;

		expect(missing).toBeDefined();
	});

	it('rejects a block converter keyed to a block it has no definition for', () => {
		const misspelled = {
			// @ts-expect-error: `calout` names no block
			blocks: { callout: calloutConverter, calout: calloutConverter },
			inlineBlocks: { badge: BadgeConverter },
		} satisfies ConverterMap<typeof richText>;

		expect(misspelled).toBeDefined();
	});

	it('requires a converter for a node that replaces a Payload default', () => {
		// @ts-expect-error: the replaced `upload` needs a converter of its own
		const missing = {} satisfies ConverterMap<typeof captionedRichText>;

		expect(missing).toEqual({});
	});
});

describe('PayloadRichTextProps', () => {
	const paragraph = { ...element, children: [{ text: 'Hi', type: 'text' }], type: 'paragraph' };

	function parsedWith<T extends Parameters<typeof parseRichText>[0]>(definitions: T) {
		const { data } = parseRichText(definitions, editorState([paragraph]));
		if (!data) throw new Error('fixture parsed to no data');

		return data;
	}

	it('takes Payload data with a map covering its blocks', () => {
		const data = parsedWith(richText);
		const converters = {
			blocks: { callout: calloutConverter },
			inlineBlocks: { badge: BadgeConverter },
		};

		expect(payloadProps({ config: payloadConfig, converters, data }).data).toBe(data);
		// @ts-expect-error: the blocks need converters
		payloadProps({ config: payloadConfig, data });
	});

	it('rejects core data, whose link and text nodes the Payload converters misread', () => {
		const data = parsedWith(coreRichText);

		// @ts-expect-error: core data cannot render through the Payload converters
		expect(payloadProps({ config: payloadConfig, data }).data).toBe(data);
	});

	it('keeps Payload data out of the core RichText', () => {
		const data = parsedWith(definePayloadRichText());

		// @ts-expect-error: Payload data cannot render through the core converters
		expect(richTextProps({ data }).data).toBe(data);
	});
});
