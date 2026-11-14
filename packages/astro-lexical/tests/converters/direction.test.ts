import { describe, expect, it } from 'vitest';

import direction from '#tests/fixtures/direction.json' with { type: 'json' };
import { renderCore } from '#tests/render-test-utils.ts';

describe('element direction', () => {
	it('renders a right-to-left paragraph and heading with dir', async () => {
		const { html, issues } = await renderCore(direction.root.children);

		expect(issues).toEqual([]);
		expect(html).toContain('<p dir="rtl">نص تجريبي</p>');
		expect(html).toContain('<h2 dir="rtl">عنوان تجريبي</h2>');
	});

	it('leaves dir off an element with no direction of its own', async () => {
		const { html } = await renderCore(direction.root.children);

		expect(html).toContain('<p>Synthetic text</p>');
	});
});
