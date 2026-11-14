// Lexical text format bitmask values
export const textFormat = {
	bold: 1,
	capitalize: 1024,
	code: 16,
	highlight: 128,
	italic: 2,
	lowercase: 256,
	strikethrough: 4,
	subscript: 32,
	superscript: 64,
	underline: 8,
	uppercase: 512,
} as const;

export const tableCellHeader = {
	both: 3,
	column: 2,
	none: 0,
	row: 1,
} as const;
