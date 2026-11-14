import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { RenderIssue } from '#issues.ts';
import type { Converters } from '#types.ts';

import { computeNodeStyles, getConverterForNode, resolveNode } from '#render-node.ts';

// Converters are only ever compared by identity here, so a named stub is enough
function stubConverter(name: string): AstroComponentFactory {
	return (() => name) as unknown as AstroComponentFactory;
}

const paragraphConverter = stubConverter('paragraph');
const galleryConverter = stubConverter('gallery');
const uploadConverter = stubConverter('upload');

describe('getConverterForNode', () => {
	const converters: Converters = {
		gallery: {
			describe: () => 'gallery',
			select: (target) =>
				'wide' in target && target.wide === true ? { converter: galleryConverter } : undefined,
		},
		paragraph: { converter: paragraphConverter },
	};

	it('looks a plain node up by type', () => {
		expect(getConverterForNode({ type: 'paragraph' }, converters)?.converter).toBe(
			paragraphConverter,
		);
	});

	it('hands a dispatching entry the node to choose from', () => {
		expect(getConverterForNode({ type: 'gallery', wide: true }, converters)?.converter).toBe(
			galleryConverter,
		);
		expect(getConverterForNode({ type: 'gallery' }, converters)).toBeUndefined();
	});

	it('returns undefined for an unknown node type', () => {
		expect(getConverterForNode({ type: 'mystery' }, converters)).toBeUndefined();
	});

	it('never resolves a node type through the prototype', () => {
		expect(getConverterForNode({ type: 'constructor' }, converters)).toBeUndefined();
	});
});

describe('computeNodeStyles', () => {
	it('places a centred or right-aligned table rather than aligning its text', () => {
		expect(computeNodeStyles({ format: 'center', type: 'table' })).toEqual({
			marginInline: 'auto',
		});
		expect(computeNodeStyles({ format: 'right', type: 'table' })).toEqual({ marginLeft: 'auto' });
		expect(computeNodeStyles({ format: 'justify', type: 'table' })).toBeUndefined();
	});

	it('passes a format keyword through as the text alignment', () => {
		expect(computeNodeStyles({ format: 'left', type: 'paragraph' })).toEqual({
			textAlign: 'left',
		});
	});

	it('keeps a logical alignment logical', () => {
		expect(computeNodeStyles({ format: 'start', type: 'paragraph' })).toEqual({
			textAlign: 'start',
		});
	});

	it('ignores a numeric text format bitmask', () => {
		expect(computeNodeStyles({ format: 1, type: 'text' })).toBeUndefined();
	});

	it('converts indent levels to padding', () => {
		expect(computeNodeStyles({ indent: 2, type: 'paragraph' })).toEqual({
			paddingInlineStart: '80px',
		});
	});

	it('skips indent padding on list items, which the list markup already indents', () => {
		expect(computeNodeStyles({ indent: 2, type: 'listitem' })).toBeUndefined();
	});

	it('returns undefined when nothing applies', () => {
		expect(computeNodeStyles({ format: '', indent: 0, type: 'paragraph' })).toBeUndefined();
	});

	it('returns undefined for an unrecognized format value', () => {
		expect(computeNodeStyles({ format: 'sideways', type: 'paragraph' })).toBeUndefined();
	});
});

describe('resolveNode', () => {
	const schema = z.object({ type: z.literal('upload'), value: z.number() });
	const converters: Converters = {
		paragraph: { converter: paragraphConverter },
		upload: { converter: uploadConverter, schema },
	};

	it('renders a node with no schema without validating it', () => {
		const target = { type: 'paragraph' };

		expect(resolveNode(target, converters, {})).toEqual({
			converter: paragraphConverter,
			node: target,
		});
	});

	it('hands the converter the parsed node rather than the raw one', () => {
		const target = { extra: 'stripped', type: 'upload', value: 1 };
		const resolved = resolveNode(target, converters, {});

		expect(resolved.converter).toBe(uploadConverter);
		expect(resolved.node).toEqual({ type: 'upload', value: 1 });
	});

	it('drops a node that fails its schema and reports the issues', () => {
		const target = { type: 'upload', value: 'not a number' };
		const reported: Array<RenderIssue> = [];

		const resolved = resolveNode(target, converters, {
			onIssue: (issue) => {
				reported.push(issue);
			},
		});

		expect(resolved.converter).toBeUndefined();
		expect(resolved.node).toBe(target);
		expect(reported).toMatchObject([{ issues: [{}], kind: 'invalid', node: target }]);
	});

	it('reports a node with no converter through the same hook', () => {
		const target = { type: 'mystery' };
		const reported: Array<RenderIssue> = [];

		const resolved = resolveNode(target, converters, {
			onIssue: (issue) => {
				reported.push(issue);
			},
		});

		expect(resolved.converter).toBeUndefined();
		expect(reported).toEqual([{ kind: 'unknown', node: target, nodeLabel: 'mystery' }]);
	});

	it('carries the document label into the report', () => {
		const reported: Array<RenderIssue> = [];

		resolveNode({ type: 'mystery' }, converters, {
			documentLabel: 'posts/en:12',
			onIssue: (issue) => {
				reported.push(issue);
			},
		});

		expect(reported).toMatchObject([{ documentLabel: 'posts/en:12', kind: 'unknown' }]);
	});

	it('warns once per node type when the app registers no hook', () => {
		// eslint-disable-next-line @typescript-eslint/no-empty-function -- the spy is an intentional no-op
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		resolveNode({ type: 'unregistered' }, converters, {});
		resolveNode({ type: 'unregistered' }, converters, {});

		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
	});
});
