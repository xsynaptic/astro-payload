// The bare `tsc --noEmit` after `astro check` has no `.astro` resolver, so a `.ts` importing one fails TS2307
// Only tsc reads this; the language server resolves the real file and keeps prop types
declare module '*.astro' {
	import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

	const component: AstroComponentFactory;

	export default component;
}
