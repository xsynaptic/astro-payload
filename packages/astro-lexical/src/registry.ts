import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import type { z } from 'zod';

import type { ConverterEntry } from './types.ts';

export interface LexicalNodeDefinition<
	TType extends string = string,
	TSchema extends NodeSchema = NodeSchema,
> {
	schema: TSchema;
	type: TType;
}

// A map passed as a variable gets no excess-property check, so a misspelled key needs this one
export type ExactKeys<TMap, TKey extends PropertyKey> = Record<Exclude<keyof TMap, TKey>, never> &
	TMap;

export type LiteralOf<TSchema> =
	TSchema extends z.ZodLiteral<infer TValue extends string> ? TValue : never;

type NodeSchema = z.ZodObject<Record<string, z.ZodType> & { type: z.ZodLiteral<string> }>;

export function buildConverters<
	const TNodes extends ReadonlyArray<LexicalNodeDefinition>,
	TNodeConverters extends Partial<Record<string, AstroComponentFactory>>,
>(registry: { nodeConverters: ExactKeys<TNodeConverters, TNodes[number]['type']>; nodes: TNodes }) {
	type NodeEntries<TNodes extends ReadonlyArray<LexicalNodeDefinition>, TNodeConverters> = {
		[
			TNode in TNodes[number] as TNode['type'] extends keyof TNodeConverters ? TNode['type'] : never
		]: { converter: AstroComponentFactory; schema: TNode['schema'] };
	};
	const nodeConverters: Partial<Record<string, AstroComponentFactory>> = registry.nodeConverters;
	const converters: Record<string, ConverterEntry> = {};

	for (const node of registry.nodes) {
		const converter = nodeConverters[node.type];
		if (!converter) continue;
		converters[node.type] = { converter, schema: node.schema };
	}

	// The loop fills exactly the keys the mapped type names; TypeScript cannot follow it
	return converters as NodeEntries<TNodes, TNodeConverters>;
}

// A tag declared beside the schema compiles even when the two disagree
export function defineNode<TSchema extends NodeSchema>(
	schema: TSchema,
): LexicalNodeDefinition<LiteralOf<TSchema['shape']['type']>, TSchema> {
	// The shape is intersected with an index signature, which widens the lookup back to `string`
	const type = schema.shape.type.value as LiteralOf<TSchema['shape']['type']>;

	return { schema, type };
}
