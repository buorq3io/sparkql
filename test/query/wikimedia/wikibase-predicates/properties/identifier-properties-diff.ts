import { db, v, n } from '#test/index.js';
import {
  triples,
  union,
  group,
  filter,
  notExists,
  optional,
  as,
  replace,
  sample,
  service,
  asc,
  bind,
  predicates,
  uri,
} from '#src/index.js';

export default () =>
  db
    .select({ p: v.p, pLabel: v.pLabel, url_comp2: as(sample(v.url), v.url_comp2) })
    .where(
      triples(n.hint.Query, n.hint.optimizer, 'None'),
      bind(n.wd.Q4573, v.comp1),
      bind(n.wd.Q39666, v.comp2),
      union(
        group(
          triples(v.comp2, v.wdt, v.v),
          triples(
            v.p,
            predicates(
              [n.wikibase.directClaim, v.wdt],
              [n.wikibase.propertyType, n.wikibase.ExternalId]
            )
          ),
          filter(notExists(triples(v.comp1, v.wdt, []))),
          optional(triples(v.p, n.wdt.P1630, v.f)),
          bind(uri(replace(v.f, '\\$1', v.v)), v.url)
        ),
        group(bind(n.wd.Q4573, v.p)),
        group(bind(n.wd.Q39666, v.p))
      ),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      )
    )
    .groupBy(v.p, v.pLabel)
    .orderBy(asc(v.url_comp2));
