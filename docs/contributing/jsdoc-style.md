# JSDoc style guide

How public sparkql APIs are documented in source. The model is drizzle-orm's
JSDoc: one plain sentence first, then the behavior, then examples a reader can
paste. Two things differ from drizzle. Every example also shows the SPARQL it
generates, and the syntax is TSDoc, so the comments render in editor hovers and
in a generated API reference (TypeDoc → `starlight-typedoc`) without changes.

## 1. What gets a comment

Document every symbol a user can import from `sparkql`, `sparkql/arq`,
`sparkql/stardog` or `sparkql/neptune`, plus every public member of an exported class or interface.

| Kind                                                                        | Required parts                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Builder method (`.where`, `.orderBy`, `.limit`, ...)                        | summary, body, `@param`, `@example`, plus `@throws` if it throws                              |
| Database method (`db.select`, `db.insert`, `db.createManagers`, ...)        | summary, body, `@param`, `@example`                                                           |
| Pattern / structure function (`triples`, `optional`, `filter`, `bind`, ...) | summary, body, `@param`, `@example`                                                           |
| SPARQL function or operator (`strlen`, `gt`, `count`, ...)                  | summary, `@param`, `@returns` only if the type is not obvious, `@example`                     |
| Class / interface / type alias                                              | summary, body if needed, `@typeParam` for non-obvious generics; one comment per property      |
| Options object property                                                     | summary, `@defaultValue` when there is a default, `@example` only if the shape is non-obvious |
| Error class                                                                 | summary, when it is thrown, which properties it carries                                       |
| Constant (`xsd`, dialect objects)                                           | summary                                                                                       |

Leave out:

- Implementation signatures of overloaded functions. TypeScript never shows
  them.
- Private and `protected` members, and non-exported helpers. A one-line `//`
  comment is enough when the logic is subtle.
- Internal type plumbing such as `RequiredKeys` or `Merge`. If it is exported
  only for declaration emit, mark it `@internal` and write one line.

## 2. Anatomy

The parts always come in this order. Leave out any part that has nothing to
say.

````text
/**
 * <Summary: one sentence.>
 *
 * <Body: one or more short paragraphs. Behavior, the SPARQL produced,
 *  constraints, interactions with other APIs.>
 *
 * See docs: {@link https://<docs-base>/<page>#<anchor>}
 *
 * @typeParam T - <only when the generic is something a user names or sees>
 * @param name - <description>
 * @returns <only when not obvious from the summary/type>
 * @throws {@link SparkqlError} <when / why>
 * @defaultValue <for option properties>
 *
 * @example
 * <One sentence saying what the example shows.>
 *
 * ```ts
 * <code>
 * ```
 *
 * ```sparql
 * <generated SPARQL>
 * ```
 *
 * @deprecated <What to use instead.> (only when deprecated)
 */
````

### Summary

- One sentence, ending with a period. Use the present tense, third person, and
  a verb first: "Adds a `FILTER` to the group pattern.", "Creates a database.",
  "Returns the length of a string literal."
- For types and properties, use a noun phrase: "Options for
  `SparqlDatabase.create()`.", "The session queries run through."
- Name the SPARQL construct in backticks and upper case: `` `OPTIONAL` ``,
  `` `ORDER BY` ``, `` `STRLEN` ``.
- Don't write "This function ...", "Method that ...", or a restatement of the
  name.

### Body

Cover what a user can't get from the signature:

- **The SPARQL it produces**, when the summary doesn't make it obvious.
- **Call-order and once-only rules.** For example, `groupBy` is removed from
  the chain after it is called, and it must come before `having`.
- **Typing effects.** For example, a variable inside `optional(...)` becomes
  `T | undefined` in results.
- **Runtime effects.** Does it execute a request? Is anything cached? Is it
  safe to await twice?
- **Pitfalls**, briefly: name collisions, SPARQL scoping, escaping.

Keep paragraphs to about four lines. Wrap at 100 columns, the Biome line width.
Use Markdown lists only for real enumerations. Use no headings.

### `See docs:` line

This copies drizzle (`See docs: {@link https://orm.drizzle.team/docs/select#filtering}`).
It links to the narrative page on the docs site. **The site doesn't exist yet,
so leave this line out for now.** It will be added in one pass once the site's
URLs are fixed.

### Tags

- `@param name - Description.` uses a hyphen and starts with a capital letter.
  Never repeat the type. For rest parameters, describe a single element:
  `@param patterns - Graph patterns to join into the group.`
- `@typeParam` only covers generics a user writes or sees in a hover in a
  meaningful way, such as `T` (result row) or `D` (dialect). Skip inference
  plumbing.
- `@returns` is left out for builder methods, which return the builder, and for
  any function whose summary already says what comes back.
- `@throws {@link SparkqlError} When ...` is used only for errors thrown
  synchronously during building. Rejections from execution belong in the body.
- `@defaultValue` holds the literal default in backticks: `` `false` ``,
  `` `'g_'` ``.
- `{@link Symbol}` is used for cross-references to other exported symbols.
  Write `{@link SparqlDatabase.create}` for members. Don't link to a symbol on
  every mention: once per comment is enough.
- `@deprecated Use {@link X} instead.` always names the replacement.
- Don't use `@since`, `@author`, `@memberof`, or JSDoc type syntax
  (`{string}`).

## 3. Examples

An example is the most valuable part of a comment, so it is required for every
user-facing callable.

1. Start each `@example` with one sentence of prose, then a ` ```ts `
   fence. Use several `@example` blocks when there are several distinct uses.
   Don't put several unrelated uses in one block.
2. Follow the code with a ` ```sparql ` fence of the generated query.
   Copy it from real `toSPARQL()` output and never write it by hand. Leave out
   the `PREFIX` lines, unless the example is about prefixes. If the example
   doesn't build a query (for example, an options object or a codec), leave out
   the SPARQL fence.
3. **Implicit preamble.** Every example in the root package can assume the
   following and must not repeat it:

   ```text
   import { /* every export of 'sparkql' */ } from 'sparkql';

   const prefixes = {
     foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] },
     schema: { uri: 'https://schema.org/', fields: [] },
   };
   const db = SparqlDatabase.create({ managerConfig: prefixes });
   const [v, n] = db.createManagers([], prefixes);
   ```

   So `db`, `v` (variables, `v.person` → `?person`), `n` (IRIs,
   `n.foaf.name` → `foaf:name`), and every root export are in scope.
4. Examples for `sparkql/arq` and `sparkql/stardog` write their own import and
   `SparqlDatabase.create()` from that entry point. The preamble's `db` is a
   plain SPARQL 1.1 database.
5. Examples that execute queries use `await`. Show the result shape in a
   trailing comment: `// [{ name: 'Ada', age: 36 }, ...]`.
6. Keep the domain consistent: people (`foaf:name`, `foaf:age`, `foaf:knows`)
   and, when more is needed, `schema:` books or movies. Don't use `foo`/`bar`.
7. Examples must typecheck. `test/docs.spec.ts` extracts
   `@example` ` ```ts ` fences from `src/**/*.ts` and checks them with the
   preamble prepended, the same way README fences are checked today.

## 4. Overloads

TypeScript shows the comment of the overload that a call resolved to, so every
public overload signature needs a comment.

- The **first** overload carries the full comment.
- Each later overload repeats the summary and documents only its own
  parameters and differences, ending with "See the first overload for details."
  The exception is overloads that are really different uses, such as
  `iri(value)` and `iri(value, prefix)`: each of those gets its own
  `@example`.

## 5. Worked examples

### Pattern function: `filter`

````text
/**
 * Adds a `FILTER` to the enclosing group pattern.
 *
 * Solutions for which `expression` evaluates to false, or raises an error, are
 * removed. SPARQL applies a filter to the whole group it appears in, wherever
 * it is placed, so `filter` can be listed before or after the triples it tests.
 *
 * @param expression - A boolean expression, usually built from operators such as
 * {@link gt} or functions such as {@link regex}.
 *
 * @example
 * Keep only adults.
 *
 * ```ts
 * const adults = db
 *   .select({ name: v.name })
 *   .where(
 *     triples(v.person, n.foaf.name, v.name),
 *     triples(v.person, n.foaf.age, v.age),
 *     filter(gt(v.age, 18))
 *   );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age > "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function filter<E extends ExpressionInput>(
  expression: E
): PatternFilterInput & PlaceholderCarrier<PlaceholderValues<E>>;
````

### SPARQL function: `strlen`

````text
/**
 * Returns the number of characters in a string literal (`STRLEN`).
 *
 * @param value - A string literal or an expression that evaluates to one.
 *
 * @example
 * Find people whose name is longer than three characters.
 *
 * ```ts
 * db.select({ name: v.name }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(gt(strlen(v.name), 3))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( ( STRLEN( ?name ) > "3"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function strlen(...args: [ExpressionInput]): ExpressionOperationInput<number>;
````

### Builder method: `.orderBy`

````text
/**
 * Adds an `ORDER BY` clause to the query.
 *
 * Orderings are applied left to right. A bare variable or expression sorts
 * ascending. Wrap it in {@link desc} (or {@link asc}) to choose the direction.
 * Can be called once. After it, `where`, `groupBy`, `having`, `from` and
 * `fromNamed` are no longer available on the chain.
 *
 * @param orderings - Variables, expressions or `asc(...)`/`desc(...)` orderings.
 *
 * @example
 * Oldest first, then alphabetically.
 *
 * ```ts
 * db.select({ name: v.name })
 *   .where(
 *     triples(v.person, n.foaf.name, v.name),
 *     triples(v.person, n.foaf.age, v.age)
 *   )
 *   .orderBy(desc(v.age), v.name);
 * ```
 *
 * ```sparql
 * SELECT ?name WHERE {
 *   ?person foaf:name ?name .
 *   ?person foaf:age ?age .
 * }
 * ORDER BY DESC ( ?age ) ASC ( ?name )
 * ```
 */
````

### Options property: `queryInErrors`

```text
/**
 * Repeats the generated SPARQL in the `message` of a {@link SparkqlQueryError}.
 *
 * Off by default, because values inlined into a query (VALUES rows, literals)
 * would reach every log that records error messages. The error's `query`
 * property always holds the SPARQL, whatever this is set to.
 *
 * @defaultValue `false`
 */
queryInErrors?: boolean;
```

## 6. Accuracy rules for writers

- Read the implementation before describing its behavior. Many builders have
  once-only or chain-narrowing rules (`QueryBuilderBaseWithout`) that the
  comment must state correctly.
- Generate every SPARQL block by running the code. Never write one by hand.
- Don't document behavior you inferred from the name alone. If something is
  unclear, write the comment for what the code does and flag the question in
  your hand-off notes.
- Comments only: change no code, types or formatting outside the comments.
  Existing comments are kept if accurate and rewritten into this format if not.
