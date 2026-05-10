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
  gte,
  str,
  count,
  substr,
  strlen,
  floor,
  mul,
  div,
  concat,
  ternary,
  eq,
  add,
  subs,
  createFunctionCallExpression,
  asc,
  predicates,
} from '#src/index.js';

export default () =>
  db
    .select({ from: v.from, kilometers: v.kilometers, to: v.to, rank_group: v.rank_group })
    .where(
      db
        .select({
          mun: as(sample(v.mun), v.mun),
          mun2: as(sample(v.mun2), v.mun2),
          kilometers: as(sample(v.distNum), v.kilometers),
          rg: as(subs(count(), 1), v.rg),
          rgpad: as(substr('00', add(1, strlen(str(v.rg)))), v.rgpad),
          rgmod: as(
            ternary(
              eq(floor(div(subs(v.rg, mul(100, floor(div(v.rg, 100)))), 10)), 1),
              0,
              subs(v.rg, mul(10, floor(div(v.rg, 10))))
            ),
            v.rgmod
          ),
          rgord: as(
            ternary(
              eq(v.rgmod, 1),
              'st',
              ternary(eq(v.rgmod, 2), 'nd', ternary(eq(v.rgmod, 3), 'rd', 'th'))
            ),
            v.rgord
          ),
          rank_group: as(
            concat(v.rgpad, str(v.rg), v.rgord, '-most farthest places'),
            v.rank_group
          ),
        })
        .where(
          db
            .select({ mun: v.mun, loc: as(sample(v.loc), v.loc) })
            .where(
              triples(v.mun, predicates(
                [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15284],
                [n.wdt.P131, n.wd.Q6308],
                [n.wdt.P625, v.loc],
              ))
            )
            .groupBy(v.mun)
            .$asSubQuery(),
          optional(
            db
              .select({ mun2: as(v.mun, v.mun2), loc2: as(sample(v.loc), v.loc2) })
              .where(
                triples(v.mun, predicates(
                  [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15284],
                  [n.wdt.P131, n.wd.Q6308],
                  [n.wdt.P625, v.loc],
                ))
              )
              .groupBy(v.mun)
              .$asSubQuery()
          ),
          optional(
            db
              .select({ mun3: as(v.mun, v.mun3), loc3: as(sample(v.loc), v.loc3) })
              .where(
                triples(v.mun, predicates(
                  [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q15284],
                  [n.wdt.P131, n.wd.Q6308],
                  [n.wdt.P625, v.loc],
                ))
              )
              .groupBy(v.mun)
              .$asSubQuery()
          ),
          bind(createFunctionCallExpression(n.geof.distance, [v.loc, v.loc2]), v.distNum),
          bind(createFunctionCallExpression(n.geof.distance, [v.loc, v.loc3]), v.d),
          filter(gte(v.distNum, v.d))
        )
        .groupBy(v.mun, v.mun2, v.distNum)
        .$asSubQuery(),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en'),
        triples(v.mun, n.rdfs.label, v.from),
        triples(v.mun2, n.rdfs.label, v.to)
      )
    )
    .orderBy(asc(v.rank_group), asc(v.kilometers), asc(v.from));
