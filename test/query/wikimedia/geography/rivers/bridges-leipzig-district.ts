import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  optional,
  filter,
  union,
  group,
  values,
  seq,
  zeroOrMore,
  predicates,
  sample,
  year,
  str,
  concat,
  as,
  bound,
  ternary,
  exists,
  eq,
  substr,
  div,
} from '#src/index.js';

export default () =>
  db
    .select({
      br: v.br,
      brLabel: v.brLabel,
      wcourse: v.wcourse,
      wcourseLabel: v.wcourseLabel,
      loc: as(sample(v.coord), v.loc),
      pic: as(sample(v.img), v.pic),
      start: as(concat(sample(v.sKey), ': ', str(year(sample(v.s)))), v.start),
      end: as(concat(sample(v.eKey), ': ', str(year(sample(v.e)))), v.end),
      a: v.a,
      aLabel: as(ternary(bound(v.a), concat(v.brLabel, ' in Wikipedia'), div(1, 0)), v.aLabel),
    })
    .where(
      union(
        group(
          values({ [v.lk.value]: [n.wd.Q6301, n.wd.Q6308, n.wd.Q20233] }),
          triples(v.lk, n.wdt.P150, v.mun)
        ),
        group(values({ [v.mun.value]: [n.wd.Q2079, n.wd.Q113503289] }))
      ),
      triples(
        v.br,
        predicates(
          [seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q12280],
          [n.wdt.P177, v.wcourse],
          [n.wdt.P131, v.mun]
        )
      ),
      triples(v.wcourse, seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q355304),
      optional(triples(v.br, n.wdt.P625, v.coord)),
      optional(triples(v.br, n.wdt.P18, v.img)),
      optional(triples(v.br, n.wdt.P571, v.s)),
      optional(triples(v.br, n.wdt.P576, v.e)),
      optional(
        triples(v.a, n.schema.about, v.br),
        filter(
          ternary(
            exists(triples(v.a, n.schema.inLanguage, '[AUTO_LANGUAGE]')),
            eq(substr(str(v.a), 1, 11), substr('https://[AUTO_LANGUAGE].', 1, 11)),
            ternary(
              exists(triples(v.a, n.schema.inLanguage, 'en')),
              eq(substr(str(v.a), 1, 10), 'https://en'),
              eq(substr(str(v.a), 1, 10), 'https://de')
            )
          )
        )
      ),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en,de'),
        triples(v.br, n.rdfs.label, v.brLabel),
        triples(v.wcourse, n.rdfs.label, v.wcourseLabel),
        triples(n.wd.P571, n.rdfs.label, v.sKey),
        triples(n.wd.P576, n.rdfs.label, v.eKey)
      )
    )
    .groupBy(v.br, v.brLabel, v.wcourse, v.wcourseLabel, v.a);
