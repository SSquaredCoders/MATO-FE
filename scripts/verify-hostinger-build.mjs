import { access, readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDirectory = path.join(projectRoot, "dist", "client");
const indexPath = path.join(clientDirectory, "index.html");
const htaccessPath = path.join(clientDirectory, ".htaccess");
const assetsDirectory = path.join(clientDirectory, "assets");

await Promise.all([
  access(indexPath),
  access(htaccessPath),
  access(assetsDirectory),
]);

if (!(await stat(assetsDirectory)).isDirectory()) {
  throw new Error("dist/client/assets is not a directory");
}

const assetEntries = await readdir(assetsDirectory, { recursive: true, withFileTypes: true });
if (!assetEntries.some((entry) => entry.isFile())) {
  throw new Error("dist/client/assets does not contain any files");
}

const [indexHtml, htaccess] = await Promise.all([
  readFile(indexPath, "utf8"),
  readFile(htaccessPath, "utf8"),
]);

if (!indexHtml.includes("/assets/")) {
  throw new Error("dist/client/index.html does not reference the built assets");
}

if (!htaccess.includes("RewriteRule . /index.html [L]")) {
  throw new Error("dist/client/.htaccess is missing the SPA fallback rule");
}

console.log("Hostinger build verified: dist/client contains index.html, .htaccess, and assets.");
