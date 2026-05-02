import {
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
  TermIriInput,
  TermVariableInput,
  ValuePatternColumnsInput,
  Presence
} from '../helpers/types.js';

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

export function optional(...patterns: PatternInput[]): PatternOptionalInput {
  return {
    type: 'pattern',
    subType: 'optional',
    loc: {
      sourceLocationType: 'autoGenerate',
    },
    patterns: patterns,
  };
}

export function union(...patterns: PatternGroupInput[]): PatternUnionInput {
  return {
    type: 'pattern',
    subType: 'union',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function group(...patterns: PatternInput[]): PatternGroupInput {
  return {
    type: 'pattern',
    subType: 'group',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

export function graph(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput[]
): PatternGraphInput {
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

export function minus(...patterns: PatternInput[]): PatternMinusInput {
  return {
    type: 'pattern',
    subType: 'minus',
    patterns: patterns,
    loc: {
      sourceLocationType: 'autoGenerate',
    },
  };
}

function serviceBase(
  name: TermIriInput | TermVariableInput,
  silent: boolean,
  ...patterns: PatternInput[]
): PatternServiceInput {
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

export function service(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput[]
): PatternServiceInput {
  return serviceBase(name, false, ...patterns);
}

export function serviceSilent(
  name: TermIriInput | TermVariableInput,
  ...patterns: PatternInput[]
): PatternServiceInput {
  return serviceBase(name, true, ...patterns);
}

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
