import { db, v, n } from '#test/index.js';
import {
  triples,
  seq,
  predicates,
  service,
  filter,
  gt,
  count,
  avg,
  round,
  as,
  subs,
  year,
  asc,
} from '#src/index.js';

const innerSubQuery = db
  .select({
    p: v.p,
    occ: v.occ,
    birthYear: as(avg(year(v.birth)), v.birthYear),
    deathYear: as(avg(year(v.death)), v.deathYear),
  })
  .where(
    triples(
      v.p,
      predicates(
        [n.wdt.P31, n.wd.Q5],
        [n.wdt.P106, v.occ],
        [
          seq(n.p.P569, n.psv.P569),
          [predicates([n.wikibase.timePrecision, 9], [n.wikibase.timeValue, v.birth])],
        ],
        [
          seq(n.p.P570, n.psv.P570),
          [predicates([n.wikibase.timePrecision, 9], [n.wikibase.timeValue, v.death])],
        ]
      )
    )
  )
  .groupBy(v.p, v.occ)
  .$asSubQuery();

const midSubQuery = db
  .select({
    occ: v.occ,
    count: as(count(v.p), v.count),
    avgBirthYear: as(round(avg(v.birthYear)), v.avgBirthYear),
    avgAge: as(avg(subs(v.deathYear, v.birthYear)), v.avgAge),
  })
  .where(innerSubQuery)
  .groupBy(v.occ)
  .$asSubQuery();

export default () =>
  db
    .select({
      occ: v.occ,
      occLabel: v.occLabel,
      avgAge: v.avgAge,
      avgBirthYear: v.avgBirthYear,
      count: v.count,
    })
    .where(
      midSubQuery,
      filter(gt(v.count, 300)),
      service(n.wikibase.label, triples(n.bd.serviceParam, n.wikibase.language, 'en'))
    )
    .orderBy(asc(v.avgAge));
