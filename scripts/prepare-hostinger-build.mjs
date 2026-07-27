import { access, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDirectory = path.join(projectRoot, "dist", "client");
const clientEntryPath = path.join(clientDirectory, "index.html");
const htaccessPath = path.join(clientDirectory, ".htaccess");

const htaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;

await access(clientEntryPath);
await writeFile(htaccessPath, htaccess, "utf8");
