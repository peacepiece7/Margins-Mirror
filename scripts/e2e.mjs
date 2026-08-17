import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { Socket } from 'node:net';

const args = process.argv.slice(2);

function readArg(names, fallback) {
  for (let index = 0; index < args.length; index += 1) {
    if (names.includes(args[index])) return args[index + 1] ?? fallback;
  }
  return fallback;
}

const mysqlPort = readArg(['--mysql-port', '-MysqlPort'], '3307');
const backendPort = readArg(['--backend-port', '-BackendPort'], '18080');
const frontendPort = readArg(['--frontend-port', '-FrontendPort'], '15173');
const timeoutSeconds = Number(readArg(['--timeout-seconds', '-TimeoutSeconds'], '180'));
const keepStarted = args.includes('--keep-started-processes') || args.includes('-KeepStartedProcesses');
const reuseExisting = args.includes('--reuse-existing-services') || args.includes('-ReuseExistingServices');
const allowThirdParty = process.env.MARGINS_E2E_ALLOW_THIRD_PARTY === 'true';

const isolatedThirdPartyEnv = {
  MARGINS_GOOGLE_OAUTH_ENABLED: 'false',
  MARGINS_MAIL_VERIFICATION_ENABLED: 'false',
  MARGINS_MAIL_VERIFICATION_EXPOSE_CODE: 'true',
  MARGINS_EMAIL_VERIFICATION_ABUSE_PROTECTION_ENABLED: 'true',
  MARGINS_TURNSTILE_SECRET_KEY: 'e2e-turnstile-secret',
  MARGINS_TURNSTILE_ALLOWED_HOSTNAMES: 'localhost',
  MARGINS_EMAIL_VERIFICATION_RATE_LIMIT_SECRET: 'e2e-rate-limit-secret',
  VITE_MARGINS_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  MARGINS_BOOK_SEARCH_ENABLED: 'false',
  MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED: 'true',
  MARGINS_AI_PROVIDER: 'placeholder',
  MARGINS_REFLECTION_LOOP_ENABLED: 'true',
  VITE_MARGINS_REFLECTION_LOOP_ENABLED: 'true',
  OPENAI_API_KEY: '',
  GOOGLE_BOOKS_API_KEY: '',
};

function thirdPartyEnv() {
  return allowThirdParty ? {} : isolatedThirdPartyEnv;
}

async function startTurnstileStub() {
  const usedTokens = new Set();
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/siteverify') {
      response.writeHead(404).end();
      return;
    }
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      const form = new URLSearchParams(body);
      const token = form.get('response') || '';
      const secretAccepted = form.get('secret') === isolatedThirdPartyEnv.MARGINS_TURNSTILE_SECRET_KEY;
      const duplicate = usedTokens.has(token);
      const invalid = !secretAccepted || !token.startsWith('e2e-turnstile-');
      if (!invalid && !duplicate) usedTokens.add(token);
      const payload = invalid || duplicate
        ? { success: false, 'error-codes': [duplicate ? 'timeout-or-duplicate' : 'invalid-input-response'] }
        : {
            success: true,
            action: token.includes('-wrong-action-') ? 'unexpected_action' : 'email_verification',
            hostname: token.includes('-wrong-hostname-') ? 'evil.example' : 'localhost',
          };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Turnstile E2E stub did not expose a TCP port.');
  }
  return {
    server,
    url: `http://127.0.0.1:${address.port}/siteverify`,
  };
}

function bin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function usesWindowsCommandShell(cmd) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
}

async function run(cmd, cmdArgs = [], options = {}) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      shell: usesWindowsCommandShell(cmd),
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${cmd} ${cmdArgs.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function httpOk(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

async function tcpOpen(port) {
  return await new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(Number(port), '127.0.0.1');
  });
}

async function waitHttp(name, url) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    if (await httpOk(url)) {
      console.log(`${name} is ready: ${url}`);
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 2000));
  }
  throw new Error(`Timed out waiting for ${name} at ${url}`);
}

function start(name, cmd, cmdArgs, options = {}) {
  console.log(`Starting ${name}`);
  const child = spawn(cmd, cmdArgs, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    shell: usesWindowsCommandShell(cmd),
  });
  child.once('error', (error) => {
    console.error(`${name} failed to start: ${error.message}`);
  });
  return child;
}

function waitForExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    function onExit() {
      clearTimeout(timeout);
      resolve(true);
    }

    child.once('exit', onExit);
  });
}

async function stop(child) {
  if (!child?.pid) return;

  if (process.platform === 'win32') {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
      killer.on('error', resolve);
      killer.on('exit', resolve);
    });
    await waitForExit(child, 5000);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`Failed to send SIGTERM to process group ${child.pid}: ${error.message}`);
    }
  }

  if (await waitForExit(child, 5000)) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`Failed to send SIGKILL to process group ${child.pid}: ${error.message}`);
    }
  }
  await waitForExit(child, 5000);
}

const started = [];
let turnstileStub;

try {
  process.env.MARGINS_MYSQL_PORT = mysqlPort;
  process.env.SPRING_PROFILES_ACTIVE = process.env.SPRING_PROFILES_ACTIVE || 'local';
  process.env.SERVER_PORT = backendPort;
  process.env.MARGINS_BACKEND_URL = `http://localhost:${backendPort}`;
  process.env.MARGINS_FRONTEND_PORT = frontendPort;
  process.env.MARGINS_FRONT_URL = `http://localhost:${frontendPort}`;
  if (!allowThirdParty) {
    turnstileStub = await startTurnstileStub();
    isolatedThirdPartyEnv.MARGINS_TURNSTILE_SITEVERIFY_URL = turnstileStub.url;
    Object.assign(process.env, isolatedThirdPartyEnv);
  } else {
    process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED = process.env.MARGINS_BOOK_SEARCH_AI_FALLBACK_ENABLED || 'true';
    process.env.MARGINS_MAIL_VERIFICATION_ENABLED = process.env.MARGINS_MAIL_VERIFICATION_ENABLED || 'false';
    process.env.MARGINS_MAIL_VERIFICATION_EXPOSE_CODE = process.env.MARGINS_MAIL_VERIFICATION_EXPOSE_CODE || 'true';
  }
  process.env.MARGINS_E2E_USERNAME = process.env.MARGINS_E2E_USERNAME || 'demo_reader';
  process.env.MARGINS_E2E_DISPLAY_NAME = process.env.MARGINS_E2E_DISPLAY_NAME || process.env.MARGINS_E2E_USERNAME;
  process.env.MARGINS_E2E_PASSWORD = process.env.MARGINS_E2E_PASSWORD || 'reader';

  const backendAlreadyOpen = await tcpOpen(backendPort);
  const frontendAlreadyOpen = await tcpOpen(frontendPort);
  if ((backendAlreadyOpen || frontendAlreadyOpen) && !reuseExisting) {
    throw new Error(`Backend/frontend port already in use. Stop stale services or pass --reuse-existing-services explicitly. Ports: ${backendPort}, ${frontendPort}`);
  }
  if (reuseExisting && backendAlreadyOpen && !(await httpOk(`http://localhost:${backendPort}/api/health`))) {
    throw new Error(`Backend port ${backendPort} is occupied but did not answer the expected health check.`);
  }
  if (reuseExisting && frontendAlreadyOpen && !(await httpOk(`http://localhost:${frontendPort}`))) {
    throw new Error(`Frontend port ${frontendPort} is occupied but did not answer the expected HTTP check.`);
  }

  await run('node', ['scripts/local.mjs', 'db-up', '--apply-schema']);

  if (!backendAlreadyOpen) {
    const backend = start('backend', 'node', ['scripts/local.mjs', 'back-dev'], {
      env: {
        MARGINS_MYSQL_PORT: mysqlPort,
        SERVER_PORT: backendPort,
        SPRING_PROFILES_ACTIVE: process.env.SPRING_PROFILES_ACTIVE,
        MARGINS_REFLECTION_LOOP_ENABLED: 'true',
        ...thirdPartyEnv(),
      },
    });
    started.push(backend);
  }
  await waitHttp('Backend', `http://localhost:${backendPort}/api/health`);

  if (!frontendAlreadyOpen) {
    const frontend = start('frontend', bin('npm'), ['run', 'dev'], {
      cwd: 'front',
      env: {
        MARGINS_BACKEND_URL: `http://localhost:${backendPort}`,
        MARGINS_FRONTEND_PORT: frontendPort,
        VITE_MARGINS_REFLECTION_LOOP_ENABLED: 'true',
      },
    });
    started.push(frontend);
  }
  await waitHttp('Frontend', `http://localhost:${frontendPort}`);

  await run(bin('npm'), ['run', 'e2e'], {
    cwd: 'front',
    env: {
      MARGINS_BACKEND_URL: `http://localhost:${backendPort}`,
      MARGINS_FRONTEND_PORT: frontendPort,
      MARGINS_FRONT_URL: `http://localhost:${frontendPort}`,
      VITE_MARGINS_REFLECTION_LOOP_ENABLED: 'true',
    },
  });
  console.log('PASS: full-stack E2E completed.');
} finally {
  if (!keepStarted) {
    for (const child of started.reverse()) {
      await stop(child);
    }
  }
  if (turnstileStub) {
    await new Promise((resolve) => turnstileStub.server.close(resolve));
  }
}
