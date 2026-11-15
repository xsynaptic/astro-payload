import type { z } from 'zod';

import type { LiteralOf } from '#registry.ts';
import type { LexicalBaseNode } from '#types.ts';

export interface LexicalBlockDefinition<TBlockType extends string = string> {
	blockType: TBlockType;
	schema: BlockFieldsSchema;
}

export interface LexicalBlockNode<TFields = unknown> {
	fields: TFields;
	type: 'block';
	version?: number | undefined;
}

export interface LexicalInlineBlockNode<TFields = unknown> {
	fields: TFields;
	type: 'inlineBlock';
	version?: number | undefined;
}

type BlockFieldsSchema = z.ZodObject<
	Record<string, z.ZodType> & { blockType: z.ZodLiteral<string> }
>;

// A tag declared beside the schema compiles even when the two disagree
export function defineBlock<TSchema extends BlockFieldsSchema>(
	schema: TSchema,
): LexicalBlockDefinition<LiteralOf<TSchema['shape']['blockType']>> {
	// The shape is intersected with an index signature, which widens the lookup back to `string`
	const blockType = schema.shape.blockType.value as LiteralOf<TSchema['shape']['blockType']>;

	return { blockType, schema };
}

export function readBlockType({ fields }: LexicalBaseNode): string | undefined {
	if (typeof fields !== 'object' || fields === null || !('blockType' in fields)) return undefined;

	return typeof fields.blockType === 'string' ? fields.blockType : undefined;
}
