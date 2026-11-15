import { z } from 'zod';

import { defineNode } from '#registry.ts';
import { elementFields, LexicalTextNodeSchema } from '#schemas/lexical.ts';

const documentIdSchema = z.union([z.number(), z.string()]);

// A bare id unless the editor's `maxDepth` lets Payload populate the target
const linkDocSchema = z.object({
	relationTo: z.string(),
	value: z.union([documentIdSchema, z.looseObject({ id: documentIdSchema })]),
});

export const PayloadTextNodeSchema = LexicalTextNodeSchema.extend({
	$: z.record(z.string(), z.unknown()).optional(),
});

// Payload replaces the upstream link attributes with a `fields` object of its own
export const PayloadLinkNodeSchema = z.object({
	type: z.literal('link'),
	...elementFields,
	fields: z.object({
		doc: linkDocSchema.nullable().optional(),
		linkType: z.enum(['custom', 'internal']).optional(),
		newTab: z.boolean().optional(),
		url: z.string().optional(),
	}),
});

export const PayloadAutolinkNodeSchema = z.object({
	type: z.literal('autolink'),
	...elementFields,
	fields: z.object({
		linkType: z.enum(['custom', 'internal']).optional(),
		newTab: z.boolean().optional(),
		url: z.string().optional(),
	}),
});

// Loose, so a converter or resolver receives the whole document
export function payloadDocumentSchema<TShape extends z.ZodRawShape>(shape: TShape) {
	return z
		.looseObject(
			{ id: documentIdSchema },
			{ error: 'Expected a populated document; read the content with depth >= 1' },
		)
		.extend(shape);
}

export const uploadSizeSchema = z.object({
	height: z.number().nullable(),
	mimeType: z.string().nullable(),
	url: z.string().nullable().optional(),
	width: z.number().nullable(),
});

const uploadDocSchema = payloadDocumentSchema({
	// Not a Payload field, but the one Payload's own converters read alt text from
	alt: z.string().nullable().optional(),
	filename: z.string().nullable().optional(),
	height: z.number().nullable().optional(),
	mimeType: z.string(),
	sizes: z.record(z.string(), uploadSizeSchema).nullable().optional(),
	url: z.string(),
	width: z.number().nullable().optional(),
});

// The renderer reads alignment off the parsed node, so the schema must keep `format`
const decoratorFormat = elementFields.format.optional();

export const PayloadUploadNodeSchema = z.object({
	// Unread by the preset converter; a site's own reads its caption from here
	fields: z.record(z.string(), z.unknown()).optional(),
	format: decoratorFormat,
	id: z.string().optional(),
	relationTo: z.string(),
	type: z.literal('upload'),
	value: uploadDocSchema.nullable(),
	version: z.number().optional(),
});

export const PayloadRelationshipNodeSchema = z.object({
	format: decoratorFormat,
	relationTo: z.string(),
	type: z.literal('relationship'),
	value: payloadDocumentSchema({}).nullable(),
	version: z.number().optional(),
});

// An inline block is a plain decorator node, which serializes no alignment
const blockNodeFields = { block: { format: decoratorFormat }, inlineBlock: {} };

export type BlockNodeType = keyof typeof blockNodeFields;

export function toBlockNodeSchema<TType extends BlockNodeType, TFields extends z.ZodType>(
	type: TType,
	fields: TFields,
) {
	return z.object({
		...blockNodeFields[type],
		fields,
		type: z.literal(type),
		version: z.number().optional(),
	});
}

export const payloadNodes = [
	defineNode(PayloadTextNodeSchema),
	defineNode(PayloadLinkNodeSchema),
	defineNode(PayloadAutolinkNodeSchema),
	defineNode(PayloadUploadNodeSchema),
	defineNode(PayloadRelationshipNodeSchema),
] as const;

export type PayloadNodeType = (typeof payloadNodes)[number]['type'];

export type PayloadAutolinkNode = z.infer<typeof PayloadAutolinkNodeSchema>;
export type PayloadLinkNode = z.infer<typeof PayloadLinkNodeSchema>;
export type PayloadRelationshipNode = z.infer<typeof PayloadRelationshipNodeSchema>;
export type PayloadTextNode = z.infer<typeof PayloadTextNodeSchema>;
export type PayloadUploadNode = z.infer<typeof PayloadUploadNodeSchema>;
