import { getAstroConfig, getConfig } from '@xsynaptic/eslint-config';
import tseslint from 'typescript-eslint';

export default getConfig([
	{
		ignores: ['**/dist/**', '**/node_modules/**', '**/.astro/**', '.claude/**'],
	},
	...getAstroConfig(),
	{
		files: ['**/*.config.{ts,mts,mjs,js}', '**/test/**', '**/tests/**', '**/__tests__/**'],
		...tseslint.configs.disableTypeChecked,
	},
	{
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: [{ group: ['../*'], message: 'Use a `#` subpath import from package.json' }] },
			],
		},
	},
	{
		// Code complexity rules promoting higher quality agentic coding output
		rules: {
			complexity: ['warn', { max: 16, variant: 'modified' }],
			'max-depth': ['warn', 4],
			'max-lines-per-function': ['warn', { max: 145, skipBlankLines: true, skipComments: true }],
			'max-params': ['warn', 4],
			'max-statements': ['warn', 38],
		},
	},
]);
