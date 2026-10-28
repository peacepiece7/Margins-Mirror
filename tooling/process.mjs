import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
export const repoRoot = fileURLToPath(new URL("../", import.meta.url));
function usesWindowsCommandShell(cmd) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
}

export function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export async function run(cmd, cmdArgs = [], options = {}) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || repoRoot,
      env:
        options.inheritEnv === false
          ? options.env
          : { ...process.env, ...options.env },
      stdio: "inherit",
      shell: usesWindowsCommandShell(cmd),
    });
    child.on("error", (error) => {
      rejectRun(
        Object.assign(
          new Error(
            `${cmd} ${cmdArgs.join(" ")} failed to start: ${error.message}`,
          ),
          { exitCode: null },
        ),
      );
    });
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          Object.assign(
            new Error(
              `${cmd} ${cmdArgs.join(" ")} failed with exit code ${code}`,
            ),
            { exitCode: code, signal },
          ),
        );
    });
  });
}

export async function capture(cmd, cmdArgs = [], options = {}) {
  return await new Promise((resolveRun) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: usesWindowsCommandShell(cmd),
      timeout: options.timeout,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdin.end();
    child.on("error", (error) =>
      resolveRun({ ok: false, stdout, stderr, error }),
    );
    child.on("close", (code) =>
      resolveRun({ ok: code === 0, code, stdout, stderr }),
    );
  });
}
