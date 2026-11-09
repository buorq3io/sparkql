import { asc, predicates, service, triples } from '#src/index.js';
import { db, n, v } from '#test/index.js';

export default () =>
  db
    .select({
      rettore: v.rettore,
      rettoreLabel: v.rettoreLabel,
      starttime: v.starttime,
      endtime: v.endtime,
    })
    .where(
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      ),
      triples(v.rettore, n.p.P106, [
        predicates(
          [n.ps.P106, n.wd.Q212071],
          [n.pq.P642, n.wd.Q193510],
          [n.pq.P580, v.starttime],
          [n.pq.P582, v.endtime]
        ),
      ])
    )
    .orderBy(asc(v.starttime));
