import { db, v, n } from '#test/index.js';
import { triples, service, filter, subs, abs, lt, predicates } from '#src/index.js';

export default () =>
  db
    .select({
      city: v.city,
      cityLabel: v.cityLabel,
      location: v.location,
      populatie2: v.populatie2,
    })
    .where(
      db
        .selectDistinct()
        .where(
          triples(n.wd.Q9832, n.wdt.P1082, v.populatie),
          triples(v.city, predicates([n.wdt.P1082, v.populatie2], [n.wdt.P625, v.location])),
          filter(lt(abs(subs(v.populatie, v.populatie2)), 1000))
        )
        .$asSubQuery(),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,nl')
      )
    );
