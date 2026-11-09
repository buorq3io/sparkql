import { as, asc, concat, md5, rand, service, str, triples } from '#src/index.js';
import { db, n, v } from '#test/index.js';

export default () =>
  db
    .select({
      item: v.item,
      itemLabel: v.itemLabel,
      image: v.image,
      random: as(md5(concat(str(v.item), str(rand()))), v.random),
    })
    .where(
      triples(v.item, n.wdt.P31, n.wd.Q3305213),
      triples(v.item, n.wdt.P18, v.image),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .orderBy(asc(v.random))
    .limit(10)
    .offset(0);
