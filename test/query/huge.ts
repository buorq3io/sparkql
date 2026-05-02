import {
  or,
  as,
  eq,
  gt,
  lt,
  and,
  seq,
  str,
  max,
  now,
  asc,
  desc,
  subs,
  year,
  bind,
  lang,
  uuid,
  bound,
  ucase,
  count,
  minus,
  union,
  graph,
  regex,
  isIRI,
  strlen,
  concat,
  filter,
  sample,
  values,
  triples,
  inArray,
  ternary,
  coalesce,
  distinct,
  sameTerm,
  optional,
  isLiteral,
  notExists,
  strstarts,
  predicates,
  zeroOrMore,
  groupConcat,
  serviceSilent,
  group,
} from '../../src/index.js';
import { db, v, n } from '../index.js';

export default () =>
  db
    .base('http://example.org/default-resource/')
    .selectDistinct({
      subject: v.subject,
      knownType: v.knownType,
      sampleComment: as(sample(v.comment), v.sampleComment),
      friendCount: as(count(v.friend), v.friendCount),
      hobbies: as(distinct(groupConcat(v.hobby, ' | ')), v.hobbies),
      fullName: as(ucase(concat(v.firstName, ' ', v.lastName)), v.fullName),
      displayName: as(ternary(bound(v.nickname), v.nickname, v.firstName), v.displayName),
      ageInDecades: v.ageInDecades,
      dbpediaLink: v.dbpediaLink,
    })
    .from(db.iri('http://example.org/mainGraph'))
    .fromNamed(db.iri('http://example.org/namedGraph1'))
    .fromNamed(db.iri('http://example.org/namedGraph2'))
    .where(
      values({
        [v.knownType.value]: [n.foaf.Person, n.ex.Robot, undefined],
        [v.typeLabel.value]: ['Person', 'Robot', 'Unknown'],
      }),
      triples(
        v.subject,
        predicates(
          [n.rdf.type, v.knownType],
          [n.foaf.firstName, v.firstName],
          [n.foaf.lastName, v.lastName],
          [seq(zeroOrMore(n.foaf.knows), n.ex.relatedTo), v.friend]
        )
      ),
      triples(v.subject, n.ex.hasAddress, [
        predicates(
          [n.rdf.type, n.schema.PostalAddress],
          [n.schema.streetAddress, '123 SPARQL St.']
        ),
      ]),
      optional(triples(v.subject, n.foaf.nick, v.nickname)),
      union(
        group(triples(v.subject, n.foaf.homepage, v.webpage)),
        group(triples(v.subject, n.foaf.workplaceHomepage, v.webpage))
      ),
      db
        .select({ subject: v.subject })
        .where(triples(v.subject, n.dc.creator, v.work))
        .groupBy(v.subject)
        .having(gt(count(v.work), 5))
        .$asSubQuery(),
      graph(
        db.iri('http://example.org/namedGraph1'),
        triples(v.subject, n.rdfs.comment, v.comment),
        filter(eq(lang(v.comment), 'en'))
      ),
      minus(triples(v.subject, n.ex.status, 'inactive')),
      bind(subs(year(now()), v.birthYear), v.age),
      bind(coalesce(v.nickname, v.firstName, 'N/A'), v.bestName),
      bind(uuid(), v.generatedId),

      filter(and(gt(v.age, 25), lt(v.age, 65))),
      filter(or(isLiteral(v.firstName), isIRI(v.subject))),
      filter(notExists(triples(v.subject, n.ex.isBanned, true))),
      filter(
        inArray(v.friend, [
          db.iri('http://example.org/friend/Bob'),
          db.iri('http://example.org/friend/Alice'),
        ])
      ),
      filter(regex(v.lastName, /^[A-F]/, 'i')),
      filter(strstarts(str(v.webpage), 'http://')),
      filter(sameTerm(v.knownType, n.foaf.Person)),

      serviceSilent(
        db.iri('https://dbpedia.org/sparql'),
        triples(v.subject, n.ex.sameAs, v.dbpediaLink)
      ),
      optional(triples(v.subject, n.ex.hasHobby, v.hobby))
    )
    .groupBy(
      v.subject,
      v.knownType,
      v.firstName,
      v.lastName,
      v.ageInDecades,
      v.dbpediaLink,
      v.nickname
    )
    .having(and(lt(max(v.age), 100), gt(strlen(v.fullName), 3)))
    .orderBy(desc(v.friendCount), asc(v.fullName))
    .limit(100)
    .offset(20);
