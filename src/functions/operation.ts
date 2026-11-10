import type { MergePlaceholders, PlaceholderCarrier } from '../database/prepared.js';
import type { ExpressionInput, ExpressionOperationInput } from '../helpers/types.js';
import { transformBoolean, transformNumber } from '../structures/index.js';
import { createOperationExpression } from './utils.js';

/**
 * Tests whether two values are equal (`=`).
 *

 * SPARQL value equality can equate different RDF terms; use {@link sameTerm} for term identity.
 * Comparisons of incompatible values can raise an error, removing the solution in a `FILTER`.
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people aged 18.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(eq(v.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age = "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function eq<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function eq(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('=', args, transformBoolean);
}

/**
 * Tests whether two values are unequal (`!=`).
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people whose age is not 18.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(ne(v.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age != "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function ne<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function ne(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!=', args, transformBoolean);
}

/**
 * Tests whether one value is greater than another (`>`).
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people older than 18.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(gt(v.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age > "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function gt<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function gt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('>', args, transformBoolean);
}

/**
 * Tests whether one value is greater than or equal to another (`>=`).
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people aged at least 18.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(gte(v.age, 18))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age >= "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function gte<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function gte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('>=', args, transformBoolean);
}

/**
 * Tests whether one value is less than another (`<`).
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people younger than 65.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(lt(v.age, 65))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age < "65"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function lt<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function lt(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('<', args, transformBoolean);
}

/**
 * Tests whether one value is less than or equal to another (`<=`).
 *
 * @param args - `[left, right]`: The values to compare.
 *
 * @example
 * Find people aged at most 65.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(lte(v.age, 65))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ?age <= "65"^^<http://www.w3.org/2001/XMLSchema#integer> ) )
 * }
 * ```
 */
export function lte<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function lte(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<boolean> {
  return createOperationExpression('<=', args, transformBoolean);
}

/**
 * Combines conditions with logical AND (`&&`).
 *

 * Arguments are combined from left to right.
 *
 * @param args - Conditions to combine; at least two are required.
 *
 * @example
 * Find people aged 18 through 64.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(and(gte(v.age, 18), lt(v.age, 65)))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ( ?age >= "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) && ( ?age < "65"^^<http://www.w3.org/2001/XMLSchema#integer> ) ) )
 * }
 * ```
 */
export function and<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function and(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('&&', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

/**
 * Combines conditions with logical OR (`||`).
 *

 * Arguments are combined from left to right.
 *
 * @param args - Conditions to combine; at least two are required.
 *
 * @example
 * Find people younger than 18 or aged at least 65.
 *
 * ```ts
 * db.select({ age: v.age }).where(
 *   triples(v.person, n.foaf.age, v.age),
 *   filter(or(lt(v.age, 18), gte(v.age, 65)))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?age WHERE {
 *   ?person foaf:age ?age .
 *   FILTER ( ( ( ?age < "18"^^<http://www.w3.org/2001/XMLSchema#integer> ) || ( ?age >= "65"^^<http://www.w3.org/2001/XMLSchema#integer> ) ) )
 * }
 * ```
 */
export function or<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function or(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<boolean> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('||', [acc, current], transformBoolean),
    first
  ) as ExpressionOperationInput<boolean>;
}

/**
 * Adds numbers (`+`).
 *

 * Arguments are combined from left to right.
 *
 * @param args - Numeric expressions to add; at least two are required.
 *
 * @example
 * Add a fee to each book price.
 *
 * ```ts
 * db.select({ total: as(add(v.price, 5), v.total) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?price + "5"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?total ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function add<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function add(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('+', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

/**
 * Subtracts one number from another (`-`).
 *
 * @param args - `[left, right]`: The number to subtract from and the number to subtract.
 *
 * @example
 * Subtract a discount from each book price.
 *
 * ```ts
 * db.select({ discount: as(subs(v.price, 5), v.discount) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?price - "5"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?discount ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function subs<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function subs(
  ...args: [ExpressionInput, ExpressionInput]
): ExpressionOperationInput<number> {
  return createOperationExpression('-', args, transformNumber);
}

/**
 * Multiplies numbers (`*`).
 *

 * Arguments are combined from left to right.
 *
 * @param args - Numeric expressions to multiply; at least two are required.
 *
 * @example
 * Calculate each book price with a 20 percent increase.
 *
 * ```ts
 * db.select({ gross: as(mul(v.price, 1.2), v.gross) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?price * "1.2"^^<http://www.w3.org/2001/XMLSchema#decimal> ) AS ?gross ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function mul<A extends [ExpressionInput, ExpressionInput, ...ExpressionInput[]]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function mul(
  ...args: [ExpressionInput, ExpressionInput, ...ExpressionInput[]]
): ExpressionOperationInput<number> {
  const [first, ...rest] = args;

  return rest.reduce(
    (acc, current) => createOperationExpression('*', [acc, current], transformNumber),
    first
  ) as ExpressionOperationInput<number>;
}

/**
 * Divides one number by another (`/`).
 *
 * @param args - `[left, right]`: The dividend and divisor.
 *
 * @example
 * Calculate half of each book price.
 *
 * ```ts
 * db.select({ half: as(div(v.price, 2), v.half) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( ( ?price / "2"^^<http://www.w3.org/2001/XMLSchema#integer> ) AS ?half ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function div<A extends [ExpressionInput, ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function div(...args: [ExpressionInput, ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('/', args, transformNumber);
}

/**
 * Negates a condition (`!`).
 *
 * @param args - `[condition]`: The condition to negate.
 *
 * @example
 * Find people with no bound email variable.
 *
 * ```ts
 * db.select({ person: v.person }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   filter(not(bound(v.email)))
 * );
 * ```
 *
 * ```sparql
 * SELECT ?person WHERE {
 *   ?person foaf:name ?name .
 *   FILTER ( ! BOUND( ?email ) )
 * }
 * ```
 */
export function not<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<boolean> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function not(...args: [ExpressionInput]): ExpressionOperationInput<boolean> {
  return createOperationExpression('!', args, transformBoolean);
}

/**
 * Applies unary plus to a number (`+`).
 *
 * @param args - `[value]`: The numeric expression.
 *
 * @example
 * Apply unary plus to each book price.
 *
 * ```ts
 * db.select({ positive: as(uplus(v.price), v.positive) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( + ?price AS ?positive ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function uplus<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function uplus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uplus', args, transformNumber);
}

/**
 * Negates a number (`-`).
 *
 * @param args - `[value]`: The numeric expression to negate.
 *
 * @example
 * Negate each book price.
 *
 * ```ts
 * db.select({ negative: as(uminus(v.price), v.negative) })
 *   .where(triples(v.book, n.schema.price, v.price));
 * ```
 *
 * ```sparql
 * SELECT ( - ?price AS ?negative ) WHERE {
 *   ?book schema:price ?price .
 * }
 * ```
 */
export function uminus<A extends [ExpressionInput]>(
  ...args: A
): ExpressionOperationInput<number> & PlaceholderCarrier<MergePlaceholders<A[number]>>;
export function uminus(...args: [ExpressionInput]): ExpressionOperationInput<number> {
  return createOperationExpression('uminus', args, transformNumber);
}
