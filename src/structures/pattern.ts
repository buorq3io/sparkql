import {
  IriTerm,
  VariableTerm,
  Triple,
  Pattern,
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
  ValuePatternRow,
} from '../generic';

export function bgp(...triples: Triple[]): BgpPattern {
  return {
    type: 'bgp',
    triples: triples,
  };
}

export function optional(...patterns: Pattern[]): OptionalPattern {
  return {
    type: 'optional',
    patterns: patterns,
  };
}

export function union(...patterns: Pattern[]): UnionPattern {
  return {
    type: 'union',
    patterns: patterns,
  };
}

export function group(...patterns: Pattern[]): GroupPattern {
  return {
    type: 'group',
    patterns: patterns,
  };
}

export function graph(name: IriTerm | VariableTerm, ...patterns: Pattern[]): GraphPattern {
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

export function minus(...patterns: Pattern[]): MinusPattern {
  return {
    type: 'minus',
    patterns: patterns,
  };
}

function serviceBase(
  name: IriTerm | VariableTerm,
  silent: boolean,
  ...patterns: Pattern[]
): ServicePattern {
  return {
    type: 'service',
    name: name,
    silent: silent,
    patterns: patterns,
  };
}

export function service(name: IriTerm | VariableTerm, ...patterns: Pattern[]): ServicePattern {
  return serviceBase(name, false, ...patterns);
}

export function serviceSilent(
  name: IriTerm | VariableTerm,
  ...patterns: Pattern[]
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

export function values(...values: ValuePatternRow[]): ValuesPattern {
  return {
    type: 'values',
    values: values,
  };
}
