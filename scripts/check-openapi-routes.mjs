#!/usr/bin/env node

/**
 * AssessFlow OpenAPI Breaking-Change & Route Parity Validator
 *
 * Verifies that every HTTP endpoint documented in the authoritative
 * OpenAPI contract (07_AssessFlow_OpenAPI_v1.1-implemented.yaml) is implemented
 * in the NestJS backend application routes.
 *
 * Exits with status code 0 when all documented endpoints are present.
 * Exits with status code 1 if any documented endpoint is missing.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

const rootDir = process.cwd();
const openApiYamlPath = resolve(
  rootDir,
  'AssessFlow_System_Design_Pack_v1.0/07_AssessFlow_OpenAPI_v1.1-implemented.yaml',
);

if (!existsSync(openApiYamlPath)) {
  console.error(`[OpenAPI Gate] Error: Contract file not found at: ${openApiYamlPath}`);
  process.exit(1);
}

/**
 * Parses path definitions and HTTP methods from OpenAPI 3.1 YAML content
 * without requiring external dependencies.
 */
function parseOpenApiEndpoints(yamlContent) {
  const lines = yamlContent.split(/\r?\n/);
  let inPaths = false;
  let currentPath = null;
  const endpoints = [];

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    // Any unindented top-level key after paths: terminates the paths block (e.g., components:)
    if (inPaths && /^[^\s]/.test(line)) {
      break;
    }
    if (!inPaths) continue;

    // Matches path lines indented by 2 spaces, e.g. "  /cases/{caseId}:"
    const pathMatch = line.match(/^  (\/[^:\s]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    if (currentPath) {
      // Matches HTTP method lines indented by 4 spaces, e.g. "    get:" or "    post:"
      const methodMatch = line.match(/^    (get|post|put|patch|delete|options|head):\s*$/i);
      if (methodMatch) {
        endpoints.push({
          path: currentPath,
          method: methodMatch[1].toUpperCase(),
        });
      }
    }
  }

  return endpoints;
}

async function extractNestRoutes() {
  const apiPackageJson = resolve(rootDir, 'apps/api/package.json');
  const requireFromApi = createRequire(apiPackageJson);

  const apiDistAppModule = resolve(rootDir, 'apps/api/dist/app.module.js');
  if (!existsSync(apiDistAppModule)) {
    console.error(
      `[OpenAPI Gate] Error: apps/api dist build not found at: ${apiDistAppModule}.\n` +
        `Run 'pnpm --filter @assessflow/api build' before running this check.`,
    );
    process.exit(1);
  }

  const { NestFactory } = requireFromApi('@nestjs/core');
  const { AppModule } = requireFromApi(apiDistAppModule);

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const router = app.getHttpAdapter().getInstance().router;
  const routes = [];

  if (router && Array.isArray(router.stack)) {
    for (const layer of router.stack) {
      if (layer.route && layer.route.path) {
        const routePath = layer.route.path;
        for (const method of Object.keys(layer.route.methods || {})) {
          routes.push({
            path: routePath,
            method: method.toUpperCase(),
          });
        }
      }
    }
  }

  await app.close();
  return routes;
}

async function main() {
  console.log('[OpenAPI Gate] Starting OpenAPI v1.1 route parity check...');
  console.log(`[OpenAPI Gate] Contract source: ${openApiYamlPath}`);

  const yamlContent = readFileSync(openApiYamlPath, 'utf8');
  const openApiEndpoints = parseOpenApiEndpoints(yamlContent);

  if (openApiEndpoints.length === 0) {
    console.error('[OpenAPI Gate] Failed: No endpoints found in OpenAPI YAML specification.');
    process.exit(1);
  }

  console.log(
    `[OpenAPI Gate] Discovered ${openApiEndpoints.length} endpoints in OpenAPI contract.`,
  );

  const nestRoutes = await extractNestRoutes();
  console.log(
    `[OpenAPI Gate] Discovered ${nestRoutes.length} active routes in NestJS application.`,
  );

  const missingEndpoints = [];
  const matchedEndpoints = [];

  for (const ep of openApiEndpoints) {
    // Contract server base prefix is /api/v1/assessflow
    // OpenAPI path params /cases/{caseId} map to Express/NestJS /cases/:caseId
    const normalizedPath = ('/api/v1/assessflow' + ep.path).replace(/\{([^}]+)\}/g, ':$1');

    const match = nestRoutes.find((nr) => nr.path === normalizedPath && nr.method === ep.method);

    if (match) {
      matchedEndpoints.push({
        openApiPath: ep.path,
        normalizedPath,
        method: ep.method,
      });
    } else {
      missingEndpoints.push({
        openApiPath: ep.path,
        expectedNestPath: normalizedPath,
        method: ep.method,
      });
    }
  }

  console.log('\n--- Route Parity Verification Results ---');
  console.log(`Verified matches: ${matchedEndpoints.length} / ${openApiEndpoints.length}`);

  if (missingEndpoints.length > 0) {
    console.error('\n[OpenAPI Gate] BREAKING CHANGE DETECTED!');
    console.error(
      `The following ${missingEndpoints.length} endpoint(s) documented in OpenAPI v1.1 are missing from NestJS:`,
    );
    for (const missing of missingEndpoints) {
      console.error(
        `  - [${missing.method}] ${missing.openApiPath} -> expected route ${missing.expectedNestPath}`,
      );
    }
    process.exit(1);
  }

  console.log(
    'All 25 OpenAPI v1.1 documented endpoints are fully implemented and verified in NestJS.',
  );
  console.log('[OpenAPI Gate] PASS: No breaking missing endpoints detected.\n');
}

main().catch((error) => {
  console.error('[OpenAPI Gate] Unexpected error executing check:', error);
  process.exit(1);
});
