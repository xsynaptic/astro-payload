import { describe, expect, it } from 'vitest';

import checkList from '#tests/fixtures/check-list.json' with { type: 'json' };
import { renderCore } from '#tests/render-test-utils.ts';

function listItems(html: string) {
	return [...html.matchAll(/<li([^>]*)>/g)].map(([, attributes = '']) => attributes.trim());
}

describe('check-list item', () => {
	it('renders the captured lists without an issue', async () => {
		const { issues } = await renderCore(checkList.root.children);

		expect(issues).toEqual([]);
	});

	it('marks checked and unchecked items as checkboxes in that state', async () => {
		const { html } = await renderCore(checkList.root.children);

		expect(html).toMatch(/<li aria-checked="true" data-checked="true" role="checkbox"[^>]*>Done</);
		expect(html).toMatch(
			/<li aria-checked="false" data-checked="false" role="checkbox"[^>]*>Not done</,
		);
	});

	it('gives the nested list wrapper no checkbox, and the item inside it one', async () => {
		const { html } = await renderCore(checkList.root.children);
		const [wrapper, nested] = listItems(html).slice(2);

		expect(wrapper).toBe('data-nested-list');
		expect(nested).toMatch(/^aria-checked="true" data-checked="true" role="checkbox"/);
	});

	it('leaves an item outside a check list without a checkbox', async () => {
		const { html } = await renderCore(checkList.root.children);

		expect(listItems(html).at(-1)).toBe('value="1"');
	});
});
