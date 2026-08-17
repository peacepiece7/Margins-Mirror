import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => reject(new Error(`${cmd} failed to start: ${error.message}`)));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`));
    });
  });
}

async function canLaunchChromium() {
  let browser;
  try {
    browser = await chromium.launch();
    return true;
  } catch (error) {
    console.warn(`Playwright Chromium launch preflight failed: ${error.message}`);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

if (!(await canLaunchChromium())) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  await run(npx, ['playwright', 'install', 'chromium']);
}

if (!(await canLaunchChromium())) {
  throw new Error('Playwright Chromium is still unavailable after installation.');
}

console.log('Playwright Chromium is installed and launchable.');
