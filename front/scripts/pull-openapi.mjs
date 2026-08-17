import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontRoot = resolve(scriptDir, '..');
const outputPath = resolve(frontRoot, 'src/types/__generated__/openapi.json');
const apiDocsUrl = process.env.MARGINS_OPENAPI_URL || 'http://localhost:8080/v3/api-docs';

const response = await fetch(apiDocsUrl, {
  headers: { Accept: 'application/json' },
});

if (!response.ok) {
  throw new Error(`Failed to fetch OpenAPI spec from ${apiDocsUrl}: ${response.status}`);
}

const spec = await response.json();
const requiredPaths = [
  '/api/auth/login',
  '/api/reading-sessions',
  '/api/reading-sessions/{id}/metrics/snapshot',
  '/api/session-windows/{id}/messages/stream',
  '/api/personas',
];

if (spec?.info?.title !== 'Margins API') {
  throw new Error(
    `Unexpected OpenAPI title from ${apiDocsUrl}: ${spec?.info?.title || '<missing>'}`,
  );
}

for (const path of requiredPaths) {
  if (!spec?.paths?.[path]) {
    throw new Error(`OpenAPI spec from ${apiDocsUrl} is missing required path: ${path}`);
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

console.log(`Wrote ${outputPath}`);
