import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  optional,
  seq,
  zeroOrMore,
  sample,
  as,
  bind,
  filter,
  str,
  createFunctionCallExpression,
  coalesce,
  ternary,
  gte,
  div,
  concat,
  asc,
  lte,
  predicates,
} from '#src/index.js';

export default () =>
  db
    .select({ from: v.from, to: v.to, distGrp: v.distGrp })
    .where(
      db
        .select({ from: v.from, to: v.to, distNum: v.distNum, mun: v.mun, mun2: v.mun2 })
        .where(
          db
            .select({ mun: v.mun, loc: as(sample(v.loc), v.loc) })
            .where(
              triples(
                v.mun,
                predicates(
                  [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15284],
                  [n.wdt.P131, n.wd.Q6308],
                  [n.wdt.P625, v.loc]
                )
              )
            )
            .groupBy(v.mun)
            .$asSubQuery(),
          optional(
            db
              .select({ mun2: as(v.mun, v.mun2), loc2: as(sample(v.loc), v.loc2) })
              .where(
                triples(
                  v.mun,
                  predicates(
                    [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15284],
                    [n.wdt.P131, n.wd.Q6308],
                    [n.wdt.P625, v.loc]
                  )
                )
              )
              .groupBy(v.mun)
              .$asSubQuery()
          ),
          bind(createFunctionCallExpression(n.geof.distance, [v.loc, v.loc2]), v.distNum),
          service(
            n.wikibase.label,
            triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en'),
            triples(v.mun, n.rdfs.label, v.from),
            triples(v.mun2, n.rdfs.label, v.to)
          )
        )
        .$asSubQuery(),
      filter(lte(concat(v.from, str(v.mun)), concat(v.to, str(v.mun2)))),
      bind(
        coalesce(
          ternary(gte(v.distNum, 40), '40 - .. km', div(1, 0)),
          ternary(gte(v.distNum, 30), '30 - 40 km', div(1, 0)),
          ternary(gte(v.distNum, 20), '20 - 30 km', div(1, 0)),
          ternary(gte(v.distNum, 10), '10 - 20 km', div(1, 0)),
          ternary(gte(v.distNum, 5), '05 - 10 km', div(1, 0)),
          ternary(gte(v.distNum, 1), '01 - 05 km', '00 - 01 km')
        ),
        v.distGrp
      )
    )
    .orderBy(asc(v.from), asc(v.distGrp));
