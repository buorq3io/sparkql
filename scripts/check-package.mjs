import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'sparkql-package-'));

try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporary], {
      cwd: root,
      encoding: 'utf8',
    })
  );
  const tarball = join(temporary, packed[0].filename);
  // The node16 profile checks node16-cjs, node16-esm and bundler, ignoring only node10.
  execFileSync('pnpm', ['exec', 'attw', '--profile', 'node16', tarball], {
    cwd: root,
    stdio: 'inherit',
  });

  writeFileSync(join(temporary, 'package.json'), JSON.stringify({ private: true }));
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball],
    { cwd: temporary, stdio: 'inherit' }
  );

  const specifiers = [
    'sparkql',
    'sparkql/arq',
    'sparkql/stardog',
    'sparkql/neptune',
    'sparkql/graphdb',
    'sparkql/virtuoso',
    'sparkql/oxigraph',
    'sparkql/rdf4j',
    'sparkql/qlever',
  ];
  for (const format of ['cjs', 'esm']) {
    const load = format === 'cjs' ? 'require(specifier)' : 'await import(specifier)';
    const fixture = `
      import assert from 'node:assert/strict';
      import { once } from 'node:events';
      import { createServer } from 'node:http';
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      let requests = 0;
      const server = createServer((_request, response) => {
        requests++;
        response.setHeader('content-type', 'application/sparql-results+json');
        response.end(JSON.stringify({ head: {}, boolean: true }));
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const endpointUrl = 'http://127.0.0.1:' + server.address().port + '/query';
        for (const specifier of ${JSON.stringify(specifiers)}) {
          const { SparqlDatabase } = ${load};
          assert.equal(typeof SparqlDatabase.create, 'function', specifier);
          const db = SparqlDatabase.create({ connection: endpointUrl });
          const query = db.ask();
          assert.match(query.toSPARQL(), /ASK/);
          assert.equal(await query, true, specifier);
          assert.equal(await query, true, specifier);
        }
        // Every await sends a request.
        assert.equal(requests, ${specifiers.length * 2});
      } finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      }
    `;
    const path = join(temporary, `${format}.mjs`);
    writeFileSync(path, fixture);
    // Disable require(esm) to exercise the behavior of older supported Node versions.
    const flags = process.allowedNodeEnvironmentFlags.has('--no-experimental-require-module')
      ? ['--no-experimental-require-module']
      : [];
    execFileSync(process.execPath, [...flags, path], {
      cwd: temporary,
      stdio: 'inherit',
      timeout: 30_000,
    });
  }
  console.log('Packed CJS and ESM entry points load, build and execute queries successfully.');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
