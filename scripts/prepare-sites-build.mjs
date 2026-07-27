import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.join(projectRoot, "dist", "server");
const workerPath = path.join(serverDirectory, "index.js");
const clientEntryPath = path.join(projectRoot, "dist", "client", "index.html");

const workerSource = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (
      response.status === 404 &&
      request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      const indexUrl = new URL("/index.html", request.url);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    return response;
  },
};
`;

await access(clientEntryPath);
await mkdir(serverDirectory, { recursive: true });
await writeFile(workerPath, workerSource, "utf8");
