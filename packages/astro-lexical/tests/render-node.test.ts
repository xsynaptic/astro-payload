import { describe, expect, it } from 'vitest';

import type { Converters } from '#types.ts';

import { computeNodeStyles, getConverter } from '#render-node.ts';
import { stubConverter } from '#tests/render-test-utils.ts';

const paragraphConverter = stubConverter('paragraph');
const galleryConverter = stubConverter('gallery');

describe('getConverter', () => {
	const converters: Converters = {
		dispatch: {
			gallery: {
				key: (target) => (typeof target.layout === 'string' ? target.layout : undefined),
				variants: { wide: galleryConverter },
			},
		},
		nodes: { paragraph: paragraphConverter },
	};

	it('looks a plain node up by type', () => {
		expect(getConverter({ type: 'paragraph' }, converters)).toBe(paragraphConverter);
	});

	it('hands a dispatching entry the node to choose from', () => {
		expect(getConverter({ layout: 'wide', type: 'gallery' }, converters)).toBe(galleryConverter);
	});

	it('throws on a node the map does not cover, naming its variant', () => {
		expect(() => getConverter({ layout: 'narrow', type: 'gallery' }, converters)).toThrow(
			/no converter for node "gallery:narrow"/,
		);
		expect(() => getConverter({ type: 'mystery' }, converters)).toThrow(/"mystery"/);
	});

	it('never resolves a node type through the prototype', () => {
		expect(() => getConverter({ type: 'constructor' }, converters)).toThrow(/"constructor"/);
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
