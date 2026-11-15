# astro-payload

Astro packages for sites built on [Payload CMS](https://payloadcms.com/), published via npm under the `@xsynaptic` scope.

## Packages

- [`@xsynaptic/astro-lexical`](./packages/astro-lexical): render Lexical rich text in Astro, with a Payload preset

## Development

```sh
pnpm install      # install dependencies
pnpm build        # check each package's publish shape (publint)
pnpm test         # run all tests (vitest)
pnpm test:e2e     # build each playground and check its output
pnpm check        # report-only: prettier check, lint, type-check, knip, tests
pnpm fix          # auto-fix: prettier write + eslint --fix, then type-check + knip
```

## Releasing

Versioning and publishing are managed by [changesets](https://github.com/changesets/changesets):

```sh
pnpm version-packages  # apply pending changesets and update changelogs, then commit the result
pnpm release           # check, publish to npm, and push with tags
```

Changesets publishes from the working tree and tags the current commit, so `pnpm release` only runs from an up-to-date `main` with no pending changesets and nothing uncommitted that would change what ships.
