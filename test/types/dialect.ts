import type * as AST from '@traqula/rules-sparql-1-1';
import { expectTypeOf } from 'vitest';
import {
  SparqlDatabase as ArqDatabase,
  arqDialect,
  lateral,
  letBinding,
} from '../../src/arq/index.js';
import { group, optional, SparqlDatabase, union } from '../../src/index.js';
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
// @ts-expect-error `$dynamic()` lifts clause restrictions, not dialect checks.
standard.select().$dynamic().where(letValue);

// The dialect changes what can be built, not what a query returns.
const arqQuery = arq.select({ value: variable }).where(letValue);
const standardQuery = standard.select({ value: variable }).where();
expectTypeOf<Awaited<typeof arqQuery>>().toEqualTypeOf<Awaited<typeof standardQuery>>();
expectTypeOf(standard.select().getSPARQL()).toEqualTypeOf<AST.QuerySelect>();
