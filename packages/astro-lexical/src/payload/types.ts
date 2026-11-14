import type { LexicalEditorState } from '#schemas/lexical.ts';
import type { Converters, RichTextConfig } from '#types.ts';

import type { InternalLinkTarget } from './links.ts';

export interface PayloadRichTextConfig<TContext = unknown> extends RichTextConfig<TContext> {
	internalDocToHref: (target: InternalLinkTarget, context: TContext) => Promise<string> | string;
	textStateClasses?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

// The core RichText accepts any config, so only the Payload RichText makes a missing resolver a type error
export interface PayloadRichTextProps<TContext = unknown> {
	config: PayloadRichTextConfig<TContext>;
	converters?: Converters;
	data: LexicalEditorState;
}
