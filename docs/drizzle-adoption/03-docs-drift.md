# 03: README and docs drift

Kind: docs. Size: S. Read [README.md](README.md) first.

## Goal

Every code sample in `README.md` and `docs/*.md` compiles against the current
API and does what its prose claims.

## Read first

- `docs/dialects.md` "Design references" links point at drizzle's `main`
  branch. Open the same files on the pinned beta commit
  (`drizzle-orm/src/pg-core/query-builders/query-builder.ts`,
  `drizzle-orm/src/pg-core/query-builders/select.types.ts`) and confirm the
  statements made about them still hold, then repoint the links using the
  pinned permalink format from the index.

## sparkql today (verified)

- README Quick Start: `const [v, n] = db.create([], prefixes);`. The method
  is `createManagers(variableKeys, nodeConfig, mode?)`, which returns
  `[variables, nodes, blanks]` (`src/database/base.ts`). `db.create(graph)`
  now exists and builds a `CREATE GRAPH` update, so the sample silently means
  something else.
- Other samples have not been checked against the code.

## Design direction

- Extract every fenced TypeScript block from `README.md` and `docs/*.md` into a
  throwaway file (or a test under `test/`) and typecheck it against `#src`.
  Fix the docs, never the API, unless a sample reveals a real bug: report
  those in the hand-off.
- Consider keeping that extraction as a permanent test so samples cannot drift
  again; if you do, keep it fast and offline.

## Done when

- Every TypeScript sample in `README.md` and `docs/*.md` typechecks against the
  current source (you have run it, not eyeballed it).
- Drizzle links in `docs/` use the pinned beta commit.
