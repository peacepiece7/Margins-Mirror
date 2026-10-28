import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import { get } from "node:https";
import { join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import { repoRoot, run } from "../process.mjs";

export const distribution = JSON.parse(
  await readFile(
    new URL("./gradle-distribution.json", import.meta.url),
    "utf8",
  ),
);
const versionPattern = /^\d+\.\d+(?:\.\d+)?(?:-(?:rc|milestone)-\d+)?$/;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function appendFile(hash, path) {
  for await (const bytes of createReadStream(path)) hash.update(bytes);
}

export async function archiveDigest(path) {
  const hash = createHash("sha256");
  await appendFile(hash, path);
  return hash.digest("hex");
}

/** Sorted relative path + NUL + fixed-length file SHA-256 hex + NUL; excludes modes/empty directories. */
export async function distributionDigest(root) {
  if (!(await lstat(root)).isDirectory())
    throw new Error("Gradle distribution root must be a regular directory.");
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile())
        files.push(relative(root, path).replaceAll("\\", "/"));
      else throw new Error("Gradle distribution contains a non-regular entry.");
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  for (const path of files.sort()) {
    hash.update(path + "\0");
    hash.update(await archiveDigest(join(root, path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function download(url, output, redirects = 0) {
  if (redirects > 10)
    throw new Error("Gradle distribution redirect limit exceeded.");
  await new Promise((resolveDownload, rejectDownload) => {
    const request = get(url, (response) => {
      if (
        [301, 302, 303, 307, 308].includes(response.statusCode) &&
        response.headers.location
      ) {
        response.resume();
        download(
          new URL(response.headers.location, url),
          output,
          redirects + 1,
        ).then(resolveDownload, rejectDownload);
      } else if (response.statusCode !== 200) {
        response.resume();
        rejectDownload(
          new Error(
            `Gradle distribution download failed with HTTP ${response.statusCode}.`,
          ),
        );
      } else {
        pipeline(response, createWriteStream(output)).then(
          resolveDownload,
          rejectDownload,
        );
      }
    });
    request.on("error", rejectDownload);
  });
}

/** CI validates an existing restore once; ordinary local commands retain their warm fast path. */
export async function prepareGradleDistribution({
  toolsRoot = join(repoRoot, ".tools"),
  version = process.env.MARGINS_GRADLE_VERSION || distribution.version,
  validateExisting = false,
  platform = process.platform,
  policy = distribution,
  fetchArchive = download,
  execute = run,
  log = console.log,
} = {}) {
  if (!versionPattern.test(version))
    throw new Error("Invalid Gradle distribution version.");
  if (
    policy.schemaVersion !== 1 ||
    !versionPattern.test(policy.version) ||
    !/^[a-f0-9]{64}$/.test(policy.archiveSha256) ||
    !/^[a-f0-9]{64}$/.test(policy.treeSha256)
  )
    throw new Error("Invalid pinned Gradle distribution policy.");
  const pinned = version === policy.version;
  if (validateExisting && !pinned)
    throw new Error("Distribution cache requires the pinned Gradle version.");
  const name = `gradle-${version}`;
  const root = resolve(toolsRoot, name);
  const archive = resolve(toolsRoot, `${name}-bin.zip`);
  const binaryName = platform === "win32" ? "gradle.bat" : "gradle";
  const binary = join(root, "bin", binaryName);
  const verifyTree = async (directory) => {
    if (pinned && (await distributionDigest(directory)) !== policy.treeSha256)
      throw new Error("Gradle distribution content checksum mismatch.");
  };
  if (await exists(binary)) {
    if (validateExisting) await verifyTree(root);
    if (platform !== "win32") await chmod(binary, 0o755);
    return binary;
  }
  if (await exists(root))
    throw new Error(
      "Gradle distribution is incomplete; remove only the incomplete tool directory before setup.",
    );
  await mkdir(toolsRoot, { recursive: true });
  const temporary = resolve(toolsRoot, `.gradle-setup-${randomUUID()}`);
  await mkdir(temporary);
  try {
    const url = `https://services.gradle.org/distributions/${name}-bin.zip`;
    let expectedSha = policy.archiveSha256;
    if (!pinned) {
      const checksumPath = join(temporary, "archive.sha256");
      await fetchArchive(`${url}.sha256`, checksumPath);
      expectedSha = (await readFile(checksumPath, "utf8")).trim();
      if (!/^[a-f0-9]{64}$/.test(expectedSha))
        throw new Error("Invalid official Gradle distribution checksum.");
    }
    const cachedArchive = await exists(archive);
    const inputArchive = cachedArchive
      ? archive
      : join(temporary, "archive.zip");
    if (!cachedArchive) {
      log(`Downloading Gradle ${version} distribution.`);
      await fetchArchive(url, inputArchive);
    }
    if ((await archiveDigest(inputArchive)) !== expectedSha)
      throw new Error("Gradle distribution archive checksum mismatch.");
    log(`Extracting verified Gradle ${version} distribution.`);
    await execute("jar", ["xf", inputArchive], { cwd: temporary });
    const extracted = join(temporary, name);
    await access(join(extracted, "bin", binaryName));
    await verifyTree(extracted);
    // Atomic rename cannot replace a populated install created by a concurrent process.
    if (await exists(root))
      throw new Error("Gradle distribution was installed concurrently; retry.");
    await rename(extracted, root);
    if (!cachedArchive) await rename(inputArchive, archive);
    if (platform !== "win32") await chmod(binary, 0o755);
    return binary;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== "prepare")
      throw new Error("Command: prepare (no extra arguments).");
    await prepareGradleDistribution({ validateExisting: true });
    console.log(
      `PASS: pinned Gradle ${distribution.version} distribution is verified and ready.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
