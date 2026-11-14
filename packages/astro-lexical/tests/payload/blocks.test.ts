import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { RenderIssue } from '#issues.ts';

import { buildBlockConverters, buildInlineBlockConverters, defineBlock } from '#payload/blocks.ts';
import { corePreset } from '#presets.ts';
import { getConverterForNode, resolveNode } from '#render-node.ts';
import RichText from '#rich-text.astro';

import inlineBlock from './fixtures/inline-block.json' with { type: 'json' };
import BadgeConverter from './test-converters/badge.astro';

function stubConverter(name: string): AstroComponentFactory {
	return (() => name) as unknown as AstroComponentFactory;
}

const calloutConverter = stubConverter('callout');

const CalloutFieldsSchema = z.object({
	blockType: z.literal('callout'),
	content: z.string(),
});

const blocks = [defineBlock(CalloutFieldsSchema)] as const;
const converters = buildBlockConverters({ blockConverters: { callout: calloutConverter }, blocks });

describe('buildBlockConverters', () => {
	it('dispatches a block node on its blockType', () => {
		const entry = getConverterForNode(
			{ fields: { blockType: 'callout' }, type: 'block' },
			converters,
		);

		expect(entry?.converter).toBe(calloutConverter);
	});

	it('wraps a block schema so it validates the whole node', () => {
		const schema = getConverterForNode(
			{ fields: { blockType: 'callout' }, type: 'block' },
			converters,
		)?.schema;

		expect(
			schema?.safeParse({ fields: { blockType: 'callout', content: 'hi' }, type: 'block' }).success,
		).toBe(true);
		expect(schema?.safeParse({ fields: { blockType: 'callout' }, type: 'block' }).success).toBe(
			false,
		);
	});

	it('returns undefined for an unregistered block type', () => {
		const blockNode = { fields: { blockType: 'unknown' }, type: 'block' };

		expect(getConverterForNode(blockNode, converters)).toBeUndefined();
	});

	it('returns undefined for a block node with no blockType', () => {
		expect(getConverterForNode({ type: 'block' }, converters)).toBeUndefined();
	});

	it('never resolves a blockType through the prototype', () => {
		const blockNode = { fields: { blockType: 'constructor' }, type: 'block' };

		expect(getConverterForNode(blockNode, converters)).toBeUndefined();
	});

	it('rejects a converter keyed to a block it has no definition for', () => {
		const blockConverters = { calout: calloutConverter };

		// @ts-expect-error: `calout` names no block
		buildBlockConverters({ blockConverters, blocks });
	});

	it('skips a block with no converter registered', () => {
		const empty = buildBlockConverters({ blockConverters: {}, blocks });
		const blockNode = { fields: { blockType: 'callout' }, type: 'block' };

		expect(getConverterForNode(blockNode, empty)).toBeUndefined();
	});
});

describe('defineBlock', () => {
	it('reads the discriminator off the schema', () => {
		expect(defineBlock(CalloutFieldsSchema).blockType).toBe('callout');
	});
});

function labelOf(target: { [key: string]: unknown; type: string }) {
	const labels: Array<string> = [];

	resolveNode(target, converters, {
		onIssue: ({ nodeLabel }) => {
			labels.push(nodeLabel);
		},
	});

	return labels;
}

describe('block dispatch label', () => {
	it('names the block type of an unregistered block', () => {
		expect(labelOf({ fields: { blockType: 'video' }, type: 'block' })).toEqual(['block:video']);
	});

	it('falls back to the node type when the block names none', () => {
		expect(labelOf({ type: 'block' })).toEqual(['block']);
	});
});

describe('inline block dispatch', () => {
	const BadgeFieldsSchema = z.object({
		blockType: z.literal('badge'),
		label: z.string(),
		tone: z.enum(['info', 'warning']).optional(),
	});
	const converters = {
		...corePreset,
		...buildInlineBlockConverters({
			inlineBlockConverters: { badge: BadgeConverter },
			inlineBlocks: [defineBlock(BadgeFieldsSchema)],
		}),
	};
	const [captured] = inlineBlock.root.children;
	const [before, badge, after] = captured?.children ?? [];

	it('keeps a slug registered as both a block and an inline block on separate converters', () => {
		const blockBadgeConverter = stubConverter('block badge');
		const both = {
			...buildBlockConverters({
				blockConverters: { badge: blockBadgeConverter },
				blocks: [defineBlock(BadgeFieldsSchema)],
			}),
			...converters,
		};

		expect(
			getConverterForNode({ fields: { blockType: 'badge' }, type: 'block' }, both)?.converter,
		).toBe(blockBadgeConverter);
		expect(
			getConverterForNode({ fields: { blockType: 'badge' }, type: 'inlineBlock' }, both)?.converter,
		).toBe(BadgeConverter);
	});

	async function render(inlineNode: unknown) {
		const issues: Array<RenderIssue> = [];
		const container = await AstroContainer.create();
		const html = await container.renderToString(RichText, {
			props: {
				config: {
					context: undefined,
					onIssue: (issue: RenderIssue) => {
						issues.push(issue);
					},
					siteHref: (href: string) => href,
				},
				converters,
				data: {
					root: {
						...inlineBlock.root,
						children: [{ ...captured, children: [before, inlineNode, after] }],
					},
				},
			},
		});

		return { html, issues };
	}

	it('renders an inline block inside its paragraph through the converter its blockType names', async () => {
		const { html, issues } = await render(badge);

		expect(issues).toEqual([]);
		expect(html).toContain(
			'<p>A synthetic sentence with a <mark data-tone="info">Synthetic badge</mark> inside it.</p>',
		);
	});

	it('drops an inline block whose blockType has no converter and names it', async () => {
		const unknown = { ...badge, fields: { ...badge?.fields, blockType: 'footnote' } };
		const { html, issues } = await render(unknown);

		expect(html).toContain('<p>A synthetic sentence with a  inside it.</p>');
		expect(issues).toMatchObject([{ kind: 'unknown', nodeLabel: 'inlineBlock:footnote' }]);
	});

	it('drops an inline block whose fields fail its schema and reports the field', async () => {
		const invalid = { ...badge, fields: { ...badge?.fields, tone: 'loud' } };
		const { html, issues } = await render(invalid);

		expect(html).not.toContain('<mark');
		expect(issues).toMatchObject([
			{ issues: [{ path: ['fields', 'tone'] }], kind: 'invalid', nodeLabel: 'inlineBlock:badge' },
		]);
	});
});
