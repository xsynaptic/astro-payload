import { describe, expect, it } from 'vitest';

import table from '#tests/payload/fixtures/table.json' with { type: 'json' };
import { element, renderCore } from '#tests/render-test-utils.ts';

const [, grid] = table.root.children;

function cellTags(html: string) {
	return [...html.matchAll(/<(td|th)([^>]*)>(.*?)<\/\1>/gs)].map(
		([, tag, attributes = '', body = '']) => ({ attributes: attributes.trim(), body, tag }),
	);
}

function singleCellTable(cell: object, tableFields: object = {}) {
	const paragraph = {
		...element,
		children: [{ text: 'Day', type: 'text', version: 1 }],
		type: 'paragraph',
	};
	const row = {
		...element,
		children: [{ ...element, children: [paragraph], headerState: 0, type: 'tablecell', ...cell }],
		type: 'tablerow',
	};

	return { ...element, children: [row], type: 'table', ...tableFields };
}

async function renderCells(children: Array<unknown>) {
	const { html } = await renderCore(children);

	return cellTags(html);
}

describe('table', () => {
	it('renders the captured table without an issue', async () => {
		const { html, issues } = await renderCore(table.root.children);

		expect(issues).toEqual([]);
		expect(html).toMatch(/<table>\s*<tbody>\s*<tr>/);
		expect(cellTags(html)).toHaveLength(10);
	});

	it('scopes a header row cell to its column and a header column cell to its row', async () => {
		const cells = await renderCells([grid]);
		const byText = (text: string) => cells.find(({ body }) => body.includes(text));

		expect(byText('Day')).toMatchObject({ attributes: 'scope="col"', tag: 'th' });
		expect(byText('Morning')).toMatchObject({ attributes: 'scope="col"', tag: 'th' });
		expect(byText('Monday')).toMatchObject({ attributes: 'scope="row"', tag: 'th' });
		expect(byText('Open</p>')).toMatchObject({ attributes: '', tag: 'td' });
	});

	it('writes a span only where it exceeds one cell', async () => {
		const cells = await renderCells([grid]);

		expect(cells.find(({ body }) => body.includes('Closed'))?.attributes).toBe('rowspan="2"');
		expect(cells.find(({ body }) => body.includes('Open all day'))?.attributes).toBe('colspan="2"');
		expect(cells.filter(({ attributes }) => attributes.includes('span'))).toHaveLength(2);
	});

	it('renders every paragraph a cell holds, with its formatting', async () => {
		const cells = await renderCells([grid]);
		const cell = cells.find(({ body }) => body.includes('Guided tour'));

		expect(cell?.body).toMatch(
			/<p>Guided tour, <strong>booking required<\/strong><\/p>\s*<p>Meet at the gate<\/p>/,
		);
	});

	it('renders an empty corner as a data cell, since an empty header names nothing', async () => {
		const corner = { children: [{ ...element, children: [], type: 'paragraph' }], headerState: 3 };
		const [cell] = await renderCells([singleCellTable(corner)]);

		expect(cell).toMatchObject({ attributes: '', tag: 'td' });
	});

	it('renders a header holding only whitespace as a data cell', async () => {
		const whitespace = {
			children: [
				{ ...element, children: [{ text: '  ', type: 'text', version: 1 }], type: 'paragraph' },
			],
			headerState: 1,
		};
		const [cell] = await renderCells([singleCellTable(whitespace)]);

		expect(cell).toEqual({ attributes: '', body: '', tag: 'td' });
	});

	it('keeps a header holding a blank paragraph beside text as a header', async () => {
		const mixed = {
			children: [
				{ ...element, children: [{ type: 'linebreak', version: 1 }], type: 'paragraph' },
				{ ...element, children: [{ text: 'Day', type: 'text', version: 1 }], type: 'paragraph' },
			],
			headerState: 1,
		};
		const [cell] = await renderCells([singleCellTable(mixed)]);

		expect(cell).toMatchObject({ attributes: 'scope="col"', body: '<p>Day</p>', tag: 'th' });
	});

	it('masks a stray header bit the way upstream does on load', async () => {
		const [stray] = await renderCells([singleCellTable({ headerState: 4 })]);
		const [corner] = await renderCells([singleCellTable({ headerState: -1 })]);

		expect(stray?.tag).toBe('td');
		expect(corner).toMatchObject({ attributes: 'scope="col"', tag: 'th' });
	});

	it('reads a null or zero span as a single cell, as upstream repairs it', async () => {
		// eslint-disable-next-line unicorn/no-null -- Payload saves a cleared span as `null`
		const { html, issues } = await renderCore([singleCellTable({ colSpan: null, rowSpan: 0 })]);

		expect(issues).toEqual([]);
		expect(cellTags(html)).toMatchObject([{ attributes: '', tag: 'td' }]);
	});

	it.each([1.5, '1'])(
		'drops a cell whose header state is %s and reports it',
		async (headerState) => {
			const { html, issues } = await renderCore([singleCellTable({ headerState })]);

			expect(html).toContain('<tr>');
			expect(cellTags(html)).toEqual([]);
			expect(issues).toMatchObject([{ kind: 'invalid', nodeLabel: 'tablecell' }]);
		},
	);

	it('places an aligned table and aligns the text of an aligned cell', async () => {
		const { html, issues } = await renderCore([
			singleCellTable({ format: 'right' }, { colWidths: [92, 120], format: 'center' }),
		]);

		expect(issues).toEqual([]);
		expect(html).toContain('<table style="margin-inline:auto">');
		expect(cellTags(html)).toMatchObject([{ attributes: 'style="text-align:right"' }]);
	});
});
