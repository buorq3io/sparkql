import { anyOf, oneOf } from "./generators.js";
import { termBlank, termIri, termLiteral, termVariable } from "./utilities.js";


export const acceptsGraphNodeInput = anyOf(
  termIri.accepts,
  termBlank.accepts,
  termLiteral.accepts,
);

export const acceptsTermExpressionInput = anyOf(
  termVariable.accepts,
  termIri.accepts,
  termLiteral.accepts,
);

export const parseOrThrowTermExpressionInput = oneOf(
  termVariable.parseOrThrow,
  termIri.parseOrThrow,
  termLiteral.parseOrThrow,
);
