import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    request.on("error", reject);
  });

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://localhost:5173",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(payload, null, 2));
};

const sendStatic = async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const decodedPath = decodeURIComponent(url.pathname);
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.normalize(path.join(distDir, requestedPath));
  const safePath = filePath.startsWith(distDir) ? filePath : path.join(distDir, "index.html");

  try {
    const file = await fs.readFile(safePath);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(safePath)] ?? "application/octet-stream",
      "cache-control": safePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    response.end(file);
  } catch {
    const index = await fs.readFile(path.join(distDir, "index.html"));
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    });
    response.end(index);
  }
};

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.url === "/health") {
    sendJson(response, 200, { ok: true, service: "taiwan-home-valuation-api" });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await sendStatic(request, response);
    return;
  }

  sendJson(response, 404, { status: "not-found" });
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
