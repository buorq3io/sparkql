import { db, v, n } from '#test/index.js';
import { triples, service, filter, and, gte, lte } from '#src/index.js';

export default () =>
  db
    .selectDistinct({ item: v.item, itemLabel: v.itemLabel })
    .where(
      triples(v.item, n.wdt.P31, n.wd.Q11424),
      triples(v.item, n.wdt.P577, v.pubdate),
      filter(
        and(
          gte(v.pubdate, new Date('2017-01-01T00:00:00Z')),
          lte(v.pubdate, new Date('2017-12-31T00:00:00Z'))
        )
      ),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      )
    );
