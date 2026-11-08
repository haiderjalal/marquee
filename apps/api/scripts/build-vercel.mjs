/**
 * Bundles the Vercel handler into Vercel's Build Output format.
 *
 * The bundle contains every npm dependency and workspace package, so Vercel runs the function
 * without installing or compiling anything at deploy time. The output goes to .vercel/output,
 * which Vercel uses in place of compiling the source. Every request is routed to the one function,
 * and Express inside it matches the URL, so the original path reaches the router unchanged.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(appRoot, '.vercel', 'output');
const functionDirectory = path.join(outputRoot, 'functions', 'api', 'index.func');
/**
 * The database package reads its SQL migrations from disk, next to the code that runs them.
 * They are copied beside the bundle so the start-up schema check can find them.
 */
const migrationsSource = path.join(
  appRoot,
  '..',
  '..',
  'packages',
  'database',
  'src',
  'migrations',
);

/**
 * Optional Nest integrations this API never loads. Nest requires them lazily, so leaving them
 * out of the bundle does not change behaviour.
 */
const UNUSED_OPTIONAL_MODULES = [
  '@nestjs/microservices',
  '@nestjs/microservices/*',
  '@nestjs/websockets',
  '@nestjs/platform-socket.io',
  '@nestjs/platform-ws',
  'class-transformer',
  'class-validator',
  'cache-manager',
  'pg-native',
];

/**
 * Creates the function bundle, the function configuration and the routing configuration.
 * @returns Resolves once every file in the output directory is written.
 */
async function writeVercelOutput() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(functionDirectory, { recursive: true });

  await build({
    entryPoints: [path.join(appRoot, 'src', 'vercel-handler.ts')],
    outfile: path.join(functionDirectory, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: false,
    external: UNUSED_OPTIONAL_MODULES,
    // Vercel calls module.exports, so the default export becomes the whole export.
    footer: { js: 'module.exports = module.exports.default;' },
    logLevel: 'warning',
  });

  await cp(migrationsSource, path.join(functionDirectory, 'migrations'), { recursive: true });

  await writeFile(
    path.join(functionDirectory, '.vc-config.json'),
    `${JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs' }, null, 2)}\n`,
  );
  await writeFile(
    path.join(outputRoot, 'config.json'),
    `${JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/api' }] }, null, 2)}\n`,
  );
}

await writeVercelOutput();
process.stdout.write(`Vercel function written to ${path.relative(appRoot, functionDirectory)}\n`);
