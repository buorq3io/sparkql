import { expectTypeOf } from 'vitest';
import {
  SparqlDatabase as ArqDatabase,
  type ConstructedQuad,
  type JsonScalar,
  triples,
} from '../../src/arq/index.js';
import { SparqlDatabase } from '../../src/index.js';
import { type PathResult, SparqlDatabase as StardogDatabase } from '../../src/stardog/index.js';

const standard = SparqlDatabase.create();
const arq = ArqDatabase.create();
const stardog = StardogDatabase.create();
const [v] = arq.createManagers([], {});

// ARQ adds JSON and quad CONSTRUCT forms.
const json = arq.json({ name: v.name, answer: 42, active: true, text: 'hi' }).where();
expectTypeOf<Awaited<typeof json>>().toEqualTypeOf<
  ({ answer: number; active: boolean; text: string } & { name?: JsonScalar })[]
>();
const quads = arq.constructQuads(triples(v.s, v.p, v.o)).where();
expectTypeOf<Awaited<typeof quads>>().toEqualTypeOf<ConstructedQuad[]>();

// Stardog adds PATHS, executable once START, END and VIA are given.
const paths = stardog
  .paths()
  .start(stardog.variable('s'))
  .end(stardog.variable('e'))
  .via(stardog.variable('p'));
expectTypeOf<Awaited<typeof paths>>().toEqualTypeOf<PathResult[]>();
// @ts-expect-error An incomplete PATHS query is not executable.
stardog.paths().start(stardog.variable('s')).then();

// Modifiers keep the narrowing: they hide neither the endpoint methods' removal nor execution.
const graph = stardog.iri('https://example.org/g');
const incomplete = stardog.paths().all().shortest().cyclic().from(graph).fromNamed(graph);
for (const key of ['then', 'execute', 'getSPARQL', 'toSPARQL'] as const) {
  expectTypeOf(incomplete).not.toHaveProperty(key);
  expectTypeOf(incomplete.maxLength(1).limit(1).offset(1)).not.toHaveProperty(key);
}
const modified = paths.all().cyclic().maxLength(4).offset(1).limit(3).from(graph);
for (const key of ['start', 'end', 'via'] as const) {
  expectTypeOf(modified).not.toHaveProperty(key);
}
expectTypeOf<Awaited<typeof modified>>().toEqualTypeOf<PathResult[]>();
expectTypeOf(stardog.paths().start(stardog.variable('s')).limit(1)).not.toHaveProperty('start');

// Query forms belong to their dialect's database only.
expectTypeOf(standard).not.toHaveProperty('json');
expectTypeOf(standard).not.toHaveProperty('paths');
expectTypeOf(arq).not.toHaveProperty('paths');
expectTypeOf(stardog).not.toHaveProperty('json');
expectTypeOf(stardog).not.toHaveProperty('constructQuads');

// Vendor databases keep every standard form.
expectTypeOf<Awaited<ReturnType<typeof arq.ask>>>().toEqualTypeOf<boolean>();
expectTypeOf<Awaited<ReturnType<typeof stardog.ask>>>().toEqualTypeOf<boolean>();
