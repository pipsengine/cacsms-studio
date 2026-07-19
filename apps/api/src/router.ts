import type { IncomingMessage, ServerResponse } from "node:http";

const webOrigin = process.env.CACSMS_WEB_ORIGIN ?? "http://127.0.0.1:3008";

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

async function proxyJson(path: string, init?: RequestInit) {
  const response = await fetch(`${webOrigin}${path}`, init);
  const text = await response.text();
  return { status: response.status, body: text, contentType: response.headers.get("content-type") ?? "application/json" };
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  response.setHeader("Access-Control-Allow-Origin", webOrigin);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-cacsms-internal");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: "ok", service: "cacsms-api", webOrigin }));
      return;
    }

    if (url.pathname === "/v1/manifest") {
      const { apiManifest } = await import("./manifest.js");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(apiManifest));
      return;
    }

    if (url.pathname === "/v1/production-lifecycle/status" && request.method === "GET") {
      const proxied = await proxyJson("/api/production-lifecycle/status");
      response.writeHead(proxied.status, { "Content-Type": proxied.contentType });
      response.end(proxied.body);
      return;
    }

    if (url.pathname.startsWith("/v1/production-lifecycle/queue/") && request.method === "GET") {
      const stage = url.pathname.split("/").pop();
      const proxied = await proxyJson(`/api/production-lifecycle/queue/${stage}`);
      response.writeHead(proxied.status, { "Content-Type": proxied.contentType });
      response.end(proxied.body);
      return;
    }

    if (url.pathname === "/v1/production-lifecycle/settings") {
      if (request.method === "GET") {
        const proxied = await proxyJson("/api/production-lifecycle/settings");
        response.writeHead(proxied.status, { "Content-Type": proxied.contentType });
        response.end(proxied.body);
        return;
      }
      if (request.method === "PATCH") {
        const body = await readBody(request);
        const proxied = await proxyJson("/api/production-lifecycle/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body
        });
        response.writeHead(proxied.status, { "Content-Type": proxied.contentType });
        response.end(proxied.body);
        return;
      }
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "Route not found.", path: url.pathname }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: error instanceof Error ? error.message : "API failure" }));
  }
}
