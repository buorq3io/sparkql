import { db, v, n } from '#test/index.js';
import { triples, seq, zeroOrOne, objects, service, asc } from '#src/index.js';

export default () =>
  db
    .selectDistinct({ item: v.item, itemLabel: v.itemLabel })
    .where(
      db
        .select({ item: v.item })
        .where(
          triples(
            v.item,
            seq(
              n.wdt.P279,
              n.wdt.P279,
              zeroOrOne(n.wdt.P279),
              zeroOrOne(n.wdt.P279),
              zeroOrOne(n.wdt.P279)
            ),
            objects(n.wd.Q7048977, n.wd.Q112276019)
          )
        )
        .limit(300)
        .$asSubQuery(),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],en,es,fr,de,mul')
      )
    )
    .orderBy(asc(v.itemLabel));
