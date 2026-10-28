import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The Vite production boundary also checks the actual module graph at build time.
await access('dist/index.html');
const project = JSON.parse(await readFile('storybook-static/project.json', 'utf8'));
assert.equal(
  project.framework.options.builder.viteConfigPath,
  '.storybook/vite.config.ts',
  'Public Storybook metadata must use a project-relative Vite config path',
);
assert.equal(
  (await readFile('storybook-static/iframe.html', 'utf8')).includes(resolve('.')),
  false,
  'Public Storybook preview must not expose the local checkout path',
);
const index = JSON.parse(await readFile('storybook-static/index.json', 'utf8'));
const entries = Object.values(index.entries);
const storyFiles = new Set(
  entries.filter((entry) => entry.type === 'story').map((entry) => entry.importPath),
);
const primitives = (await readdir('src/components/ui')).filter(
  (name) =>
    name.endsWith('.tsx') &&
    !name.includes('.test.') &&
    !name.includes('.stories.') &&
    !['legacy-skeleton.tsx', 'loading-spinner.tsx'].includes(name),
);
for (const file of primitives)
  assert.ok(
    storyFiles.has('./src/components/ui/' + file.replace('.tsx', '.stories.tsx')),
    'Missing active primitive story: ' + file,
  );
assert.ok(primitives.length >= 29);
assert.ok(
  entries.some((entry) => entry.title === '시작하기/Introduction' && entry.type === 'docs'),
);
assert.ok(
  entries.some((entry) => entry.title === '유지보수 가이드/Contributing' && entry.type === 'docs'),
);
for (const entry of entries.filter((entry) => entry.type === 'story'))
  assert.ok(
    entries.some((doc) => doc.type === 'docs' && doc.title === entry.title),
    'Missing usage docs: ' + entry.title,
  );
assert.equal(
  (await readdir('dist')).some((name) => /storybook|design-system/i.test(name)),
  false,
);
const assets = await readdir('dist/assets');
assert.equal(
  assets.some((name) => /storybook|\.stories|fixture|introduction|contributing/i.test(name)),
  false,
);
const contents = async (extension) =>
  (
    await Promise.all(
      assets
        .filter((name) => name.endsWith(extension))
        .map((name) => readFile(resolve('dist/assets', name), 'utf8')),
    )
  ).join('\n');
const js = await contents('.js'),
  css = await contents('.css');
for (const marker of [
  'storybook-canvas',
  'margins.storybook.ai-notice',
  'local-fixture-token',
  'AI 응답 표시 예제',
  '읽는 경험을 위한 공통 언어',
])
  assert.equal(js.includes(marker), false, 'Production includes fixture: ' + marker);
assert.equal(css.includes('[data-testid'), false, 'CSS cannot target stripped test selectors');
assert.equal(css.includes('fonts.googleapis.com'), false, 'Fonts must be bundled');
for (const id of [
  'app-download-notice',
  'app-download-action',
  'book-question-panel',
  'book-debate-entry',
]) {
  assert.ok(js.includes('"data-ui":"' + id + '"'), 'Production preserves ' + id);
  assert.ok(
    css.includes('data-ui=' + id) || css.includes('data-ui="' + id + '"'),
    'Production CSS targets ' + id,
  );
}
assert.ok(
  assets.some((name) => name.endsWith('.woff2')),
  'Application bundles fonts',
);
console.log(
  'PASS: 29 active primitives, localized docs, production isolation, bundled fonts and persistent style hooks',
);
