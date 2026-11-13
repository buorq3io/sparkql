import { defineDialect } from '../database/dialect.js';
import { SparkqlError } from '../database/errors.js';
import { generateVirtuoso } from './generator.js';
import { checkTransitiveSubquery } from './transitive.js';
import type { VirtuosoAST, VirtuosoGroup, VirtuosoInput } from './types.js';

const subTypes: readonly string[] = [
  'virtuosoDefine',
  'virtuosoTextContains',
  'virtuosoTransitive',
];

/**
 * The OpenLink Virtuoso dialect: `DEFINE` pragmas ({@link define}), full-text matches
 * ({@link textContains}) and transitive subqueries ({@link transitive}).
 *
 * The `bif:` and `sql:` function helpers ({@link bif}, {@link bifCall}, {@link sqlCall}) print
 * as ordinary function calls and need no dialect support. `SparqlDatabase.create` from
 * `sparkql/virtuoso` applies it for you.
 */
export const virtuosoDialect = defineDialect<VirtuosoInput, VirtuosoAST>({
  patterns: {
    is: (value): value is VirtuosoInput =>
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      value.type === 'pattern' &&
      'subType' in value &&
      typeof value.subType === 'string' &&
      subTypes.includes(value.subType),
    normalize: (value, context): VirtuosoAST => {
      switch (value.subType) {
        case 'virtuosoDefine':
          return { ...value };
        case 'virtuosoTextContains':
          return { ...value, query: context.expression(value.query) };
        case 'virtuosoTransitive': {
          const subquery = context.pattern(value.subquery) as unknown as VirtuosoGroup;
          if (subquery.type !== 'pattern' || subquery.subType !== 'group') {
            throw new SparkqlError({
              message: 'A Virtuoso transitive pattern needs a subquery, as `.as()` returns.',
            });
          }
          checkTransitiveSubquery(subquery, value.options);
          return { ...value, subquery };
        }
      }
    },
  },
  generator: { generate: generateVirtuoso },
});
