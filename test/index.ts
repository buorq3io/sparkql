import { prefixes } from '#test/prefixes.js';
import { SparqlDatabase } from '#src/index.js';
import * as AST from '@traqula/rules-sparql-1-1';
import * as PARSE from '@traqula/parser-sparql-1-1';

export const blankNodePrefix = 'g_';
export const db = SparqlDatabase.create({
  managerConfig: prefixes,
  endpointUrl: process.env.DATABASE_URL,
});
export const [v, n, b] = db.createManagers([], prefixes);

export const factory = new AST.AstFactory();
const termBlankOriginal = factory.termBlank.bind(factory);
factory.termBlank = (label: string | undefined, loc: unknown) => {
  const result = termBlankOriginal(label, loc as any);
  // todo: raise error if the testing queries include blank term with reserved prefixes
  if (label && (label.startsWith('g_') || label.startsWith('e_'))) {
    result.label = result.label.substring(2)
  }
  return result
};

export const parser = new PARSE.Parser({
  defaultContext: {
    astFactory: factory,
  },
});
