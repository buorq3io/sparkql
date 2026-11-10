# Type tests

Compile-only checks for sparkql's public types. `pnpm test:types` compiles this
folder with `tsc`; nothing here is executed, so module-level code only has to
type-check.

- One file per feature area.
- Use vitest's `expectTypeOf(...).toEqualTypeOf<...>()` for inference. It checks
  exact equality, so an `any` leak fails where an assignability check would pass.
- Use `// @ts-expect-error <reason>` for code that must not compile.
