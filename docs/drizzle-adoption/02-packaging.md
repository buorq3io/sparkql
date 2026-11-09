# 02: Real dual CJS/ESM package

Kind: bug + tooling. Size: M. Read [README.md](README.md) first.

## Goal

Ship a CommonJS build that works on every Node version `engines` allows, and
add an automated check that the published `exports` map resolves for CJS, ESM
and bundler consumers.

## Read first

- `drizzle-orm/scripts/build.ts`: tsdown with `unbundle: true`,
  `format: ['cjs', 'es']`, `dts: true`, and `outExtensions` emitting
  `.cjs`/`.d.cts` next to `.js`/`.d.ts`. One source tree compiled twice, no
  hand-written per-format entry files.
- `drizzle-orm/scripts/fix-imports.ts` and `emit-dir-index-shims.ts`: the
  post-processing tsdown needed. Read them to learn which problems they solve
  before deciding whether sparkql has the same problems; sparkql has only three
  entry points.
- `drizzle-orm/package.json` `exports` (L19-40): root plus a `./*` wildcard,
  `types` listed before `default` in each condition.
- `drizzle-orm/tests/exports-resolution.test.ts`: packs the tarball and runs
  attw ("are the types wrong") across `node16-cjs`, `node16-esm` and
  `bundler`. Drizzle uses a fork (`attw-fork/`); sparkql can use the published
  `@arethetypeswrong/cli` or its core package.

## sparkql today (verified)

- `pnpm build` is `tsc --project tsconfig.build.json`. `src/index.cts` is
  `export * from './index.js'`, so `dist/index.cjs` does
  `require('./index.js')`, and `./index.js` is an ES module (`"type": "module"`).
- Running `node --no-experimental-require-module -e "require('./dist/index.cjs')"`
  fails with `ERR_REQUIRE_ESM`. That is the default behaviour on Node
  20.0–20.18 and 22.0–22.11, while `engines` is `>=20.0.0`. It only works on
  newer Node because of require(esm).
- The same pattern repeats for `src/arq.cts` and `src/stardog.cts`. The
  `.mts`/`.cts` wrapper files exist only to produce these entry points.
- The publish workflow (`.github/workflows/publish.yml`) runs `build` and then
  publishes; nothing checks the packed output.

## Design direction

Pick one, and state the choice and reason in the hand-off:

- **Preferred:** build real CJS and ESM output with tsdown (or tsup), following
  drizzle's build script. Delete the `.mts`/`.cts` wrappers and keep
  `src/index.ts`, `src/arq/index.ts`, `src/stardog/index.ts` as entries.
  Unbundled output keeps one module per source file, as drizzle does.
- **Fallback:** declare ESM-first and raise `engines` to
  `^20.19.0 || >=22.12.0`, where `require(esm)` is unflagged. Simpler, but the
  CJS build becomes nominal.

In both cases:

- Keep the `#src/*` / `#test/*` import aliases working for tests.
- Watch for the dual-package hazard: with real CJS and ESM copies, `instanceof`
  checks across copies fail. Brief 05 handles this with entity kinds; mention
  any `instanceof` in `src/` you find so 05 can cover it.

## Done when

- `node --no-experimental-require-module -e "require('./dist/index.cjs')"` and
  the same for `arq` and `stardog` load and expose `SparqlDatabase` (preferred
  path), or `engines` matches reality (fallback path).
- A test (or CI step) packs the package and runs attw across `node16-cjs`,
  `node16-esm` and `bundler` for `.`, `./arq` and `./stardog` with no problems.
- CI runs that check (`.github/workflows/test.yml`).
