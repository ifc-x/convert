import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

/**
 * Downloads a file using fetch and caches it in the OS temp directory.
 * If already cached (based on URL hash), loads from cache instead.
 *
 * @param {string} url - File URL to download
 * @returns {Promise<string>} - Path to cached file
 */
export async function downloadFileToLocal(url) {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const cacheDir = path.join(os.tmpdir(), hash);
  const fileName = path.basename(new URL(url).pathname);
  const filePath = path.join(cacheDir, fileName);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  fs.writeFileSync(filePath, buffer);

  return filePath;
}