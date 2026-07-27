import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDirectory = path.join(projectRoot, "dist", "server");
const workerPath = path.join(serverDirectory, "index.js");
const clientEntryPath = path.join(projectRoot, "dist", "client", "index.html");

const workerSource = `export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    if (
      requestUrl.pathname === "/api" ||
      requestUrl.pathname.startsWith("/api/") ||
      requestUrl.pathname === "/ws" ||
      requestUrl.pathname.startsWith("/ws/") ||
      requestUrl.pathname === "/actuator/health"
    ) {
      const apiOrigin = env.MATO_API_ORIGIN?.trim();

      if (!apiOrigin) {
        return new Response("MATO API 연결 주소가 아직 설정되지 않았습니다.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      let upstreamOrigin;
      try {
        upstreamOrigin = new URL(apiOrigin);
      } catch {
        return new Response("MATO API 연결 주소가 올바르지 않습니다.", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      if (upstreamOrigin.protocol !== "https:" && upstreamOrigin.protocol !== "http:") {
        return new Response("MATO API 연결 주소는 HTTP(S)여야 합니다.", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, upstreamOrigin);
      const upstreamHeaders = new Headers(request.headers);
      upstreamHeaders.delete("host");
      upstreamHeaders.delete("origin");
      upstreamHeaders.delete("referer");
      upstreamHeaders.set("x-forwarded-host", requestUrl.host);
      upstreamHeaders.set("x-forwarded-proto", requestUrl.protocol.slice(0, -1));

      const upstreamRequest = new Request(upstreamUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        redirect: "manual",
      });

      return fetch(upstreamRequest);
    }

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
