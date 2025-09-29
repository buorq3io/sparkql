import {
  IriTerm,
  VariableTerm,
  Triple,
  Expression,
  GraphQuads,
  BgpPattern,
  BindPattern,
  UnionPattern,
  GroupPattern,
  GraphPattern,
  MinusPattern,
  FilterPattern,
  ValuesPattern,
  ServicePattern,
  OptionalPattern,
  ValuePatternColumns,
  PatternWithSelectQuery,
} from '../generic.js';

export function bgp(...triples: Triple[]): BgpPattern {
  return {
    type: 'bgp',
    triples: triples,
  };
}

export function optional(...patterns: PatternWithSelectQuery[]): OptionalPattern {
  return {
    type: 'optional',
    patterns: patterns,
  };
}

export function union(...patterns: PatternWithSelectQuery[]): UnionPattern {
  return {
    type: 'union',
    patterns: patterns,
  };
}

export function group(...patterns: PatternWithSelectQuery[]): GroupPattern {
  return {
    type: 'group',
    patterns: patterns,
  };
}

export function graph(
  name: IriTerm | VariableTerm,
  ...patterns: PatternWithSelectQuery[]
): GraphPattern {
  return {
    type: 'graph',
    name: name,
    patterns: patterns,
  };
}

export function quadgraph(name: IriTerm | VariableTerm, ...triples: Triple[]): GraphQuads {
  return {
    type: 'graph',
    name: name,
    triples: triples,
  };
}

export function minus(...patterns: PatternWithSelectQuery[]): MinusPattern {
  return {
    type: 'minus',
    patterns: patterns,
  };
}

function serviceBase(
  name: IriTerm | VariableTerm,
  silent: boolean,
  ...patterns: PatternWithSelectQuery[]
): ServicePattern {
  return {
    type: 'service',
    name: name,
    silent: silent,
    patterns: patterns,
  };
}

export function service(
  name: IriTerm | VariableTerm,
  ...patterns: PatternWithSelectQuery[]
): ServicePattern {
  return serviceBase(name, false, ...patterns);
}

export function serviceSilent(
  name: IriTerm | VariableTerm,
  ...patterns: PatternWithSelectQuery[]
): ServicePattern {
  return serviceBase(name, true, ...patterns);
}

export function filter(expression: Expression): FilterPattern {
  return {
    type: 'filter',
    expression: expression,
  };
}

export function bind(expression: Expression, variable: VariableTerm): BindPattern {
  return {
    type: 'bind',
    expression: expression,
    variable: variable,
  };
}

export function values(values: ValuePatternColumns): ValuesPattern {
  return {
    type: 'values',
    values: values,
  };
}
