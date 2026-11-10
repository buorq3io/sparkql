import type { ExtensionPattern } from '../database/dialect.js';
import type {
  MergePlaceholders,
  PlaceholderCarrier,
  PlaceholderValues,
} from '../database/prepared.js';
import type {
  BasicGraphPatternInput,
  ExpressionInput,
  PatternBgpInput,
  PatternBindInput,
  PatternFilterInput,
  PatternGraphInput,
  PatternGroupInput,
  PatternInput,
  PatternMinusInput,
  PatternOptionalInput,
  PatternServiceInput,
  PatternUnionInput,
  PatternValuesInput,
  Presence,
  TermIriInput,
  TermVariableInput,
  ValuePatternColumnsInput,
} from '../helpers/types.js';

export function bgp<const T extends BasicGraphPatternInput>(
  ...triples: T
): PatternBgpInput & PlaceholderCarrier<MergePlaceholders<T[number]>>;
export function bgp(...triples: BasicGraphPatternInput): PatternBgpInput {
  return {
    type: 'pattern',
    subType: 'bgp',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    triples: triples,
  };
}

export function optional<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternOptionalInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
export function optional<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternOptionalInput<P>;

export function optional<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternOptionalInput<P> {
  return {
    type: 'pattern',
    subType: 'optional',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    patterns: patterns,
  };
}

export function union<const Inputs extends PatternGroupInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternUnionInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
export function union<P extends ExtensionPattern = never>(
  ...patterns: PatternGroupInput<P>[]
): PatternUnionInput<P>;

export function union<P extends ExtensionPattern = never>(
  ...patterns: PatternGroupInput<P>[]
): PatternUnionInput<P> {
  return {
    type: 'pattern',
    subType: 'union',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function group<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternGroupInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
export function group<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternGroupInput<P>;

export function group<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternGroupInput<P> {
  return {
    type: 'pattern',
    subType: 'group',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function graph<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternGraphInput<P> {
  return {
    type: 'pattern',
    subType: 'graph',
    name: name,
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function minus<const Inputs extends PatternInput<any>[]>(
  ...patterns: Inputs
): Omit<PatternMinusInput<never>, 'patterns'> & { patterns: Inputs } & PlaceholderCarrier<
    MergePlaceholders<Inputs[number]>
  >;
export function minus<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternMinusInput<P>;

export function minus<P extends ExtensionPattern = never>(
  ...patterns: PatternInput<P>[]
): PatternMinusInput<P> {
  return {
    type: 'pattern',
    subType: 'minus',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

function serviceBase<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  silent: boolean,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return {
    type: 'pattern',
    subType: 'service',
    name: name,
    silent: silent,
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function service<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return serviceBase(name, false, ...patterns);
}

export function serviceSilent<P extends ExtensionPattern = never>(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput<P>[]
): PatternServiceInput<P> {
  return serviceBase(name, true, ...patterns);
}

export function filter<E extends ExpressionInput>(
  expression: E
): PatternFilterInput & PlaceholderCarrier<PlaceholderValues<E>>;
export function filter(expression: ExpressionInput): PatternFilterInput {
  return {
    type: 'pattern',
    subType: 'filter',
    expression: expression,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function bind<T, K extends Presence>(
  expression: ExpressionInput<T>,
  variable: TermVariableInput<any, K>
): PatternBindInput<T, K> {
  return {
    type: 'pattern',
    subType: 'bind',
    expression: expression,
    variable: variable,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function values(values: ValuePatternColumnsInput): PatternValuesInput {
  return {
    type: 'pattern',
    subType: 'values',
    variables: Object.keys(values).map(v => ({
      type: 'term',
      subType: 'variable',
      value: v,
      loc: {
        sourceLocationType: 'autoGenerate',
      },
    })),
    values: values,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}
