import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { z } from 'zod';

import type { ExactKeys, LiteralOf } from '#registry.ts';
import type { ConverterEntry, DispatchEntry, LexicalBaseNode } from '#types.ts';

import type { BlockNodeType } from './schemas.ts';

import { toBlockNodeSchema } from './schemas.ts';

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

// The result is the one `block` entry, and a second call's spread replaces it; register every block in one call
export function buildBlockConverters<
	const TBlocks extends ReadonlyArray<LexicalBlockDefinition>,
	TBlockConverters extends Partial<Record<string, AstroComponentFactory>>,
>(registry: {
	blockConverters: ExactKeys<TBlockConverters, TBlocks[number]['blockType']>;
	blocks: TBlocks;
}): { block: DispatchEntry } {
	return { block: buildDispatchEntry('block', registry.blocks, registry.blockConverters) };
}

// Payload keeps inline blocks in a list of their own, so a slug may be both and render differently in each
// The result is the one `inlineBlock` entry, and a second call's spread replaces it; register every inline block in one call
export function buildInlineBlockConverters<
	const TInlineBlocks extends ReadonlyArray<LexicalBlockDefinition>,
	TInlineBlockConverters extends Partial<Record<string, AstroComponentFactory>>,
>(registry: {
	inlineBlockConverters: ExactKeys<TInlineBlockConverters, TInlineBlocks[number]['blockType']>;
	inlineBlocks: TInlineBlocks;
}): { inlineBlock: DispatchEntry } {
	return {
		inlineBlock: buildDispatchEntry(
			'inlineBlock',
			registry.inlineBlocks,
			registry.inlineBlockConverters,
		),
	};
}

// Every block shares its node type, so the converter is chosen by `fields.blockType`
function buildDispatchEntry(
	type: BlockNodeType,
	blocks: ReadonlyArray<LexicalBlockDefinition>,
	blockConverters: Partial<Record<string, AstroComponentFactory>>,
): DispatchEntry {
	const entries: Record<string, ConverterEntry> = {};

	for (const block of blocks) {
		const converter = blockConverters[block.blockType];
		if (!converter) continue;
		entries[block.blockType] = { converter, schema: toBlockNodeSchema(type, block.schema) };
	}

	return {
		describe: (node) => {
			const blockType = readBlockType(node);

			return blockType === undefined ? node.type : `${node.type}:${blockType}`;
		},
		select: (node) => {
			const blockType = readBlockType(node);

			return blockType !== undefined && Object.hasOwn(entries, blockType)
				? entries[blockType]
				: undefined;
		},
	};
}

// A tag declared beside the schema compiles even when the two disagree
export function defineBlock<TSchema extends BlockFieldsSchema>(
	schema: TSchema,
): LexicalBlockDefinition<LiteralOf<TSchema['shape']['blockType']>> {
	// The shape is intersected with an index signature, which widens the lookup back to `string`
	const blockType = schema.shape.blockType.value as LiteralOf<TSchema['shape']['blockType']>;

	return { blockType, schema };
}

function readBlockType({ fields }: LexicalBaseNode): string | undefined {
	if (typeof fields !== 'object' || fields === null || !('blockType' in fields)) return undefined;

	return typeof fields.blockType === 'string' ? fields.blockType : undefined;
}
