-- Runs once, when the Virtuoso container initializes its database.
-- Lets the anonymous SPARQL user run updates and use the graph store protocol,
-- which the test setup uses to load data/sample.ttl. Test containers only.
GRANT SPARQL_UPDATE TO "SPARQL";
DB.DBA.RDF_DEFAULT_USER_PERMS_SET ('nobody', 7);
