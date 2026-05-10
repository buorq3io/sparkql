import * as AST from '@traqula/rules-sparql-1-1';

export function canonicalizeQuery(query: AST.SparqlQuery, blankNodePrefix: string): any {
  const newQuery = JSON.parse(JSON.stringify(query));

  const prefixMap = new Map<string, string>();
  const bnodeMap = new Map<string, string>();
  let bnodeCounter = 0;

  function traverse(node: unknown) {
    if (typeof node !== 'object' || node === null) {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        traverse(item);
      }
      return;
    }

    const n = node as Record<string, unknown>;

    // Collect prefix definitions
    if (
      n.type === 'contextDef' &&
      n.subType === 'prefix' &&
      typeof n.key === 'string' &&
      typeof (n.value as Record<string, unknown>)?.value === 'string'
    ) {
      prefixMap.set(n.key, (n.value as Record<string, unknown>).value as string);
    }

    // Canonicalize blank nodes that use the test prefix
    if (
      n.type === 'term' &&
      n.subType === 'blankNode' &&
      typeof n.label === 'string' &&
      n.label.startsWith(blankNodePrefix)
    ) {
      if (!bnodeMap.has(n.label)) {
        bnodeMap.set(n.label, `g_${bnodeCounter++}`);
      }
      n.label = bnodeMap.get(n.label);
    }

    // Expand prefixed named nodes to full IRIs
    if (
      n.type === 'term' &&
      n.subType === 'namedNode' &&
      typeof n.prefix === 'string'
    ) {
      const prefixIri = prefixMap.get(n.prefix);
      if (prefixIri !== undefined) {
        n.value = prefixIri + n.value;
        delete n.prefix;
      }
    }

    // Strip location metadata and recurse into children
    for (const key of Object.keys(n)) {
      if (key === 'loc') {
        n[key] = undefined;
        continue;
      }
      traverse(n[key]);
    }
  }

  traverse(newQuery);
  return newQuery;
}
