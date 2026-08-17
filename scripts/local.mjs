import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { get } from 'node:https';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const frontRoot = join(repoRoot, 'front');
const backRoot = join(repoRoot, 'back');
const toolsDir = join(repoRoot, '.tools');
const gradleVersion = process.env.MARGINS_GRADLE_VERSION || '8.10.2';
const gradleName = `gradle-${gradleVersion}`;
const gradleRoot = join(toolsDir, gradleName);
const gradleZip = join(toolsDir, `${gradleName}-bin.zip`);
const gradleUrl = `https://services.gradle.org/distributions/${gradleName}-bin.zip`;

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);
let dotEnv = {};

/** 현재 운영체제에 맞는 npm/npx 명령 이름을 결정한다. */
function bin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

/** 윈도우 명령 셸을 통해 실행해야 하는 명령 shim을 감지한다. */
function usesWindowsCommandShell(cmd) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
}

/** 캐시된 tool 디렉터리 아래의 운영체제별 Gradle launcher 경로를 반환한다. */
function gradleBin() {
  return join(gradleRoot, 'bin', process.platform === 'win32' ? 'gradle.bat' : 'gradle');
}

/** 호출자가 try/catch를 쓰지 않아도 되도록 로컬 경로 존재 여부를 확인한다. */
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 로컬 스크립트가 첫 실패 단계에서 멈추도록 명령 출력 스트리밍과 실패 처리를 수행한다. */
function run(cmd, cmdArgs = [], options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...options.env },
      stdio: options.stdio || 'inherit',
      shell: usesWindowsCommandShell(cmd),
    });

    child.on('error', (error) => {
      rejectRun(new Error(`${cmd} ${cmdArgs.join(' ')} failed to start: ${error.message}`));
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${cmd} ${cmdArgs.join(' ')} failed with exit code ${code}`));
      }
    });
  });
}

/** 사전 조건 검사와 MySQL 메타데이터 조회를 위해 명령 출력을 캡처한다. */
function capture(cmd, cmdArgs = [], options = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...options.env },
      stdio: options.input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      shell: usesWindowsCommandShell(cmd),
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    if (options.input) {
      child.stdin.end(options.input);
    }
    child.on('error', (error) => {
      resolveRun({ ok: false, stdout, stderr, error });
    });
    child.on('exit', (code) => {
      resolveRun({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/** 적용된 SQL이 수정됐는지 로컬 schema replay가 감지할 수 있도록 migration 파일 해시를 계산한다. */
async function sha256(path) {
  const hash = createHash('sha256');
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', rejectHash);
    stream.on('end', resolveHash);
  });
  return hash.digest('hex');
}

/** 마이그레이션 기록 SQL에 쓰는 문자열 literal을 escape한다. */
function sqlString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

/** 스키마 파일명에서 숫자 migration version을 추출한다. */
function schemaMigrationVersion(file) {
  const match = basename(file).match(/^(\d+)_/);
  if (!match) {
    throw new Error(`Schema migration file must start with a numeric version: ${basename(file)}`);
  }
  return match[1];
}

/** 배포 호스트의 redirect를 따라가며 tool archive를 다운로드한다. */
async function download(url, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await new Promise((resolveDownload, rejectDownload) => {
    const request = get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode || 0) && response.headers.location) {
        response.resume();
        download(response.headers.location, outputPath).then(resolveDownload, rejectDownload);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        rejectDownload(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const file = createWriteStream(outputPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolveDownload);
      });
      file.on('error', rejectDownload);
    });

    request.on('error', rejectDownload);
  });
}

/** 고정된 Gradle 배포본이 로컬에 있고 실행 가능한지 보장한다. */
async function ensureGradle() {
  if (await exists(gradleBin())) {
    if (process.platform !== 'win32') {
      await chmod(gradleBin(), 0o755);
    }
    return;
  }

  await mkdir(toolsDir, { recursive: true });
  if (!(await exists(gradleZip))) {
    console.log(`Downloading ${gradleUrl}`);
    await download(gradleUrl, gradleZip);
  }

  console.log(`Extracting ${gradleZip}`);
  await rm(gradleRoot, { recursive: true, force: true });
  await run('jar', ['xf', gradleZip], { cwd: toolsDir });
  if (!(await exists(gradleBin()))) {
    throw new Error(`Gradle executable was not found after setup: ${gradleBin()}`);
  }
  if (process.platform !== 'win32') {
    await chmod(gradleBin(), 0o755);
  }
}

/** 로컬 명령이 프로젝트 기본값을 읽을 수 있도록 .env를 한 번 로드한다. */
function loadDotEnv() {
  return dotEnv;
}

/** 백엔드 테스트와 로컬 서비스에 필요한 무시되는 로컬 환경 변수 값을 읽는다. */
async function readDotEnv() {
  const envPath = join(repoRoot, '.env');
  if (!(await exists(envPath))) {
    return {};
  }

  const env = {};
  const text = await readFile(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

/** 서비스나 테스트를 시작하기 전에 누락된 로컬 사전 조건을 보고한다. */
async function doctor() {
  const checks = [
    ['node', ['--version']],
    [bin('npm'), ['--version']],
    ['java', ['-version']],
    ['jar', ['--version']],
    ['docker', ['--version']],
    ['docker', ['compose', 'version']],
  ];

  let failed = false;
  for (const [cmdName, cmdArgs] of checks) {
    const result = await capture(cmdName, cmdArgs);
    const output = `${result.stdout}${result.stderr}`.trim().split('\n')[0] || result.error?.message || '';
    if (result.ok) {
      console.log(`OK ${cmdName} ${cmdArgs.join(' ')}: ${output}`);
    } else {
      failed = true;
      console.log(`MISSING ${cmdName} ${cmdArgs.join(' ')}: ${output}`);
    }
  }

  if (failed) {
    throw new Error('Install missing prerequisites, then run npm run local:doctor again.');
  }
}

/** 프론트엔드 의존성, Playwright browser, 캐시된 Gradle 배포본을 설치한다. */
async function install() {
  await doctor();
  await ensureGradle();
  await run(bin('npm'), ['install'], { cwd: frontRoot });
  await run(bin('npx'), ['playwright', 'install'], { cwd: frontRoot });
}

/** 스키마 적용이나 백엔드 시작 전에 Docker MySQL 헬스체크를 기다린다. */
async function waitForMysql(containerName, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const result = await capture('docker', ['inspect', '--format', '{{.State.Health.Status}}', containerName]);
    if (result.ok && result.stdout.trim() === 'healthy') {
      console.log(`${containerName} is healthy`);
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2000));
  }
  throw new Error(`Timed out waiting for ${containerName} to become healthy.`);
}

/** SQL 파일 하나를 컨테이너로 복사하고 MySQL client로 실행한다. */
async function applySqlFile(containerName, database, rootPassword, filePath) {
  const containerDir = '/tmp/margins-sql';
  const containerFile = `${containerDir}/${basename(filePath)}`;
  await run('docker', ['exec', containerName, 'sh', '-c', `mkdir -p ${containerDir}`]);
  await run('docker', ['cp', filePath, `${containerName}:${containerFile}`]);
  await run('docker', [
    'exec',
    '-e',
    `MYSQL_PWD=${rootPassword}`,
    '-e',
    `MARGINS_SQL_FILE=${containerFile}`,
    '-e',
    `MARGINS_MYSQL_DATABASE=${database}`,
    containerName,
    'sh',
    '-c',
    'mysql --user=root --default-character-set=utf8mb4 "$MARGINS_MYSQL_DATABASE" < "$MARGINS_SQL_FILE"',
  ]);
}

/** migration history 조회/기록을 위해 로컬 MySQL에서 inline SQL을 실행한다. */
async function runMysql(containerName, database, rootPassword, sql, label) {
  const result = await capture('docker', [
    'exec',
    '-i',
    '-e',
    `MYSQL_PWD=${rootPassword}`,
    containerName,
    'mysql',
    '--user=root',
    '--default-character-set=utf8mb4',
    '--batch',
    '--raw',
    '--skip-column-names',
    database,
  ], { input: sql });
  if (!result.ok) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

/** 프로덕션 배포 스크립트와 공유하는 local migration history 테이블을 정의한다. */
function createSchemaMigrationsSql() {
  return `CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  version VARCHAR(40) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  checksum_sha256 CHAR(64) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_schema_migrations_version (version),
  UNIQUE KEY uk_schema_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
}

/** 기록된 checksum이 없을 때만 local schema migration 하나를 적용한다. */
async function applySchemaMigration(containerName, database, rootPassword, file) {
  const filename = basename(file);
  const version = schemaMigrationVersion(file);
  const checksum = await sha256(file);
  const recordedChecksum = await runMysql(
    containerName,
    database,
    rootPassword,
    `SELECT checksum_sha256 FROM schema_migrations WHERE filename = ${sqlString(filename)} LIMIT 1;`,
    `schema migration lookup ${filename}`,
  );

  if (recordedChecksum) {
    if (recordedChecksum !== checksum) {
      throw new Error(`Schema migration checksum mismatch for ${filename}. Refusing to reapply an edited migration.`);
    }
    console.log(`Skipping already applied schema migration ${filename}`);
    return;
  }

  console.log(`Applying ${file}`);
  await applySqlFile(containerName, database, rootPassword, file);
  await runMysql(
    containerName,
    database,
    rootPassword,
    `INSERT INTO schema_migrations (version, filename, checksum_sha256)
VALUES (${sqlString(version)}, ${sqlString(filename)}, ${sqlString(checksum)});`,
    `schema migration record ${filename}`,
  );
}

/** 로컬 MySQL을 시작하고 선택적으로 schema migration과 결정적 seed data를 적용한다. */
async function dbUp({ applySchema = false, timeoutSeconds = 120 } = {}) {
  const composeFile = join(repoRoot, 'infra', 'docker', 'mysql-compose.yml');
  const containerName = process.env.MARGINS_MYSQL_CONTAINER_NAME || 'margins-mysql';
  const database = process.env.MARGINS_MYSQL_DATABASE || 'margins';
  const rootPassword = process.env.MARGINS_MYSQL_ROOT_PASSWORD || 'margins-root';
  const port = process.env.MARGINS_MYSQL_PORT || '3306';

  await run('docker', ['compose', '-f', composeFile, 'up', '-d', 'mysql']);
  await waitForMysql(containerName, timeoutSeconds);

  if (applySchema) {
    const schemaDir = join(repoRoot, 'db', 'schema');
    const schemaFiles = (await readdir(schemaDir))
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => join(schemaDir, file));
    const seedFile = join(repoRoot, 'db', 'seed', '001_seed_mvp_data.sql');

    await runMysql(containerName, database, rootPassword, createSchemaMigrationsSql(), 'schema migration history bootstrap');
    for (const file of schemaFiles) {
      await stat(file);
      await applySchemaMigration(containerName, database, rootPassword, file);
    }
    await stat(seedFile);
    console.log(`Applying ${seedFile}`);
    await applySqlFile(containerName, database, rootPassword, seedFile);
  }

  console.log(`MySQL is ready on port ${port}`);
}

/** 로컬 MySQL을 중지하고 요청된 경우 volume도 제거한다. */
async function dbDown() {
  const composeFile = join(repoRoot, 'infra', 'docker', 'mysql-compose.yml');
  const downArgs = ['compose', '-f', composeFile, 'down'];
  if (args.includes('--volumes')) {
    downArgs.push('--volumes');
  }
  await run('docker', downArgs);
}

/** 로컬/테스트 프로필 기본값으로 백엔드 Gradle task를 실행한다. */
async function gradleTask(task = 'test') {
  await ensureGradle();
  await run(gradleBin(), ['--no-daemon', task], {
    cwd: backRoot,
    env: {
      SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE || 'test',
      MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED:
        process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED || 'true',
    },
  });
}

/** 일상적인 로컬 개발을 위해 database, 백엔드, frontend를 시작한다. */
async function dev() {
  await dbUp({ applySchema: true });
  await ensureGradle();

  const backend = spawn(gradleBin(), ['--no-daemon', 'bootRun'], {
    cwd: backRoot,
    env: {
      ...process.env,
      SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE || 'local',
      MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED: process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED || 'true',
    },
    stdio: 'inherit',
    shell: usesWindowsCommandShell(gradleBin()),
  });
  const frontend = spawn(bin('npm'), ['run', 'dev'], {
    cwd: frontRoot,
    env: { ...process.env, MARGINS_BACKEND_URL: process.env.MARGINS_BACKEND_URL || 'http://localhost:8080' },
    stdio: 'inherit',
    shell: usesWindowsCommandShell(bin('npm')),
  });

  const stop = () => {
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await new Promise((resolveDev, rejectDev) => {
    let settled = false;
    for (const [name, child] of [
      ['backend', backend],
      ['frontend', frontend],
    ]) {
      child.on('error', (error) => {
        if (settled) {
          return;
        }
        settled = true;
        rejectDev(new Error(`${name} failed to start: ${error.message}`));
      });
      child.on('exit', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        stop();
        if (code === 0 || code === null) {
          resolveDev();
        } else {
          rejectDev(new Error(`${name} exited with code ${code}`));
        }
      });
    }
  });
}

/** 기능 테스트와 분리된 일상용 compile, format, lint, type, build 검사를 실행한다. */
async function quality() {
  await gradleTask('classes');
  await run(bin('npm'), ['run', 'format:check'], { cwd: frontRoot });
  await run(bin('npm'), ['run', 'lint'], { cwd: frontRoot });
  await run(bin('npm'), ['run', 'build'], { cwd: frontRoot });
}

/** 루트 npm local:* 명령을 실행한다. */
async function main() {
  dotEnv = await readDotEnv();
  for (const [key, value] of Object.entries(dotEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (command === 'help') {
    console.log('Commands: doctor, install, db-up, db-down, back-test, back-test-integration, back-dev, dev, quality');
    return;
  }
  if (command === 'doctor') return doctor();
  if (command === 'install') return install();
  if (command === 'db-up') return dbUp({ applySchema: args.includes('--apply-schema') });
  if (command === 'db-down') return dbDown();
  if (command === 'back-test') return gradleTask(args[0] || 'test');
  if (command === 'back-test-integration') return gradleTask('integrationTest');
  if (command === 'back-dev') return gradleTask('bootRun');
  if (command === 'dev') return dev();
  if (command === 'quality') return quality();

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
