import { db, v, n, b } from '#test/index.js';
import {
  triples,
  filter,
  and,
  gt,
  lt,
  bind,
  year,
  month,
  day,
  eq,
  or,
  subs,
  seq,
  countDistinct,
  as,
  asc,
  ternary,
} from '#src/index.js';

export default () =>
  db
    .select({ age: v.age, count: as(countDistinct(v.a), v.count) })
    .where(
      triples(v.a, n.wdt.P31, n.wd.Q5),
      triples(v.a, seq(n.wdt.P106, n.wdt.P279), n.wd.Q639669),
      triples(v.a, seq(n.p.P569, n.psv.P569), v.birth_date_node),
      triples(v.a, seq(n.p.P570, n.psv.P570), v.death_date_node),
      triples(v.birth_date_node, n.wikibase.timeValue, v.birth_date),
      triples(v.death_date_node, n.wikibase.timeValue, v.death_date),
      filter(and(gt(v.age, 10), lt(v.age, 100))),
      bind(
        subs(
          subs(year(v.death_date), year(v.birth_date)),
          ternary(
            or(
              lt(month(v.death_date), month(v.birth_date)),
              and(
                eq(month(v.death_date), month(v.birth_date)),
                lt(day(v.death_date), day(v.birth_date))
              )
            ),
            1,
            0
          )
        ),
        v.age
      )
    )
    .groupBy(v.age)
    .orderBy(asc(v.age));
