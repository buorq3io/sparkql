import { expectTypeOf } from 'vitest';
import { SparqlDatabase as ArqDatabase } from '../../src/arq/index.js';
import {
  castNumber,
  type DefaultQueryReturnType,
  defaultCodecs,
  type LangString,
  maybe,
  SparqlDatabase,
  triples,
} from '../../src/index.js';

const plain = SparqlDatabase.create();
const [v] = plain.createManagers([], {});
const pattern = triples(v.person, v.p, v.name);

// Without codecs, bare variables stay RDF/JS terms.
const plainRows = plain.select({ name: v.name }).where(pattern);
expectTypeOf<Awaited<typeof plainRows>>().toEqualTypeOf<{ name: DefaultQueryReturnType }[]>();

// With codecs, a bare variable is the raw term or any value a decoder returns.
const decoded = SparqlDatabase.create({
  codecs: defaultCodecs({ integer: 'bigint', decimal: 'string' }),
});
const rows = decoded
  .select({ name: v.name, age: castNumber(v.age), nick: maybe(v.nick) })
  .where(pattern);
type Row = Awaited<typeof rows>[number];
type Decoded = DefaultQueryReturnType | string | boolean | number | bigint | Date | LangString;
expectTypeOf<Row['name']>().toEqualTypeOf<Decoded>();
// An explicit cast wins over the codec table, so its type is unchanged.
expectTypeOf<Row['age']>().toEqualTypeOf<number>();
// Optional variables keep `undefined`.
expectTypeOf<Row['nick']>().toEqualTypeOf<Decoded | undefined>();

// The codec table survives base() and prefix(), and applies to DISTINCT and REDUCED.
const based = decoded.base('https://example.org/').prefix({ ex: 'https://example.org/' });
const distinct = based.selectDistinct({ name: v.name }).where(pattern);
expectTypeOf<Awaited<typeof distinct>[number]['name']>().toEqualTypeOf<Decoded>();
const reduced = based.selectReduced({ name: v.name }).where(pattern);
expectTypeOf<Awaited<typeof reduced>[number]['name']>().toEqualTypeOf<Decoded>();

// A custom table contributes its own decoder outputs.
const custom = SparqlDatabase.create({
  codecs: { 'https://example.org/money': { decode: term => ({ cents: Number(term.value) }) } },
});
const money = custom.select({ price: v.price }).where(pattern);
expectTypeOf<Awaited<typeof money>[number]['price']>().toEqualTypeOf<
  DefaultQueryReturnType | { cents: number }
>();

// A table without decoders changes nothing.
const empty = SparqlDatabase.create({ codecs: {} });
const unchanged = empty.select({ name: v.name }).where(pattern);
expectTypeOf<Awaited<typeof unchanged>[number]['name']>().toEqualTypeOf<DefaultQueryReturnType>();

// Dialect entry points carry the table too.
const arq = ArqDatabase.create({ codecs: defaultCodecs({ integer: 'number', decimal: 'number' }) });
const arqRows = arq.select({ name: v.name }).where(pattern);
expectTypeOf<Awaited<typeof arqRows>[number]['name']>().toEqualTypeOf<
  DefaultQueryReturnType | string | boolean | number | Date | LangString
>();
