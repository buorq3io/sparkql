# 12: Type-test suite and export-conflict test

Kind: tooling. Size: M. Read [README.md](README.md) first.

## Goal

Catch type regressions and export clashes automatically. sparkql's value is in
its types (result inference, dialect gating, fluent method exclusions), but its
type assertions are scattered through runtime specs.

## Read first

- `drizzle-orm/type-tests/utils.ts`: `Expect<Equal<X, Y>>`, an exact type
  equality check (not assignability).
- `drizzle-orm/type-tests/pg/select.ts`, `subquery.ts`, `with.ts`,
  `rqb-known-keys.ts`: how drizzle structures type tests. One file per feature,
  `Expect<Equal<...>>` for inference, `// @ts-expect-error` for things that must
  not compile. The suite is compiled by `tsc` (`"test:types": "cd type-tests && tsc"`
  in `drizzle-orm/package.json`) and never executed.
- `drizzle-orm/tests/exports.test.ts`: uses `ts-morph` to fail when two
  `export *` sources export the same name into one barrel.

## sparkql today (verified)

- About 46 `@ts-expect-error`/`expectTypeOf`-style assertions live inside the
  runtime specs in `test/` (e.g. `test/dialect.spec.ts`).
- `tsconfig.json` includes `test/**/*.ts`, so `typecheck` already compiles
  tests; there is no dedicated type-test location.
- `src/index.ts` and `src/database/index.ts` re-export several barrels with
  `export *`. `src/arq/index.ts` and `src/stardog/index.ts` re-export
  `../index.js` and then declare their own `SparqlDatabase`. A local export
  silently shadows a star export, so a clash is easy to introduce unnoticed.

## Design direction

- Add `test/types/` with one file per feature area: select result inference
  (`InferredSelectResult`, `Presence.optional`), `TypedSelectedVariables`,
  dialect gating (ARQ patterns rejected by a standard database), `$dynamic` and
  the `RootQueryBuilderBaseWithout` method exclusions, query-module methods on
  ARQ/Stardog databases, `TermFormats` input types.
- Use vitest's `expectTypeOf` with `vitest --typecheck`, or drizzle's
  `Expect<Equal<>>` compiled by `tsc`; pick one and use it everywhere. Exact
  equality matters: assignability checks miss `any` leaks.
- Move existing type assertions out of the runtime specs only where that
  clarifies them; do not churn working tests.
- Port drizzle's export-conflict test (ts-morph is a new dev dependency; a
  lighter approach using the TypeScript compiler API is fine). Treat the
  intended `SparqlDatabase` overrides in `arq`/`stardog` as an explicit
  allow-list.
- Wire both into `package.json` scripts and `.github/workflows/test.yml`.

## Done when

- The type suite fails when a covered inference changes (prove it by temporarily
  breaking one, e.g. making `InferredSelectResult` return `any`).
- The export test fails on a newly introduced duplicate export and passes on the
  current tree with the documented allow-list.
- CI runs both.
