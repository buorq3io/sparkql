import { expectTypeOf } from 'vitest';
import {
  as,
  castDate,
  castNumber,
  castString,
  count,
  type DefaultQueryReturnType,
  type InferredSelectResult,
  maybe,
  type Presence,
  SparqlDatabase,
  type TermVariableAndBinding,
  type TermVariableInput,
  type TypedSelectedVariables,
} from '../../src/index.js';

const db = SparqlDatabase.create();
const [v] = db.createManagers([], {});

// Bare variables select RDF/JS terms; casts, `as` and `maybe` refine them.
const query = db.select({
  term: v.term,
  number: castNumber(v.number),
  date: maybe(castDate(v.date)),
  total: as(count(v.item), v.total),
});
expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<
  InferredSelectResult<{
    term: TermVariableInput;
    number: TermVariableAndBinding<number>;
    date: TermVariableAndBinding<Date, Presence.optional>;
    total: TermVariableAndBinding<number>;
  }>[]
>();
type Row = Awaited<typeof query>[number];
expectTypeOf<Row['term']>().toEqualTypeOf<DefaultQueryReturnType>();
expectTypeOf<Row['number']>().toEqualTypeOf<number>();
expectTypeOf<Row['date']>().toEqualTypeOf<Date | undefined>();
expectTypeOf<Row['total']>().toEqualTypeOf<number>();

// A variable from `db.variable()` selects like one from a manager.
const direct = db.select({ term: db.variable('term'), number: castNumber(db.variable('n')) });
expectTypeOf<Awaited<typeof direct>>().toEqualTypeOf<
  { term: DefaultQueryReturnType; number: number }[]
>();

// The result type survives the fluent chain.
const chained = db
  .selectDistinct({ name: castString(v.name) })
  .where()
  .limit(1);
expectTypeOf<Awaited<typeof chained>>().toEqualTypeOf<{ name: string }[]>();
const reduced = db.selectReduced({ name: castString(v.name) });
expectTypeOf<Awaited<typeof reduced>>().toEqualTypeOf<{ name: string }[]>();

// `Presence.optional` adds `undefined`; required presence does not.
expectTypeOf<
  InferredSelectResult<{
    a: TermVariableAndBinding<number, Presence.optional>;
    b: TermVariableAndBinding<string, Presence.required>;
  }>
>().toEqualTypeOf<{ a: number | undefined; b: string }>();

// An explicit result type drives the accepted variables.
interface Person {
  name: string;
  nickname: string | undefined;
  age?: number;
}
const typed = db.select<Person>({
  name: castString(v.name),
  nickname: maybe(castString(v.nickname)),
});
expectTypeOf<Awaited<typeof typed>>().toEqualTypeOf<Person[]>();
db.select<Person>({
  // @ts-expect-error A required string field cannot take a number cast.
  name: castNumber(v.name),
  nickname: maybe(castString(v.nickname)),
});
// @ts-expect-error Required fields must be selected.
db.select<Person>({ nickname: maybe(castString(v.nickname)) });
db.select<Person>({
  // @ts-expect-error A field that cannot be undefined does not accept an optional variable.
  name: maybe(castString(v.name)),
  nickname: maybe(castString(v.nickname)),
});
expectTypeOf<TypedSelectedVariables<{ a: number }>['a']>().toEqualTypeOf<
  TermVariableAndBinding<number>
>();
