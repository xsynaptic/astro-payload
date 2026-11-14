import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { buildConverters, defineNode } from '#registry.ts';

function stubConverter(name: string): AstroComponentFactory {
	return (() => name) as unknown as AstroComponentFactory;
}

const uploadConverter = stubConverter('upload');

const UploadNodeSchema = z.object({
	type: z.literal('upload'),
	value: z.object({ id: z.number() }),
});

const nodes = [defineNode(UploadNodeSchema)] as const;

describe('buildConverters', () => {
	it('keys each entry by node type and carries its schema', () => {
		const converters = buildConverters({ nodeConverters: { upload: uploadConverter }, nodes });

		expect(converters.upload).toEqual({ converter: uploadConverter, schema: UploadNodeSchema });
		expectTypeOf(converters.upload.schema).toEqualTypeOf<typeof UploadNodeSchema>();
	});

	it('skips a definition with no converter registered', () => {
		const converters = buildConverters({ nodeConverters: {}, nodes });

		expect(converters).toEqual({});
	});

	it('rejects a converter keyed to a node it has no definition for', () => {
		const nodeConverters = { uplaod: uploadConverter, upload: uploadConverter };

		// @ts-expect-error: `uplaod` names no definition
		buildConverters({ nodeConverters, nodes });
	});
});

describe('defineNode', () => {
	it('reads the node type off the schema', () => {
		expect(defineNode(UploadNodeSchema).type).toBe('upload');
	});
});
