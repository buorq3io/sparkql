import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { TestProject } from 'vitest/node';
import { type Engine, engines } from './engines.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Names of the engines that are up and loaded with data/sample.ttl. */
    engines: string[];
  }
}

const timeout = Number(process.env.SPARKQL_ENGINE_TIMEOUT ?? 180) * 1000;

/** Engines named by `SPARKQL_ENGINES` (comma separated), or every one without a license. */
function selected(): { list: Engine[]; explicit: boolean } {
  const names = process.env.SPARKQL_ENGINES?.split(',')
    .map(name => name.trim())
    .filter(Boolean);
  if (!names?.length) return { list: engines.filter(engine => !engine.licensed), explicit: false };
  const unknown = names.filter(name => !engines.some(engine => engine.name === name));
  if (unknown.length)
    throw new Error(
      `Unknown engine(s) in SPARKQL_ENGINES: ${unknown.join(', ')}. ` +
        `Known: ${engines.map(engine => engine.name).join(', ')}.`
    );
  return { list: engines.filter(engine => names.includes(engine.name)), explicit: true };
}

/**
 * Compose services with a running container, or `undefined` when Docker is
 * unavailable (e.g. the engines run elsewhere, see `SPARKQL_ENGINE_HOST`).
 */
async function runningServices(): Promise<Set<string> | undefined> {
  const compose = fileURLToPath(new URL('./compose.yaml', import.meta.url));
  try {
    const { stdout } = await promisify(execFile)('docker', [
      'compose',
      '-f',
      compose,
      'ps',
      '--services',
      '--status',
      'running',
    ]);
    return new Set(stdout.split('\n').filter(Boolean));
  } catch {
    return undefined;
  }
}

async function waitUntilReady(engine: Engine, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await engine.ready()) return true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

/**
 * Waits for the selected engines, loads the sample data into each, and hands
 * the ready ones to the specs.
 *
 * Engines named in `SPARKQL_ENGINES` must come up. Without it, the engines
 * whose containers are running must come up and the others are skipped with a
 * warning, so `pnpm test:integration` runs against whatever subset of the
 * compose stack is up, even right after `pnpm db:up`.
 */
export default async function setup(project: TestProject): Promise<void> {
  const { list, explicit } = selected();
  const data = await readFile(new URL('./data/sample.ttl', import.meta.url), 'utf8');
  const running = explicit ? undefined : await runningServices();
  // Required engines get the full timeout; others a short grace period.
  const required = (engine: Engine) => explicit || running?.has(engine.name) === true;
  const start = Date.now();

  const results = await Promise.all(
    list.map(async engine => {
      const deadline = start + (required(engine) ? timeout : 5000);
      if (!(await waitUntilReady(engine, deadline))) {
        if (required(engine))
          throw new Error(`${engine.name} did not answer within ${timeout / 1000}s.`);
        return undefined;
      }
      try {
        await engine.load(data);
      } catch (error) {
        throw new Error(`Loading data/sample.ttl into ${engine.name} failed: ${error}`);
      }
      return engine.name;
    })
  );

  const ready = results.filter((name): name is string => name !== undefined);
  const skipped = list.filter(engine => !ready.includes(engine.name)).map(engine => engine.name);
  if (skipped.length)
    console.warn(
      `Skipping engines that are not running: ${skipped.join(', ')}. Start them with \`pnpm db:up\`.`
    );
  if (!ready.length)
    throw new Error('No triple store is running. Start them with `pnpm db:up`, then retry.');
  console.info(`Integration tests run against: ${ready.join(', ')}.`);
  project.provide('engines', ready);
}
