import { toSafeHref } from '#safe-href.ts';

import type { PayloadLinkNode, PayloadRelationshipNode } from './schemas.ts';
import type { PayloadRichTextConfig } from './types.ts';

// The resolver sees one shape whether or not Payload populated the target
export interface InternalLinkTarget {
	doc?: Record<string, unknown>;
	id: number | string;
	relationTo: string;
}

// The resolver may build an href from document data, so it passes the same scheme check as an authored URL
export async function resolvePayloadLinkHref(
	fields: PayloadLinkNode['fields'],
	config: Pick<PayloadRichTextConfig, 'context' | 'internalDocToHref' | 'siteHref'>,
): Promise<string> {
	if (fields.linkType !== 'internal') return config.siteHref(toSafeHref(fields.url));

	const target = toInternalLinkTarget(fields.doc);
	if (!target) return '#';

	return toSafeHref(await config.internalDocToHref(target, config.context));
}

export async function resolveRelationshipHref(
	{
		relationTo,
		value,
	}: { relationTo: string; value: NonNullable<PayloadRelationshipNode['value']> },
	config: Pick<PayloadRichTextConfig, 'context' | 'internalDocToHref'>,
): Promise<string> {
	const href = await config.internalDocToHref(
		{ doc: value, id: value.id, relationTo },
		config.context,
	);

	return toSafeHref(href);
}

export function toInternalLinkTarget(
	doc: PayloadLinkNode['fields']['doc'],
): InternalLinkTarget | undefined {
	if (!doc) return undefined;

	const { relationTo, value } = doc;

	if (typeof value === 'object') return { doc: value, id: value.id, relationTo };

	return { id: value, relationTo };
}
