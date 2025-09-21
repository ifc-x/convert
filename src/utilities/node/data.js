import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, basename, dirname } from "path";
import { createHash } from "crypto";

/**
 * Downloads a file using fetch and caches it in the OS temp directory.
 * If already cached (based on URL hash), loads from cache instead.
 *
 * @param {string} url - File URL to download
 * @returns {Promise<string>} - Path to cached file
 */
export async function downloadFileToLocal(url) {
  const hash = createHash("sha256").update(url).digest("hex");
  const cacheDir = join(tmpdir(), hash);
  const fileName = basename(new URL(url).pathname);
  const filePath = join(cacheDir, fileName);

  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  if (existsSync(filePath)) {
    return filePath;
  }
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  writeFileSync(filePath, buffer);

  return filePath;
}
