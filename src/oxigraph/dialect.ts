import { defineDialect } from '../database/dialect.js';
import type { PatternInput } from '../helpers/types.js';
import { generateOxigraph } from './generator.js';
import type { LateralInput, OxigraphAST, OxigraphInput, OxigraphPattern } from './types.js';

export * from './types.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;

/**
 * The Oxigraph dialect: standard SPARQL 1.1 plus the `LATERAL` pattern ({@link lateral}).
 *
 * The {@link adjust} function prints as an ordinary function call and needs no dialect support.
 * `SparqlDatabase.create` from `sparkql/oxigraph` applies it for you.
 */
export const oxigraphDialect = defineDialect<OxigraphInput, OxigraphAST>({
  patterns: {
    is: (value): value is OxigraphInput =>
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'pattern' &&
      'subType' in value &&
      value.subType === 'lateral',
    normalize: (value, context) => ({
      ...value,
      patterns: value.patterns.map(pattern => context.pattern(pattern)) as OxigraphPattern[],
    }),
  },
  generator: { generate: generateOxigraph },
});

/**
 * Adds a `LATERAL` group, which Oxigraph evaluates once for each solution of the patterns
 * before it.
 *
 * Variables bound earlier in the group are visible inside the lateral group, so a subquery in
 * it can use them, for example to take one name per person with `LIMIT 1`. This is SPARQL 1.2
 * proposal SEP-0006. Only databases created from `sparkql/oxigraph` (or `sparkql/arq`) accept
 * it.
 *
 * @param patterns - Graph patterns, subqueries included, to join into the lateral group.
 *
 * @example
 * Take one name for each person who knows someone.
 *
 * ```ts
 * import { SparqlDatabase, lateral, triples } from 'sparkql/oxigraph';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const oneName = db
 *   .select({ person: v.person, name: v.name })
 *   .where(triples(v.person, n.foaf.name, v.name))
 *   .limit(1)
 *   .as();
 * const people = db
 *   .select({ person: v.person, name: v.name })
 *   .where(triples(v.person, n.foaf.knows, v.friend), lateral(oneName));
 * ```
 *
 * ```sparql
 * SELECT ?person ?name WHERE {
 *   ?person foaf:knows ?friend .
 *   LATERAL {
 *     {
 *       SELECT ?person ?name WHERE {
 *         ?person foaf:name ?name .
 *       }
 *       LIMIT 1
 *     }
 *   }
 * }
 * ```
 */
export function lateral(...patterns: PatternInput<OxigraphInput>[]): LateralInput {
  return { type: 'pattern', subType: 'lateral', loc, patterns };
}
