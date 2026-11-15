import type { ConvertersProp, ParsedEditorState } from '#definitions.ts';
import type { RichTextConfig } from '#types.ts';

import type { PayloadRichTextDefinitions } from './definitions.ts';
import type { InternalLinkTarget } from './links.ts';

export interface PayloadRichTextConfig<TContext = unknown> extends RichTextConfig<TContext> {
	internalDocToHref: (target: InternalLinkTarget, context: TContext) => Promise<string> | string;
	textStateClasses?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

// The core RichText accepts any config, so only the Payload RichText makes a missing resolver a type error
export type PayloadRichTextProps<
	T extends PayloadRichTextDefinitions = PayloadRichTextDefinitions,
	TContext = unknown,
> = ConvertersProp<T> & {
	config: PayloadRichTextConfig<TContext>;
	data: ParsedEditorState<T>;
};
