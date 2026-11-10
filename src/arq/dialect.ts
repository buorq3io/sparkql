import * as AST from '@traqula/rules-sparql-1-1';
import { defineDialect } from '../database/dialect.js';
import type { ExpressionInput, PatternInput } from '../helpers/types.js';
import { arqGenerator } from './generator.js';
import { arqQueries } from './queries.js';
import type { ArqAST, ArqInput, ArqPattern, LateralInput, LetInput } from './types.js';

export * from './types.js';

const loc = { sourceLocationType: 'autoGenerate' } as const;
/**
 * The Apache Jena ARQ dialect: the `LET` and `LATERAL` patterns plus the `db.json()` and
 * `db.constructQuads()` methods.
 *
 * `SparqlDatabase.create` from `sparkql/arq` applies it for you.
 */
export const arqDialect = defineDialect<ArqInput, ArqAST, typeof arqQueries>({
  queries: arqQueries,
  patterns: {
    is: (value): value is ArqInput =>
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'pattern' &&
      'subType' in value &&
      (value.subType === 'let' || value.subType === 'lateral'),
    normalize: (value, context) =>
      value.subType === 'let'
        ? { ...value, expression: context.expression(value.expression) }
        : {
            ...value,
            patterns: value.patterns.map(pattern =>
              context.pattern(pattern)
            ) as unknown as ArqPattern[],
          },
  },
  generator: {
    generate: query => arqGenerator.queryOrUpdate(query, AST.completeGeneratorContext({})).trim(),
  },
});

/**
 * Assigns the value of an expression to a variable with an ARQ `LET` pattern.
 *
 * Generates `LET (?variable := expression)` in the enclosing group. It is ARQ's counterpart to
 * {@link bind} and takes its arguments in the same order. Only databases created from
 * `sparkql/arq` accept it; the standard dialect rejects it when the query is generated.
 *
 * @param expression - Expression whose value is assigned.
 * @param variable - Variable that receives the value.
 *
 * @example
 * Return each person's name together with its length.
 *
 * ```ts
 * import { SparqlDatabase, letBinding, strlen, triples } from 'sparkql/arq';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const names = db
 *   .select({ name: v.name, length: v.length })
 *   .where(triples(v.person, n.foaf.name, v.name), letBinding(strlen(v.name), v.length));
 * ```
 *
 * ```sparql
 * SELECT ?name ?length WHERE {
 *   ?person foaf:name ?name .
 *   LET (?length := STRLEN( ?name ) )
 * }
 * ```
 */
export function letBinding(expression: ExpressionInput, variable: AST.TermVariable): LetInput {
  return { type: 'pattern', subType: 'let', loc, variable, expression };
}

/**
 * Adds an ARQ `LATERAL` group, which is evaluated once for each solution of the patterns
 * before it.
 *
 * Variables bound earlier in the group are visible inside the lateral group, so a subquery in
 * it can use them, for example to take one name per person with `LIMIT 1`. Only databases
 * created from `sparkql/arq` accept it.
 *
 * @param patterns - Graph patterns, subqueries included, to join into the lateral group.
 *
 * @example
 * Take one name for each person who knows someone.
 *
 * ```ts
 * import { SparqlDatabase, lateral, triples } from 'sparkql/arq';
 *
 * const prefixes = { foaf: { uri: 'http://xmlns.com/foaf/0.1/', fields: [] } };
 * const db = SparqlDatabase.create({ managerConfig: prefixes });
 * const [v, n] = db.createManagers([], prefixes);
 *
 * const oneName = db
 *   .select({ name: v.name })
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
 *       SELECT ?name WHERE {
 *         ?person foaf:name ?name .
 *       }
 *       LIMIT 1
 *     }
 *   }
 * }
 * ```
 */
export function lateral(...patterns: PatternInput<ArqInput>[]): LateralInput {
  return { type: 'pattern', subType: 'lateral', loc, patterns };
}
