import { expectTypeOf } from 'vitest';
import { SparqlDatabase as ArqDatabase, type ConstructedQuad } from '../../src/arq/index.js';
import { SparqlDatabase, type SparqlQuad, triples } from '../../src/index.js';

const db = SparqlDatabase.create();
const [v] = db.createManagers([], {});
const pattern = triples(v.person, v.p, v.name);

// CONSTRUCT and DESCRIBE resolve to the RDF/JS quads the session returns.
const constructed = db.construct(pattern).where(pattern);
expectTypeOf<Awaited<typeof constructed>>().toEqualTypeOf<SparqlQuad[]>();
const described = db.describe(v.person).where(pattern);
expectTypeOf<Awaited<typeof described>>().toEqualTypeOf<SparqlQuad[]>();
expectTypeOf<Awaited<ReturnType<typeof db.describe>>>().toEqualTypeOf<SparqlQuad[]>();

// A quad exposes RDF/JS term fields.
type Quad = Awaited<typeof constructed>[number];
expectTypeOf<Quad['subject']['value']>().toEqualTypeOf<string>();

// ARQ's quad CONSTRUCT returns the same quad type.
const arq = ArqDatabase.create();
const arqConstructed = arq.construct(pattern).where(pattern);
expectTypeOf<Awaited<typeof arqConstructed>>().toEqualTypeOf<ConstructedQuad[]>();
