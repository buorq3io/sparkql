import {
  bind,
  concat,
  createFunctionCallExpression,
  predicates,
  sha1,
  str,
  strafter,
  substr,
  triples,
  values,
  zeroOrMore,
} from '#src/index.js';
import { db, n, v } from '#test/index.js';

export default () =>
  db
    .select()
    .where(
      values({ [v.parent.value]: [n.wd.Q10908] }),
      triples(v.taxon, predicates([zeroOrMore(n.wdt.P171), v.parent], [n.wdt.P8485, v.map])),
      bind(strafter(str(v.taxon), 'Q'), v.idStr),
      bind(createFunctionCallExpression(n.xsd.integer, [v.idStr]), v.taxonId),
      bind(sha1(concat(str(v.taxonId))), v.hash),
      bind(concat(substr(v.hash, 1, 2), substr(v.hash, 3, 2), substr(v.hash, 5, 2)), v.rgb)
    );
