import { db, v, n } from '#test/index.js';
import {
  triples,
  service,
  filter,
  eq,
  bind,
  seq,
  zeroOrMore,
  str,
  concat,
  strdt,
  asc,
  predicates,
} from '#src/index.js';

export default () =>
  db
    .select({
      comm1: v.comm1,
      comm1Label: v.comm1Label,
      coord1: v.coord1,
      comm2: v.comm2,
      coord2: v.coord2,
      line: v.line,
      connectingLine1: v.connectingLine1,
      connectingLine1Label: v.connectingLine1Label,
      layer: v.layer,
      rgb: v.rgb,
    })
    .where(
      bind(n.wd.Q8686, v.city),
      triples(v.comm1, seq(n.wdt.P31, zeroOrMore(n.wdt.P279)), n.wd.Q928830),
      triples(v.comm1, seq(zeroOrMore(n.wdt.P131), zeroOrMore(n.wdt.P279)), v.city),
      triples(v.comm1, n.wdt.P625, v.coord1),
      triples(v.comm1, n.wdt.P81, v.connectingLine1),
      triples(v.comm1, n.wdt.P197, v.comm2),
      triples(v.connectingLine1, n.wdt.P465, v.rgb),
      triples(v.comm2, n.wdt.P81, v.connectingLine2),
      triples(v.comm2, n.wdt.P625, v.coord2),
      filter(eq(v.connectingLine1, v.connectingLine2)),
      triples(v.comm1, n.p.P625, [
        n.psv.P625,
        [predicates([n.wikibase.geoLongitude, v.coord1lon], [n.wikibase.geoLatitude, v.coord1lat])],
      ]),
      triples(v.comm2, n.p.P625, [
        n.psv.P625,
        [predicates([n.wikibase.geoLongitude, v.coord2lon], [n.wikibase.geoLatitude, v.coord2lat])],
      ]),
      bind(
        concat(
          'LINESTRING (',
          str(v.coord1lon),
          ' ',
          str(v.coord1lat),
          ',',
          str(v.coord2lon),
          ' ',
          str(v.coord2lat),
          ')'
        ),
        v.str
      ),
      bind(strdt(v.str, n.geo.wktLiteral), v.line),
      bind(v.connectingLine1, v.layer),
      service(
        n.wikibase.label,
        triples(n.bd.serviceParam, n.wikibase.language, '[AUTO_LANGUAGE],mul,en')
      )
    )
    .orderBy(asc(v.connectingLine1Label));
