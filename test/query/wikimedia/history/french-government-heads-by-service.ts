import { db, v, n } from '#test/index.js';
import {
  triples,
  predicates,
  service,
  optional,
  filter,
  bind,
  alt,
  zeroOrMore,
  gte,
  ternary,
  bound,
  now,
  floor,
  subs,
  desc,
  asc,
} from '#src/index.js';

export default () =>
  db
    .selectDistinct({
      item: v.item,
      itemLabel: v.itemLabel,
      positionLabel: v.positionLabel,
      picture: v.picture,
      start: v.start,
      end: v.end,
      days: v.days,
    })
    .where(
      triples(v.item, predicates([n.wdt.P31, n.wd.Q5], [n.p.P39, v.position_statement])),
      triples(v.position_statement, predicates([n.ps.P39, v.position], [n.pq.P580, v.start])),
      filter(gte(v.start, new Date('1815-01-01T00:00:00Z'))),
      triples(v.position, alt(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15135541),
      optional(triples(v.position_statement, n.pq.P582, v.x)),
      optional(triples(v.item, n.wdt.P18, v.picture)),
      bind(ternary(bound(v.x), v.x, now()), v.end),
      bind(floor(subs(v.end, v.start)), v.days),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      )
    )
    .orderBy(desc(v.days), asc(v.itemLabel));
