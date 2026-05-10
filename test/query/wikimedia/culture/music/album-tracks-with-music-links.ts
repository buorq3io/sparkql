import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  optional,
  concat,
  uri,
  as,
  asc,
  predicates,
  createFunctionCallExpression,
} from '#src/index.js';
export default () =>
  db
    .select({
      order: v.order,
      item: v.item,
      itemLabel: v.itemLabel,
      yandex: v.yandex,
      apple: v.apple,
      spotify: as(uri(concat('https://open.spotify.com/track/', v.spotify_id)), v.spotify),
      amazon: as(uri(concat('https://www.amazon.com/dp/', v.amazon_id)), v.amazon),
    })
    .where(
      triples(n.wd.Q105834355, n.p.P658, v.st),
      triples(v.st, n.ps.P658, v.item),
      optional(triples(v.st, n.pq.P1545, v.order)),
      optional(
        triples(v.item, n.p.P750, [predicates([n.ps.P750, n.wd.Q4537983], [n.pq.P2699, v.yandex])])
      ),
      optional(
        triples(v.item, n.p.P750, [predicates([n.ps.P750, n.wd.Q20056642], [n.pq.P2699, v.apple])])
      ),
      optional(triples(v.item, n.wdt.P5749, v.amazon_id)),
      optional(triples(v.item, n.wdt.P2207, v.spotify_id)),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],ru,en')
      )
    )
    .orderBy(asc(createFunctionCallExpression(n.xsd.integer, [v.order])));
