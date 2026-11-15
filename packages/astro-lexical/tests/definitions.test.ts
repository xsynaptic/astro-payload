import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { ConverterMap, CoreRichTextDefinitions } from '#definitions.ts';
import type { RichTextProps } from '#types.ts';

import { defineNode, defineRichText } from '#definitions.ts';
import { parseRichText } from '#parse.ts';
import { LexicalHeadingNodeSchema } from '#schemas/lexical.ts';
import { editorState, element, stubConverter } from '#tests/render-test-utils.ts';

const uploadConverter = stubConverter('upload');

const UploadNodeSchema = z.object({
	type: z.literal('upload'),
	value: z.object({ id: z.number() }),
});

const ShoutingHeadingNodeSchema = LexicalHeadingNodeSchema.extend({ tag: z.literal('h1') });

const core = defineRichText();
const withUpload = defineRichText({ nodes: [defineNode(UploadNodeSchema)] });
const shouting = defineRichText({ nodes: [defineNode(ShoutingHeadingNodeSchema)] });

function parsed<T extends CoreRichTextDefinitions>(definitions: T, children: Array<unknown>) {
	const { data } = parseRichText(definitions, editorState(children));
	if (!data) throw new Error('fixture parsed to no data');

	return data;
}

const upload = { type: 'upload', value: { id: 1 } };
const title = { ...element, children: [], tag: 'h2', type: 'heading' };

// A component call infers its props as a generic function does; `.astro` files are checked only by `astro check`
function richTextProps<T extends CoreRichTextDefinitions>(props: RichTextProps<T>) {
	return props;
}

describe('defineRichText', () => {
	it('accepts every core node', () => {
		expect(parsed(core, [title]).root.children).toEqual([title]);
	});

	it('adds a consumer node to the core ones', () => {
		expect(parsed(withUpload, [title, upload]).root.children).toEqual([title, upload]);
	});

	it('replaces the default of the same type with a passed node', () => {
		const { issues } = parseRichText(shouting, editorState([title]));

		expect(issues).toMatchObject([{ issues: [{ path: ['tag'] }], nodeLabel: 'heading' }]);
	});
});

describe('defineNode', () => {
	it('reads the node type off the schema', () => {
		expect(defineNode(UploadNodeSchema).type).toBe('upload');
	});
});

describe('ConverterMap', () => {
	it('needs no converter for a default node and takes one as an override', () => {
		const empty = {} satisfies ConverterMap<typeof core>;
		const override = {
			nodes: { heading: stubConverter('heading') },
		} satisfies ConverterMap<typeof core>;

		expect([empty, override]).toHaveLength(2);
	});

	it('requires a converter for every consumer node', () => {
		const complete = { nodes: { upload: uploadConverter } } satisfies ConverterMap<
			typeof withUpload
		>;
		// @ts-expect-error: `upload` has no converter
		const missing = {} satisfies ConverterMap<typeof withUpload>;

		expect([complete, missing]).toHaveLength(2);
	});

	it('requires a converter for a node that replaces a default', () => {
		// @ts-expect-error: the replaced `heading` needs a converter of its own
		const missing = { nodes: {} } satisfies ConverterMap<typeof shouting>;

		expect(missing).toEqual({ nodes: {} });
	});

	it('rejects a misspelled or extra key', () => {
		const misspelled = {
			// @ts-expect-error: `uplaod` names no definition
			nodes: { uplaod: uploadConverter, upload: uploadConverter },
		} satisfies ConverterMap<typeof withUpload>;
		const extra = {
			// @ts-expect-error: core definitions take no blocks
			blocks: {},
			nodes: { upload: uploadConverter },
		} satisfies ConverterMap<typeof withUpload>;

		expect([misspelled, extra]).toHaveLength(2);
	});
});

describe('RichTextProps', () => {
	it('infers the definitions from the data and checks the converters against them', () => {
		const data = parsed(withUpload, [upload]);
		const converters = { nodes: { upload: uploadConverter } };

		expect(richTextProps({ converters, data }).data).toBe(data);
		// @ts-expect-error: the data needs an `upload` converter
		richTextProps({ data });
		// @ts-expect-error: the data needs an `upload` converter
		richTextProps({ converters: { nodes: {} }, data });
	});

	it('passes a map that covers more than the data needs', () => {
		const data = parsed(core, [title]);
		const converters = { nodes: { heading: stubConverter('heading'), upload: uploadConverter } };

		expect(richTextProps({ converters, data }).converters).toBe(converters);
	});

	it('rejects unparsed data', () => {
		const raw = editorState([title]);

		// @ts-expect-error: a raw editor state has not been through `parseRichText`
		expect(richTextProps({ data: raw }).data).toBe(raw);
	});
});
