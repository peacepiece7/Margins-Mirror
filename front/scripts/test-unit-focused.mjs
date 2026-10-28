import { realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function resolveTestFiles(args, front) {
  if (!args.length)
    throw new Error('Provide explicit src/**/*.test.ts or src/**/*.test.tsx files.');
  const root = await realpath(front);
  const files = [];
  for (const arg of args) {
    if (arg.startsWith('-') || !/\.test\.tsx?$/.test(arg))
      throw new Error(
        'Focused unit tests accept test file paths only, without flags or directories.',
      );
    const target = await realpath(path.resolve(root, arg.replaceAll('\\', '/')));
    const relative = path.relative(root, target).split(path.sep).join('/');
    if (
      !relative.startsWith('src/') ||
      !/\.test\.tsx?$/.test(relative) ||
      !(await stat(target)).isFile()
    )
      throw new Error('Focused test files must stay inside frontend src.');
    files.push(target);
  }
  return [...new Set(files)];
}

export async function runFocusedUnit(
  args,
  {
    front = path.resolve(import.meta.dirname, '..'),
    loadVitest = async (root) => {
      const require = createRequire(path.join(root, 'package.json'));
      return import(pathToFileURL(require.resolve('vitest/node')).href);
    },
  } = {},
) {
  front = await realpath(front);
  const files = await resolveTestFiles(args, front);
  process.env.TEST = 'true';
  process.env.VITEST = 'true';
  process.env.NODE_ENV ??= 'test';
  const { createVitest } = await loadVitest(front);
  const vitest = await createVitest('test', {
    root: front,
    config: path.join(front, 'vitest.config.ts'),
    run: true,
    watch: false,
    passWithNoTests: false,
  });
  try {
    await vitest.standalone();
    const identity = (file) => path.normalize(file);
    const selected = new Set(files.map(identity));
    // Vitest CLI filters match substrings; keep only the exact requested module IDs.
    const specifications = (await vitest.globTestSpecifications(files)).filter((spec) =>
      selected.has(identity(spec.moduleId)),
    );
    if (
      files.some(
        (file) => !specifications.some((spec) => identity(spec.moduleId) === identity(file)),
      )
    )
      throw new Error('A requested file is not included by the frontend unit configuration.');
    return await vitest.runTestSpecifications(specifications);
  } finally {
    await vitest.close();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await runFocusedUnit(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
