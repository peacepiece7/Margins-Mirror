import { createReadStream } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { distribution, prepareGradleDistribution } from './gradle-distribution.mjs';
import { isolatedTestEnvironment, replaceProcessEnvironment } from './test-environment.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const frontRoot = join(repoRoot, 'front');
const backRoot = join(repoRoot, 'back');
const toolsDir = join(repoRoot, '.tools');
const gradleVersion = process.env.MARGINS_GRADLE_VERSION || distribution.version;
const gradleName = `gradle-${gradleVersion}`;
const gradleRoot = join(toolsDir, gradleName);

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);
let frontDotEnv = {};

/** 로컬 명령의 단일 값 option을 읽는다. */
function argumentValue(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

/** 현재 운영체제에 맞는 npm/npx 명령 이름을 결정한다. */
function bin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

/** 윈도우 명령 셸을 통해 실행해야 하는 명령 shim을 감지한다. */
function usesWindowsCommandShell(cmd) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
}

/** 프론트 도구에는 백엔드의 DB, 인증, provider 환경 변수를 상속하지 않는다. */
function frontendToolEnv() {
  const allowed = new Set([
    'PATH', 'HOME', 'USER', 'USERNAME', 'SHELL', 'LANG', 'LC_ALL', 'CI',
    'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'COMSPEC', 'PATHEXT', 'NODE_OPTIONS',
    'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy',
    'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS',
  ]);
  return Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => allowed.has(key) || /^(npm_config_|NPM_CONFIG_|COREPACK_)/.test(key)));
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
      env: { ...(options.cwd === frontRoot ? frontendToolEnv() : process.env), ...options.env },
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

/** 고정된 Gradle 배포본이 로컬에 있고 실행 가능한지 보장한다. */
async function ensureGradle() {
  await prepareGradleDistribution({ toolsRoot: toolsDir, version: gradleVersion, execute: run });
}

/** 백엔드 테스트와 로컬 서비스에 필요한 무시되는 로컬 환경 변수 값을 읽는다. */
async function readDotEnv(envPath) {
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

/** 프론트 설정 파일에는 브라우저 공개값과 개발 서버 연결값만 둔다. */
function validateFrontEnv(env) {
  const allowed = new Set([
    'MARGINS_BACKEND_URL', 'MARGINS_FRONTEND_PORT',
    'VITE_MARGINS_TURNSTILE_SITE_KEY', 'VITE_MARGINS_REFLECTION_LOOP_ENABLED',
    'VITE_MARGINS_DEVELOPER_DEBUG_ENABLED',
  ]);
  for (const key of Object.keys(env)) {
    if (!allowed.has(key)) {
      throw new Error(`Frontend env must not contain backend-owned key ${key}.`);
    }
  }
}

/** local/dev 외부 서비스 정책에 필요한 값을 secret 출력 없이 검증한다. */
function validateLocalExternalConfig(env = process.env) {
  const exactValues = new Map([
    ['MARGINS_FRONTEND_PORT', '9613'],
    ['MARGINS_BACKEND_PORT', '5813'],
    ['MARGINS_BACKEND_URL', 'http://localhost:5813'],
    ['MARGINS_CORS_ALLOWED_ORIGIN', 'http://localhost:9613'],
    ['MARGINS_PUBLIC_BASE_URL', 'http://localhost:5813'],
    ['MARGINS_GOOGLE_OAUTH_FRONTEND_CALLBACK_URL', 'http://localhost:9613/auth/callback'],
    ['MARGINS_TURNSTILE_ALLOWED_HOSTNAMES', 'localhost'],
    ['MARGINS_EMAIL_VERIFICATION_ABUSE_PROTECTION_ENABLED', 'false'],
    ['MARGINS_MAIL_VERIFICATION_EXPOSE_CODE', 'false'],
    ['MARGINS_AI_PROVIDER', 'openai'],
  ]);
  const enabledKeys = [
    'MARGINS_GOOGLE_OAUTH_ENABLED',
    'MARGINS_MAIL_VERIFICATION_ENABLED',
    'MARGINS_CONTACT_ENABLED',
  ];
  const requiredCredentials = [
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
    'MARGINS_MAIL_FROM',
    'MARGINS_CONTACT_RECIPIENT',
    'VITE_MARGINS_TURNSTILE_SITE_KEY',
    'MARGINS_TURNSTILE_SECRET_KEY',
    'MARGINS_GOOGLE_CLIENT_ID',
    'MARGINS_GOOGLE_CLIENT_SECRET',
  ];
  const placeholderPattern = /^(change-me|placeholder|todo|example)(?:$|[-_])/i;

  for (const [key, expected] of exactValues) {
    if ((env[key] || '').trim() !== expected) {
      throw new Error(`Local external config requires ${key}=${expected}.`);
    }
  }
  for (const key of enabledKeys) {
    if ((env[key] || '').trim().toLowerCase() !== 'true') {
      throw new Error(`Local external config requires ${key}=true.`);
    }
  }
  for (const key of requiredCredentials) {
    const value = (env[key] || '').trim();
    if (!value) {
      throw new Error(`Local external config requires non-empty ${key}.`);
    }
    if (placeholderPattern.test(value)) {
      throw new Error(`Local external config requires a non-placeholder ${key}.`);
    }
  }

  console.log(`Local external service configuration passed. Configured keys: ${[
    ...exactValues.keys(),
    ...enabledKeys,
    ...requiredCredentials,
  ].sort().join(',')}`);
}

/** 일반 로컬 명령은 Docker MySQL에만 연결되도록 대상 표지와 URL을 함께 검증한다. */
function validateLocalDbConfig(env = process.env) {
  const port = Number(env.MARGINS_MYSQL_PORT);
  if (env.MARGINS_DB_TARGET !== 'local'
      || !Number.isInteger(port) || port < 1 || port > 65535
      || env.MARGINS_MYSQL_DATABASE !== 'margins'
      || env.MARGINS_MYSQL_USER !== 'margins'
      || !(env.MARGINS_MYSQL_PASSWORD || '').trim()
      || env.MARGINS_DB_URL !== `jdbc:mysql://127.0.0.1:${port}/margins?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`) {
    throw new Error('Local DB commands require an explicit local Docker MySQL target and matching loopback JDBC URL.');
  }
}

/** 공유 dev DB는 선택한 SSH tunnel을 통해서만 접근하고 자동 변경 작업을 실행하지 않는다. */
function validateSharedDevDbConfig(env = process.env) {
  const exactValues = new Map([
    ['MARGINS_DB_TARGET', 'shared-dev'],
    ['MARGINS_MYSQL_DATABASE', 'margins_dev'],
    ['MARGINS_MYSQL_USER', 'margins_dev'],
    ['SPRING_PROFILES_ACTIVE', 'prod,dev'],
    ['MARGINS_RUNTIME_ENVIRONMENT', 'development'],
    ['SERVER_ADDRESS', '127.0.0.1'],
    ['MARGINS_BACKEND_PORT', '5813'],
    ['MARGINS_FRONTEND_PORT', '9613'],
    ['MARGINS_BACKEND_URL', 'http://localhost:5813'],
    ['MARGINS_CORS_ALLOWED_ORIGIN', 'http://localhost:9613'],
    ['MARGINS_PUBLIC_BASE_URL', 'http://localhost:5813'],
    ['MARGINS_AI_PROVIDER', 'placeholder'],
    ['MARGINS_AUTH_COOKIE_SECURE', 'false'],
  ]);
  const disabledKeys = [
    'MARGINS_MAINTENANCE_ENABLED',
    'MARGINS_CATALOG_WORKER_ENABLED',
    'MARGINS_CATALOG_FIXTURE_ENABLED',
    'MARGINS_CATALOG_TEST_DATA',
    'MARGINS_MAIL_VERIFICATION_ENABLED',
    'MARGINS_MAIL_VERIFICATION_EXPOSE_CODE',
    'MARGINS_CONTACT_ENABLED',
    'MARGINS_GOOGLE_OAUTH_ENABLED',
    'MARGINS_GOOGLE_MOBILE_OAUTH_ENABLED',
    'MARGINS_NATIVE_TURNSTILE_BRIDGE_ENABLED',
    'LANGFUSE_ENABLED',
  ];
  for (const [key, expected] of exactValues) {
    if (env[key] !== expected) throw new Error(`Shared dev DB requires ${key}=${expected}.`);
  }
  for (const key of disabledKeys) {
    if (env[key] !== 'false') throw new Error(`Shared dev DB requires ${key}=false.`);
  }
  if (env.MARGINS_AUTH_COOKIE_DOMAIN) {
    throw new Error('Shared dev DB requires an empty MARGINS_AUTH_COOKIE_DOMAIN.');
  }

  const password = (env.MARGINS_MYSQL_PASSWORD || '').trim();
  if (!password || /^(change-me|placeholder|todo|example|margins-pass)(?:$|[-_])/i.test(password)) {
    throw new Error('Shared dev DB requires a non-placeholder MARGINS_MYSQL_PASSWORD.');
  }

  const port = Number(env.MARGINS_SHARED_DEV_DB_TUNNEL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Shared dev DB requires a valid MARGINS_SHARED_DEV_DB_TUNNEL_PORT.');
  }
  let jdbc;
  try {
    const raw = env.MARGINS_DB_URL || '';
    if (!raw.startsWith('jdbc:mysql://')) throw new Error('invalid scheme');
    jdbc = new URL(raw.slice('jdbc:'.length));
  } catch {
    throw new Error('Shared dev DB requires a valid loopback MySQL MARGINS_DB_URL.');
  }
  if (jdbc.protocol !== 'mysql:' || jdbc.hostname !== '127.0.0.1'
      || jdbc.port !== String(port) || jdbc.pathname !== '/margins_dev'
      || jdbc.username || jdbc.password || jdbc.hash
      || jdbc.searchParams.size !== 3
      || jdbc.searchParams.get('useSSL') !== 'false'
      || jdbc.searchParams.get('allowPublicKeyRetrieval') !== 'true'
      || jdbc.searchParams.get('serverTimezone') !== 'UTC') {
    throw new Error('Shared dev DB requires MARGINS_DB_URL to target only the configured loopback tunnel and margins_dev.');
  }
  return port;
}

/** YAML과 동일한 공유 DB 안전 기본값을 root 실행에도 강제 검증한다. */
function applySharedDevSafetyDefaults() {
  const safeDefaults = {
    MARGINS_RUNTIME_ENVIRONMENT: 'development',
    SERVER_ADDRESS: '127.0.0.1',
    MARGINS_BACKEND_PORT: '5813',
    MARGINS_CORS_ALLOWED_ORIGIN: 'http://localhost:9613',
    MARGINS_PUBLIC_BASE_URL: 'http://localhost:5813',
    MARGINS_AI_PROVIDER: 'placeholder',
    MARGINS_AUTH_COOKIE_SECURE: 'false',
    MARGINS_AUTH_COOKIE_DOMAIN: '',
    MARGINS_MAINTENANCE_ENABLED: 'false',
    MARGINS_CATALOG_WORKER_ENABLED: 'false',
    MARGINS_CATALOG_FIXTURE_ENABLED: 'false',
    MARGINS_CATALOG_TEST_DATA: 'false',
    MARGINS_MAIL_VERIFICATION_ENABLED: 'false',
    MARGINS_MAIL_VERIFICATION_EXPOSE_CODE: 'false',
    MARGINS_CONTACT_ENABLED: 'false',
    MARGINS_GOOGLE_OAUTH_ENABLED: 'false',
    MARGINS_GOOGLE_MOBILE_OAUTH_ENABLED: 'false',
    MARGINS_NATIVE_TURNSTILE_BRIDGE_ENABLED: 'false',
    LANGFUSE_ENABLED: 'false',
  };
  for (const [key, value] of Object.entries(safeDefaults)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** SSH tunnel을 소유하지 않고, 운영자가 만든 loopback listener만 확인한다. */
async function requireSharedDevTunnel(port) {
  await new Promise((resolveTunnel, rejectTunnel) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(3000);
    socket.once('connect', () => {
      socket.destroy();
      resolveTunnel();
    });
    const reject = () => {
      socket.destroy();
      rejectTunnel(new Error('Shared dev SSH tunnel is not listening on the configured loopback port.'));
    };
    socket.once('error', reject);
    socket.once('timeout', reject);
  });
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
  if (process.env.MARGINS_DB_TARGET === 'shared-dev') {
    throw new Error('Shared dev DB target cannot run local Docker/schema/seed commands.');
  }
  validateLocalDbConfig();
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
  if (process.env.MARGINS_DB_TARGET === 'shared-dev') {
    throw new Error('Shared dev DB target cannot run local Docker commands.');
  }
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
      SPRING_PROFILES_ACTIVE: task === 'bootRun' ? process.env.SPRING_PROFILES_ACTIVE || 'local' : 'test',
      MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED:
        process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED || 'true',
    },
  });
}

/** 일상적인 로컬 개발을 위해 database, 백엔드, frontend를 시작한다. */
async function dev() {
  if (process.env.MARGINS_DB_TARGET === 'shared-dev') {
    throw new Error('Use npm run local:shared-dev for the shared dev DB target.');
  }
  validateLocalExternalConfig({ ...process.env, ...frontDotEnv });
  validateLocalDbConfig();
  await dbUp({ applySchema: true });
  await startWebStack();
}

/** 공유 dev DB 접속은 Docker/seed 없이, 로컬 전용 session identity로만 시작한다. */
async function sharedDev() {
  const port = validateSharedDevDbConfig({ ...process.env, ...frontDotEnv });
  await requireSharedDevTunnel(port);
  process.env.MARGINS_AUTH_JWT_SECRET = randomBytes(48).toString('hex');
  process.env.MARGINS_AUTH_CHALLENGE_SECRET = randomBytes(48).toString('hex');
  process.env.MARGINS_AUTH_JWT_ISSUER = 'margins-local-shared-dev';
  await startWebStack({ sharedDevDb: true });
}

/** 백엔드/프론트 시작과 종료 처리는 두 DB 경로가 공유한다. */
async function startWebStack({ sharedDevDb = false } = {}) {
  await ensureGradle();
  const frontendEnv = frontendToolEnv();

  const backend = spawn(gradleBin(), ['--no-daemon', 'bootRun'], {
    cwd: backRoot,
    env: {
      ...process.env,
      SPRING_PROFILES_ACTIVE: sharedDevDb ? 'prod,dev' : process.env.SPRING_PROFILES_ACTIVE || 'local',
      MARGINS_DEVELOPER_DEBUG_ENABLED: 'true',
      MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED: sharedDevDb ? 'false' : process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED || 'true',
    },
    stdio: 'inherit',
    shell: usesWindowsCommandShell(gradleBin()),
  });
  const frontend = spawn(bin('npm'), ['run', sharedDevDb ? 'dev:shared-dev' : 'dev'], {
    cwd: frontRoot,
    env: {
      ...frontendEnv,
      VITE_MARGINS_DEVELOPER_DEBUG_ENABLED: 'true',
    },
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
  const localTest = ['back-test', 'back-test-integration', 'quality'].includes(command);
  if (localTest) replaceProcessEnvironment(isolatedTestEnvironment(process.env));
  const isolated = localTest || process.env.MARGINS_VERIFICATION_ISOLATED === 'true';
  const sharedMode = ['shared-dev', 'shared-dev-config'].includes(command);
  const localEnvPath = argumentValue('--env-path', join(backRoot, sharedMode ? '.env.dev' : '.env'));
  const frontEnvPath = argumentValue('--front-env-path', join(frontRoot, sharedMode ? '.env.dev' : '.env'));
  if (['shared-dev', 'shared-dev-config'].includes(command) && !(await exists(localEnvPath))) {
    throw new Error('Shared dev DB requires an ignored back/.env.dev file.');
  }
  if (['dev', 'shared-dev', 'shared-dev-config', 'external-config'].includes(command)) {
    if (!(await exists(frontEnvPath))) {
      throw new Error('Frontend development requires an ignored front/.env or front/.env.dev file.');
    }
    frontDotEnv = await readDotEnv(frontEnvPath);
    validateFrontEnv(frontDotEnv);
  }
  const backDotEnv = isolated ? {} : await readDotEnv(localEnvPath);
  for (const [key, value] of Object.entries(backDotEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  if (sharedMode) applySharedDevSafetyDefaults();

  if (process.env.MARGINS_DB_TARGET === 'shared-dev'
      && !['shared-dev', 'shared-dev-config', 'help'].includes(command)) {
    throw new Error('Shared dev DB target may only use the guarded shared-dev command.');
  }

  if (command === 'help') {
    console.log('Commands: doctor, install, db-up, db-down, back-test, back-test-integration, back-test-live, back-dev, dev, local-db-config, shared-dev-config, shared-dev, external-config, quality');
    return;
  }
  if (command === 'doctor') return doctor();
  if (command === 'install') return install();
  if (command === 'db-up') return dbUp({ applySchema: args.includes('--apply-schema') });
  if (command === 'db-down') return dbDown();
  if (command === 'back-test') return gradleTask(args[0] || 'test');
  if (command === 'back-test-integration') return gradleTask('integrationTest');
  if (command === 'back-test-live') {
    if (isolated) throw new Error('Live integration tests are outside the isolated local gate.');
    return gradleTask('liveIntegrationTest');
  }
  if (command === 'back-dev') {
    validateLocalDbConfig();
    return gradleTask('bootRun');
  }
  if (command === 'dev') return dev();
  if (command === 'local-db-config') {
    validateLocalDbConfig();
    console.log('Local Docker DB configuration passed. No database connection was made.');
    return;
  }
  if (command === 'shared-dev-config') {
    validateSharedDevDbConfig({ ...process.env, ...frontDotEnv });
    console.log('Shared dev DB configuration passed. No database connection was made.');
    return;
  }
  if (command === 'shared-dev') return sharedDev();
  if (command === 'external-config') return validateLocalExternalConfig({ ...process.env, ...frontDotEnv });
  if (command === 'quality') return quality();

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
