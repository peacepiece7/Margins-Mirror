const backendUrl = process.env.MARGINS_BACKEND_URL || 'http://localhost:8080';

async function checkJson(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    throw new Error(
      `${url} is not reachable. Start the backend before running E2E, or run npm run local:dev from the repository root. ${error.message}`,
    );
  }
}

const healthResponse = await checkJson(`${backendUrl}/api/health`);
if (!healthResponse.ok) {
  throw new Error(`Backend health check failed with HTTP ${healthResponse.status}.`);
}

const resetResponse = await checkJson(`${backendUrl}/api/test/reset`, { method: 'POST' });
if (!resetResponse.ok) {
  throw new Error(
    `E2E reset endpoint failed with HTTP ${resetResponse.status}. Start the backend with SPRING_PROFILES_ACTIVE=local or test, or run npm run local:dev from the repository root.`,
  );
}

console.log(`E2E prerequisites ready: ${backendUrl}`);
