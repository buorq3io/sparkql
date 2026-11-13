import type * as AST from '@traqula/rules-sparql-1-1';
import { expectTypeOf } from 'vitest';
import {
  SparqlDatabase as ArqDatabase,
  arqDialect,
  lateral,
  letBinding,
} from '../../src/arq/index.js';
import { group, optional, SparqlDatabase, triples, union } from '../../src/index.js';
import {
  SparqlDatabase as NeptuneDatabase,
  neptuneDialect,
  queryHint,
} from '../../src/neptune/index.js';
import {
  adjust,
  SparqlDatabase as OxigraphDatabase,
  oxigraphDialect,
  lateral as oxigraphLateral,
} from '../../src/oxigraph/index.js';
import {
  containsWord,
  SparqlDatabase as QleverDatabase,
  qleverDialect,
  geof as qleverGeof,
  rowNumber,
  spatialSearch,
} from '../../src/qlever/index.js';
import {
  geof,
  SparqlDatabase as Rdf4jDatabase,
  rdf4jDialect,
  textSearch,
} from '../../src/rdf4j/index.js';
import { SparqlDatabase as StardogDatabase } from '../../src/stardog/index.js';

const standard = SparqlDatabase.create();
const arq = ArqDatabase.create();
const explicit = SparqlDatabase.create({ dialect: arqDialect });
const stardog = StardogDatabase.create();
const variable = arq.variable('value');
const letValue = letBinding(42, variable);

// ARQ databases accept ARQ patterns at any depth, however the dialect is chosen.
arq.select().where(letValue, lateral(letValue));
arq.ask().where(optional(union(group(lateral(letValue)))));
explicit.select().where(letValue);
explicit.construct().where(optional(letValue));

// Databases without the ARQ dialect reject ARQ patterns at any depth.
// @ts-expect-error LET is an ARQ extension.
standard.select().where(letValue);
// @ts-expect-error Nested LATERAL is still an ARQ extension.
standard.ask().where(optional(group(lateral(letValue))));
// @ts-expect-error The Stardog dialect does not include ARQ patterns.
stardog.select().where(letValue);
// Neptune databases accept query hints at any depth; other databases reject them.
const neptune = NeptuneDatabase.create();
const hint = queryHint('Query', 'useDFE', true);
neptune.select().where(hint, optional(group(queryHint('Group', 'joinOrder', 'Ordered'))));
neptune.describe(variable).where(queryHint('Query', 'describeMode', 'CBD'));
SparqlDatabase.create({ dialect: neptuneDialect }).ask().where(hint);
// @ts-expect-error Query hints are a Neptune extension.
standard.select().where(hint);
// @ts-expect-error The ARQ dialect does not include Neptune hints.
arq.select().where(optional(hint));
// @ts-expect-error The Neptune dialect does not include ARQ patterns.
neptune.select().where(letValue);
// @ts-expect-error useDFE is a Query hint only.
queryHint('Group', 'useDFE', true);
// @ts-expect-error joinOrder only accepts "Ordered".
queryHint('Query', 'joinOrder', 'Unordered');
// @ts-expect-error queryTimeout takes milliseconds as a number.
queryHint('Query', 'queryTimeout', '100');

// Oxigraph databases accept LATERAL at any depth, but not ARQ's LET.
const oxigraph = OxigraphDatabase.create();
const oxigraphGroup = oxigraphLateral(triples(variable, variable, variable));
oxigraph.select().where(oxigraphGroup, optional(group(oxigraphLateral(oxigraphGroup))));
SparqlDatabase.create({ dialect: oxigraphDialect }).ask().where(oxigraphGroup);
arq.select().where(oxigraphGroup);
// @ts-expect-error LATERAL is not SPARQL 1.1.
standard.select().where(oxigraphGroup);
// @ts-expect-error Oxigraph does not have LET.
oxigraph.select().where(letValue);
// @ts-expect-error Not even inside LATERAL.
oxigraphLateral(letValue);
// @ts-expect-error ARQ's LATERAL may hold LET, so it is typed as an ARQ pattern.
oxigraph.select().where(lateral(letValue));
// @ts-expect-error ADJUST needs a timezone.
adjust(variable);

// RDF4J databases accept text search at any depth; other databases reject it.
const rdf4j = Rdf4jDatabase.create();
const search = textSearch(variable, 'light*', { score: variable });
rdf4j.select().where(search, optional(group(textSearch(variable, [{ query: 'a', boost: 2 }]))));
SparqlDatabase.create({ dialect: rdf4jDialect }).ask().where(search);
// @ts-expect-error Text search is an RDF4J extension.
standard.select().where(search);
// @ts-expect-error The Oxigraph dialect does not include RDF4J text search.
oxigraph.select().where(search);
// @ts-expect-error A combined search takes properties in its clauses.
textSearch(variable, [{ query: 'a' }], { property: variable });
// @ts-expect-error The query must be a string; RDF4J cannot take a variable.
textSearch(variable, variable);
// @ts-expect-error db.explain() takes queries, not updates.
rdf4j.explain(rdf4j.insert(triples(variable, variable, variable)).where());
// @ts-expect-error Unknown explain level.
rdf4j.explain(rdf4j.ask().where(), 'Full');
expectTypeOf(rdf4j.explain(rdf4j.describe(variable).where())).resolves.toEqualTypeOf<string>();
expectTypeOf(geof.sfWithin(variable, 'POINT(0 0)').transform).returns.toEqualTypeOf<boolean>();
// @ts-expect-error The distance needs a unit.
geof.distance(variable, variable);

// QLever databases accept QLever patterns at any depth; other databases reject them.
const qlever = QleverDatabase.create();
const words = containsWord(variable, 'light*');
qlever.select().where(words, optional(group(containsWord(variable, 'x'))));
SparqlDatabase.create({ dialect: qleverDialect }).ask().where(words);
// @ts-expect-error QLever text search is a QLever extension.
standard.select().where(words);
// @ts-expect-error The RDF4J dialect does not include QLever patterns.
rdf4j.select().where(words);
// @ts-expect-error RDF4J text search is not QLever's.
qlever.select().where(search);
// @ts-expect-error The algorithm is required.
spatialSearch({ left: variable, right: variable, maxDistance: 1 }, words);
const nearJoin = {
  algorithm: 'libspatialjoin',
  left: variable,
  right: variable,
  joinType: 'near',
} as const;
// @ts-expect-error Only the documented join types.
spatialSearch(nearJoin, words);
// @ts-expect-error Row numbers need a subquery group.
rowNumber(variable, words);
// @ts-expect-error QUDT unit names only.
qleverGeof.distance(variable, variable, 'metre');
// @ts-expect-error Areas take area units.
qleverGeof.area(variable, 'M');
expectTypeOf(
  qleverGeof.sfWithin(variable, 'POINT(0 0)').transform
).returns.toEqualTypeOf<boolean>();

// @ts-expect-error `$dynamic()` lifts clause restrictions, not dialect checks.
standard.select().$dynamic().where(letValue);

// The dialect changes what can be built, not what a query returns.
const arqQuery = arq.select({ value: variable }).where(letValue);
const standardQuery = standard.select({ value: variable }).where();
expectTypeOf<Awaited<typeof arqQuery>>().toEqualTypeOf<Awaited<typeof standardQuery>>();
expectTypeOf(standard.select().getSPARQL()).toEqualTypeOf<AST.QuerySelect>();

// Neptune hints change neither results nor the generated AST's standard shape.
const neptuneQuery = neptune.select({ value: variable }).where(hint);
expectTypeOf<Awaited<typeof neptuneQuery>>().toEqualTypeOf<Awaited<typeof standardQuery>>();
