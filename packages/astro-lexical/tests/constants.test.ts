import { TableCellHeaderStates } from '@lexical/table';
import { TEXT_TYPE_TO_FORMAT } from 'lexical';
import { describe, expect, it } from 'vitest';

import { tableCellHeader, textFormat } from '#constants.ts';

// Copied rather than imported, since `lexical` is a devDependency the renderer never loads at runtime
describe('constants', () => {
	it('matches the text format bits Lexical serializes', () => {
		expect(textFormat).toEqual(TEXT_TYPE_TO_FORMAT);
	});

	it('matches the table cell header states Lexical serializes', () => {
		expect(tableCellHeader).toEqual({
			both: TableCellHeaderStates.BOTH,
			column: TableCellHeaderStates.COLUMN,
			none: TableCellHeaderStates.NO_STATUS,
			row: TableCellHeaderStates.ROW,
		});
	});
});
