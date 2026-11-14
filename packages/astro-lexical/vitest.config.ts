/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro's Vite config compiles the `.astro` converters the render tests import
// Astro roots at `process.cwd()` unless told, which is the repo root under `test.projects`
export default getViteConfig(
	{
		test: {
			include: ['tests/**/*.test.ts'],
			name: 'astro-lexical',
			silent: 'passed-only',
			testTimeout: 60_000,
		},
	},
	{ root: import.meta.dirname },
);
