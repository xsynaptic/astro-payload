import type { z } from 'zod';

export interface LexicalNodeDefinition<
	TType extends string = string,
	TSchema extends NodeSchema = NodeSchema,
> {
	schema: TSchema;
	type: TType;
}

export type LiteralOf<TSchema> =
	TSchema extends z.ZodLiteral<infer TValue extends string> ? TValue : never;

type NodeSchema = z.ZodObject<Record<string, z.ZodType> & { type: z.ZodLiteral<string> }>;

// A tag declared beside the schema compiles even when the two disagree
export function defineNode<TSchema extends NodeSchema>(
	schema: TSchema,
): LexicalNodeDefinition<LiteralOf<TSchema['shape']['type']>, TSchema> {
	// The shape is intersected with an index signature, which widens the lookup back to `string`
	const type = schema.shape.type.value as LiteralOf<TSchema['shape']['type']>;

	return { schema, type };
}
