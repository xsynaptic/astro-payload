import type { PayloadTextNode } from './schemas.ts';
import type { PayloadRichTextConfig } from './types.ts';

function getOwn<TValue>(record: Readonly<Record<string, TValue>> | undefined, key: string) {
	return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

export function getTextStateClass(
	state: PayloadTextNode['$'],
	classes: PayloadRichTextConfig['textStateClasses'],
) {
	if (!state) return;

	const names: Array<string> = [];

	for (const [key, value] of Object.entries(state)) {
		if (typeof value !== 'string') continue;

		const name = getOwn(getOwn(classes, key), value);
		if (name) names.push(name);
	}

	return names.length > 0 ? names.join(' ') : undefined;
}
