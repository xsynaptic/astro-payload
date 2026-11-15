/* eslint-disable @typescript-eslint/no-empty-function -- console spies are intentional no-ops */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseRichTextField } from '#parse-field.ts';
import { definePayloadRichText } from '#payload/definitions.ts';
import { editorState, element } from '#tests/render-test-utils.ts';

const definitions = definePayloadRichText();

const document = editorState([
	{ ...element, children: [{ text: 'Kept', type: 'text', version: 1 }], type: 'paragraph' },
	{ fields: { blockType: 'callout' }, type: 'block', version: 2 },
]);

function createOptions(isStrict: boolean) {
	return {
		context: { addIssue: vi.fn() },
		documentLabel: 'posts/en/1',
		path: ['content'],
		strict: isStrict,
	};
}

describe('parseRichTextField', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fails the entry at the dropped node when strict, without warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const options = createOptions(true);

		const content = parseRichTextField(definitions, document, options);

		expect(content?.root.children).toHaveLength(1);
		expect(options.context.addIssue).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				message: expect.stringContaining('block:callout') as unknown,
				path: ['content', 'root', 'children', 1],
			}),
		);
		expect(warn).not.toHaveBeenCalled();
	});

	it('keeps what renders and warns with the document label when lenient', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const options = createOptions(false);

		const content = parseRichTextField(definitions, document, options);

		expect(content?.root.children).toHaveLength(1);
		expect(options.context.addIssue).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('posts/en/1'));
	});
});
