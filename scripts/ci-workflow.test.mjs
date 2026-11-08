import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('integration smoke starts only Postgres and Redis so the API can bind port 3000', () => {
  assert.match(workflow, /docker compose up -d postgres redis/);
  assert.doesNotMatch(workflow, /docker compose up -d\s*(?:\n|$)/);
  assert.match(workflow, /PostgreSQL or Redis did not become ready in time\./);
  assert.match(workflow, /exit 1/);
});

test('OpenAPI job generates the Prisma client before building the API', () => {
  const job = workflow.split('openapi-breaking-change:')[1];
  assert.ok(job, 'openapi-breaking-change job missing');
  const databaseBuild = job.indexOf('@assessflow/database build');
  const apiBuild = job.indexOf('@assessflow/api build');
  assert.ok(databaseBuild !== -1, 'database build step missing');
  assert.ok(apiBuild !== -1, 'api build step missing');
  assert.ok(databaseBuild < apiBuild, 'Prisma client must be generated before nest build');
});
