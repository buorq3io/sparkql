import type { MergePlaceholders, PlaceholderCarrier } from '../database/prepared.js';
import type { TermCodec } from '../helpers/codecs.js';
import {
  type DefaultQueryReturnType,
  type ExpressionInput,
  type GraphQuadsInput,
  type ObjectColletion,
  type ObjectInput,
  type PatternBgpInput,
  type PatternBindInput,
  type PredicateInput,
  type PredicatePairCollection,
  Presence,
  type QueryReturnType,
  type SubjectInput,
  type TermBlankOutput,
  type TermIriInput,
  type TermIriOutput,
  type TermLiteralOutput,
  type TermVariableAndBinding,
  type TermVariableInput,
  type TermVariableTransform,
  type TripleCollectionBlankNodePropertiesInput,
  type TripleCollectionListInput,
  type TripleNestingInput,
} from '../helpers/types.js';
import { isObjectLike, tripleCollectionInput } from '../helpers/utilities.js';
import { bgp, bind } from './pattern.js';

const autoLoc = { sourceLocationType: 'autoGenerate' as const };

/**
 * Creates a triple for a basic graph pattern.
 *
 * @param subject - Triple subject.
 * @param predicate - Triple predicate.
 * @param object - Triple object.
 *
 * @example
 * Represent a person’s name as a nested triple.
 *
 * ```ts
 * const input = tripleNesting(v.person, n.foaf.name, v.name);
 * ```
 */
export function tripleNesting<
  S extends SubjectInput,
  P extends PredicateInput,
  O extends ObjectInput,
>(
  subject: S,
  predicate: P,
  object: O
): TripleNestingInput<S, P, O> & PlaceholderCarrier<MergePlaceholders<S | P | O>> {
  return {
    type: 'triple',
    loc: autoLoc,
    subject: subject,
    predicate: predicate,
    object: object,
  } as TripleNestingInput<S, P, O> & PlaceholderCarrier<MergePlaceholders<S | P | O>>;
}

/**
 * Creates an object collection for a triple shortcut.
 *
 * @param obj - Objects sharing a subject and predicate.
 *
 * @example
 * Require a person to have both a bound name and the name "Ada" (one triple per object).
 *
 * ```ts
 * const input = triples(v.person, n.foaf.name, objects(v.name, "Ada"));
 * ```
 */
export function objects<const O extends ObjectInput[]>(
  ...obj: O
): ObjectColletion & PlaceholderCarrier<MergePlaceholders<O[number]>> {
  return {
    type: 'syntacticShortcut',
    subType: 'objectCollection',
    values: obj,
  } as ObjectColletion & PlaceholderCarrier<MergePlaceholders<O[number]>>;
}

/**
 * Creates predicate and object pairs for a triple shortcut.
 *
 * @param obj - Predicate and object pairs sharing a subject.
 *
 * @example
 * Group a person’s name and age under one subject.
 *
 * ```ts
 * const input = predicates([n.foaf.name, v.name], [n.foaf.age, v.age]);
 * ```
 */
export function predicates<const P extends [PredicateInput, ObjectInput | ObjectColletion][]>(
  ...obj: P
): PredicatePairCollection & PlaceholderCarrier<MergePlaceholders<P[number][number]>> {
  return {
    type: 'syntacticShortcut',
    subType: 'predicatePairCollection',
    values: obj,
  } as PredicatePairCollection & PlaceholderCarrier<MergePlaceholders<P[number][number]>>;
}

/**
 * Creates a basic graph pattern from triple inputs.
 *
 * @param args - A triple collection or a subject with predicates and objects.
 *
 * @example
 * Match a person’s name in a basic graph pattern.
 *
 * ```ts
 * const input = triples(v.person, n.foaf.name, v.name);
 * ```
 */
export function triples<
  const Args extends
    | [TripleCollectionListInput]
    | [TripleCollectionBlankNodePropertiesInput]
    | [SubjectInput, PredicatePairCollection]
    | [SubjectInput, PredicateInput, ObjectColletion | ObjectInput],
>(...args: Args): PatternBgpInput & PlaceholderCarrier<MergePlaceholders<Args[number]>>;

export function triples(
  subject: SubjectInput,
  predicate?: PredicatePairCollection | PredicateInput,
  object?: ObjectColletion | ObjectInput
): PatternBgpInput {
  if (tripleCollectionInput.accepts(subject) && predicate === undefined && object === undefined) {
    return bgp(subject);
  }

  if (
    isObjectLike(predicate) &&
    predicate.subType === 'predicatePairCollection' &&
    object === undefined
  ) {
    const items = predicate.values.flatMap(v => {
      if (isObjectLike(v[1]) && v[1].subType === 'objectCollection') {
        return v[1].values.map(o => {
          return tripleNesting(subject, v[0], o);
        });
      }
      return tripleNesting(subject, v[0], v[1]);
    });
    return bgp(...items);
  }

  if (isObjectLike(object) && object.subType === 'objectCollection') {
    const items = object.values.map(o => {
      return tripleNesting(subject, predicate as any, o); // fix
    });
    return bgp(...items);
  }

  return bgp(tripleNesting(subject, predicate as any, object as any)); // fix
}

/**
 * Creates graph quads from basic graph patterns.
 *
 * @param graph - Graph IRI or variable.
 * @param patterns - Basic graph patterns in the graph.
 *
 * @example
 * Place person-name triples in the schema person graph.
 *
 * ```ts
 * const input = quads(n.schema.Person, triples(v.person, n.foaf.name, v.name));
 * ```
 */
export function quads(
  graph: TermIriInput | TermVariableInput,
  ...patterns: PatternBgpInput[]
): GraphQuadsInput {
  return {
    type: 'graph',
    graph: graph,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: bgp(...patterns.flatMap(p => p.triples)),
  };
}

/**
 * Converts a result term to an RDF named node.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Use an RDF named node for a homepage.
 *
 * ```ts
 * const homepage = createCast(transformIri)(v.homepage);
 * ```
 */
export function transformIri(self: DefaultQueryReturnType): TermIriOutput {
  if (self.termType === 'NamedNode') return self;
  return { termType: 'NamedNode', value: self.value, equals: self.equals };
}

/**
 * Converts a result term to an RDF literal.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Keep a name as an RDF literal.
 *
 * ```ts
 * const name = createCast(transformLiteral)(v.name);
 * ```
 */
export function transformLiteral(self: DefaultQueryReturnType): TermLiteralOutput {
  if (self.termType === 'Literal') return self;

  return {
    ...self,
    direction: '',
    language: '',
    termType: 'Literal',
    equals: self.equals,
    datatype: {
      termType: 'NamedNode',
      value: 'http://www.w3.org/2001/XMLSchema#string',
      equals: self.equals,
    },
  };
}

/**
 * Converts a result term to an RDF blank node.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Treat a person identifier as an RDF blank node.
 *
 * ```ts
 * const person = createCast(transformBlank)(v.person);
 * ```
 */
export function transformBlank(self: DefaultQueryReturnType): TermBlankOutput {
  if (self.termType === 'BlankNode') return self;
  return { termType: 'BlankNode', value: self.value, equals: self.equals };
}

/**
 * Converts a result term to its string value.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Decode a name as a string.
 *
 * ```ts
 * const name = createCast(transformString)(v.name);
 * ```
 */
export const transformString = (self => self.value) satisfies TermVariableTransform;

/**
 * Formats a result term as `'value'@language` when it is a language-tagged literal.
 *
 * Only a literal with a non-empty language tag gets the `@language` suffix. A literal without
 * one (an untagged string or any other datatype), an IRI and a blank node return their plain
 * value, matching the `rdf:langString` codec, which treats an empty language as untagged.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Preserve a name’s language tag in its string value.
 *
 * ```ts
 * const name = createCast(transformLangstring)(v.name);
 * ```
 */
export const transformLangstring = (self =>
  self.termType === 'Literal' && self.language !== ''
    ? `'${self.value}'@${self.language}`
    : self.value) satisfies TermVariableTransform;

/**
 * Converts a result term to a bigint.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Decode an age as a bigint.
 *
 * ```ts
 * const age = createCast(transformBigint)(v.age);
 * ```
 */
export const transformBigint = (self => BigInt(self.value)) satisfies TermVariableTransform;

/**
 * Converts a result term to a number using `parseFloat`.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Parse an age as a number.
 *
 * ```ts
 * const age = createCast(transformNumber)(v.age);
 * ```
 */
export const transformNumber = (self => parseFloat(self.value)) satisfies TermVariableTransform;

/**
 * Converts a result term to a boolean by comparing its lowercased value to `true`.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Decode an active flag as a boolean.
 *
 * ```ts
 * const active = createCast(transformBoolean)(v.active);
 * ```
 */
export const transformBoolean = (self =>
  self.value.toLowerCase() === 'true') satisfies TermVariableTransform;

/**
 * Converts a result term to an array split on a separator.
 *
 * An empty separator cannot be split on, so the whole value becomes the only element.
 *
 * @param self - Result term to convert.
 * @param separator - Separator used to split the value; defaults to the unit separator.
 *
 * @example
 * Split a collection of names into strings.
 *
 * ```ts
 * const names = createCast(transformArray)(v.names);
 * ```
 */
export const transformArray = ((self, separator: string = '\u001f') =>
  separator === '' ? [self.value] : self.value.split(separator)) satisfies TermVariableTransform;

/**
 * Converts a result term to a JavaScript date.
 *
 * @param self - Result term to convert.
 *
 * @example
 * Decode a publication date as a JavaScript date.
 *
 * ```ts
 * const published = createCast(transformDate)(v.published);
 * ```
 */
export const transformDate = (self => new Date(self.value)) satisfies TermVariableTransform;

/**
 * Decodes a selected variable or binding as an RDF named node.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Use an RDF named node for a homepage.
 *
 * ```ts
 * const homepage = castIri(v.homepage); // Selected rows: { homepage: TermIriOutput }[]
 * ```
 */
export const castIri = createCast(transformIri);
/**
 * Decodes a selected variable or binding as an RDF literal.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Keep a name as an RDF literal.
 *
 * ```ts
 * const name = castLiteral(v.name); // Selected rows: { name: TermLiteralOutput }[]
 * ```
 */
export const castLiteral = createCast(transformLiteral);
/**
 * Decodes a selected variable or binding as an RDF blank node.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Treat a person identifier as an RDF blank node.
 *
 * ```ts
 * const person = castBlank(v.person); // Selected rows: { person: TermBlankOutput }[]
 * ```
 */
export const castBlank = createCast(transformBlank);
/**
 * Decodes a selected variable or binding as its string value.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Decode a name as a string.
 *
 * ```ts
 * const name = castString(v.name); // Selected rows: { name: string }[]
 * ```
 */
export const castString = createCast(transformString);
/**
 * Decodes a selected variable or binding as `'value'@language` (see {@link transformLangstring}).
 *
 * A value without a language tag decodes to its plain value, such as `Ada`.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Preserve a name’s language tag in its string value.
 *
 * ```ts
 * const name = castLangstring(v.name); // Selected rows: { name: string }[]
 * ```
 */
export const castLangstring = createCast(transformLangstring);
/**
 * Decodes a selected variable or binding as a boolean by comparing its lowercased value to `true`.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Decode an active flag as a boolean.
 *
 * ```ts
 * const active = castBoolean(v.active); // Selected rows: { active: boolean }[]
 * ```
 */
export const castBoolean = createCast(transformBoolean);
/**
 * Decodes a selected variable or binding as a number using `parseFloat`.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Parse an age as a number.
 *
 * ```ts
 * const age = castNumber(v.age); // Selected rows: { age: number }[]
 * ```
 */
export const castNumber = createCast(transformNumber);
/**
 * Decodes a selected variable or binding as a bigint.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Decode an age as a bigint.
 *
 * ```ts
 * const age = castBigint(v.age); // Selected rows: { age: bigint }[]
 * ```
 */
export const castBigint = createCast(transformBigint);
/**
 * Decodes a selected variable or binding as an array split on a separator.
 *
 * The transform applies to results and does not change the generated SPARQL. An empty
 * separator cannot be split on, so the whole value becomes the only element.
 *
 * @param variable - Variable or binding to decode.
 * @param other - Separator used to split the value.
 *
 * @example
 * Split a collection of names into strings.
 *
 * ```ts
 * const names = castArray(v.names); // Selected rows: { names: string[] }[]
 * ```
 */
export const castArray = createCast(transformArray);
/**
 * Decodes a selected variable or binding as a JavaScript date.
 *
 * The transform applies to results and does not change the generated SPARQL.
 *
 * @param variable - Variable or binding to decode.
 *
 * @example
 * Decode a publication date as a JavaScript date.
 *
 * ```ts
 * const published = castDate(v.published); // Selected rows: { published: Date }[]
 * ```
 */
export const castDate = createCast(transformDate);

/**
 * Binds an expression to a variable for use in a projection or pattern.
 *
 * @param expression - Expression to bind.
 * @param variableTerm - Target variable.
 *
 * @example
 * Project the length of each person’s name.
 *
 * ```ts
 * db.select({ length: as(strlen(v.name), v.length) })
 *   .where(triples(v.person, n.foaf.name, v.name));
 * ```
 *
 * ```sparql
 * SELECT ( STRLEN( ?name ) AS ?length ) WHERE {
 *   ?person foaf:name ?name .
 * }
 * ```
 */
export function as<R1 extends QueryReturnType>(
  expression: ExpressionInput<R1>,
  variableTerm: TermVariableInput<any, Presence>
): PatternBindInput<R1> {
  const newTerm = { ...variableTerm } as TermVariableInput<R1>;
  if (typeof expression === 'object' && 'transform' in expression) {
    newTerm.transform = expression.transform;
  }
  return bind(expression, newTerm);
}

/**
 * Applies a result transform to a variable or binding.
 *
 * A variable is copied with the transform set. For a binding (`as(...)`), the transform is
 * set only when its expression has a `transform` property, and otherwise silently dropped;
 * it is written onto the binding's existing expression and variable objects, so the
 * original binding changes too.
 *
 * @param variable - Variable or binding to transform.
 * @param transform - Function that converts a result term.
 *
 * @example
 * Decode an age as a number.
 *
 * ```ts
 * const age = applyTransform(v.age, transformNumber);
 * ```
 */
export function applyTransform<R1, R2 extends QueryReturnType, P extends Presence>(
  variable: TermVariableAndBinding<R1, P>,
  transform: TermVariableTransform<R2>
): TermVariableAndBinding<R2, P> {
  const newTerm = { ...variable } as TermVariableAndBinding<R2, P>;
  if (newTerm.type === 'pattern') {
    if (typeof newTerm.expression === 'object' && 'transform' in newTerm.expression) {
      newTerm.expression.transform = transform;
      newTerm.variable.transform = transform;
    }
  } else {
    newTerm.transform = transform;
  }
  return newTerm;
}

/**
 * Creates a function that applies a result transform to a variable or binding.
 *
 * @param transform - Function that converts a result term.
 *
 * @example
 * Create a cast for numeric values.
 *
 * ```ts
 * const numberCast = createCast(transformNumber);
 * const age = numberCast(v.age);
 * ```
 */
export function createCast<R1 extends QueryReturnType, O extends any[] = []>(
  transform: TermVariableTransform<R1, O>
) {
  return <R2, P extends Presence>(variable: TermVariableAndBinding<R2, P>, ...other: O) =>
    applyTransform(variable, self => transform(self, ...other));
}

/**
 * Decodes a selected variable or binding with a codec.
 *
 * The decoder takes precedence over the database's codec table. A codec without a
 * decoder throws an error when the cast is created.
 *
 * @param codec - Codec supplying the decoder.
 * @param variable - Variable or binding to decode.
 * @throws When the codec has no decoder.
 *
 * @example
 * Decode an age with a custom codec.
 *
 * ```ts
 * const age = castWith({ decode: transformNumber }, v.age);
 * ```
 */
export function castWith<O, R2, P extends Presence>(
  codec: TermCodec<O, any>,
  variable: TermVariableAndBinding<R2, P>
): TermVariableAndBinding<O, P> {
  const decode = codec.decode;
  if (!decode) throw new Error('castWith needs a codec with a decoder.');
  return applyTransform(variable, self => decode(self));
}

/**
 * Marks a selected variable or binding as required.
 *
 * This updates the supplied variable or binding in place.
 *
 * @param variable - Variable or binding to mark required.
 *
 * @example
 * Require a selected name in the result type.
 *
 * ```ts
 * const input = always(v.name);
 * ```
 */
export function always<T>(
  variable: TermVariableAndBinding<T, Presence>
): TermVariableAndBinding<T> {
  if (variable.type === 'pattern') {
    variable.variable.presence = Presence.required;
  } else {
    variable.presence = Presence.required;
  }
  return variable as TermVariableAndBinding<T>;
}

/**
 * Marks a selected variable or binding as potentially unbound.
 *
 * The selected value is typed as `T | undefined`. Use this for variables bound
 * only inside {@link optional}; `optional(...)` alone does not change the result type.
 * This updates the supplied variable or binding in place.
 *
 * @param variable - Variable or binding to mark optional.
 *
 * @example
 * Select names and ages that may be missing.
 *
 * ```ts
 * db.select({ name: castString(v.name), age: maybe(castNumber(v.age)) }).where(
 *   triples(v.person, n.foaf.name, v.name),
 *   optional(triples(v.person, n.foaf.age, v.age))
 * ); // { name: string; age: number | undefined }[]
 * ```
 *
 * ```sparql
 * SELECT ?name ?age WHERE {
 *   ?person foaf:name ?name .
 *   OPTIONAL {
 *     ?person foaf:age ?age .
 *   }
 * }
 * ```
 */
export function maybe<T>(
  variable: TermVariableAndBinding<T, Presence>
): TermVariableAndBinding<T, Presence.optional> {
  const resultVariable: TermVariableAndBinding<T, Presence.optional> = variable as any;
  if (resultVariable.type === 'pattern') {
    resultVariable.variable.presence = Presence.optional;
  } else {
    resultVariable.presence = Presence.optional;
  }
  return resultVariable;
}
