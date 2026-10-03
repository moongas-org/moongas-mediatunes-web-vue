/**
 * Production server for the mediatunes SPA — plain Deno.serve, no framework.
 *
 * - Serves the Vite build output from client/dist under the PUBLIC_BASE_PATH
 *   (default "/mediatunes", the same value as the client's Vite `base`).
 * - Proxies <base>/api/* and <base>/getfile/* to the backend (mediatunes-svc,
 *   which owns the mediascan database and the media files). The "/mediatunes"
 *   base prefix is stripped before forwarding so the backend keeps its own
 *   unprefixed /api and /getfile layout.
 * - Falls back to index.html for unknown paths (SPA history-mode routing).
 *
 * Backend path layout (mediatunes-svc):
 *   - JSON API lives under BACKEND_URL_PREFIX (e.g. "/api" -> /api/albums, ...)
 *   - Media files are served at the ROOT: /getfile/<path> (no prefix)
 *
 * Environment variables:
 *   PORT                listen port (default 8000)
 *   BACKEND_URL         backend base URL (default http://127.0.0.1:5000)
 *   BACKEND_URL_PREFIX  path prefix the backend's JSON API is served under
 *                       (default "/api")
 *   PUBLIC_BASE_PATH    public base path the SPA is served under
 *                       (default "/mediatunes")
 */

const PORT = Number(Deno.env.get("PORT") ?? "8000");
const BACKEND_URL = Deno.env.get("BACKEND_URL") ?? "http://127.0.0.1:5000";
const BACKEND_URL_PREFIX = (Deno.env.get("BACKEND_URL_PREFIX") ?? "/api").replace(/\/$/, "");
// Base path the SPA is served under (matches the client's Vite `base`).
const PUBLIC_BASE_PATH = "/" +
  (Deno.env.get("PUBLIC_BASE_PATH") ?? "mediatunes").replace(/^\/+|\/+$/g, "");
const DIST_DIR = new URL("../client/dist/", import.meta.url);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function contentType(path: string): string {
  const idx = path.lastIndexOf(".");
  if (idx < 0) return "application/octet-stream";
  return MIME_TYPES[path.slice(idx).toLowerCase()] ?? "application/octet-stream";
}

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

async function proxyToBackend(req: Request, path: string): Promise<Response> {
  const url = new URL(req.url);
  // `path` already has the public base prefix stripped. The JSON API is
  // re-rooted under BACKEND_URL_PREFIX (e.g. "/api"); media files (/getfile)
  // stay at the backend root.
  const upstreamPath = path.startsWith("/api/")
    ? `${BACKEND_URL_PREFIX}${path.slice("/api".length)}`
    : path;
  const target = `${BACKEND_URL}${upstreamPath}${url.search}`;

  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete("host");
  for (const h of HOP_BY_HOP_HEADERS) reqHeaders.delete(h);

  const upstream = await fetch(target, {
    method: req.method,
    headers: reqHeaders,
    body: req.method === "GET" || req.method === "HEAD" ? null : req.body,
    redirect: "manual",
  });

  const respHeaders = new Headers(upstream.headers);
  for (const h of HOP_BY_HOP_HEADERS) respHeaders.delete(h);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

async function serveStatic(pathname: string): Promise<Response | null> {
  // Prevent path traversal, then resolve relative to the dist directory.
  const rel = pathname.replace(/^\/+/, "").split("/").filter((p) => p !== "..").join("/");
  if (rel === "") return null;
  const fileUrl = new URL(rel, DIST_DIR);
  try {
    const stat = await Deno.stat(fileUrl);
    if (!stat.isFile) return null;
    const body = await Deno.readFile(fileUrl);
    return new Response(body, {
      headers: { "content-type": contentType(rel) },
    });
  } catch {
    return null;
  }
}

async function serveIndex(): Promise<Response> {
  try {
    const body = await Deno.readFile(new URL("index.html", DIST_DIR));
    return new Response(body, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response(
      "client/dist not found — run `deno task build` first.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Only handle requests under the public base path (e.g. "/mediatunes"). The
  // base prefix is stripped so the rest of the server is base-agnostic; the
  // root "/" also redirects there for convenience.
  if (pathname === "/") {
    return new Response(null, {
      status: 302,
      headers: { location: `${PUBLIC_BASE_PATH}/` },
    });
  }
  if (pathname === PUBLIC_BASE_PATH) {
    pathname = "/";
  } else if (pathname.startsWith(`${PUBLIC_BASE_PATH}/`)) {
    pathname = pathname.slice(PUBLIC_BASE_PATH.length);
  } else {
    return new Response("Not Found", { status: 404 });
  }

  // Proxy the JSON API and media files to the backend.
  if (pathname.startsWith("/api/") || pathname.startsWith("/getfile/")) {
    try {
      return await proxyToBackend(req, pathname);
    } catch (err) {
      // Client disconnected / request aborted mid-flight: harmless, don't log a 502.
      const e = err as { name?: string; code?: string };
      if (e?.name === "AbortError" || e?.code === "ECONNRESET") {
        return new Response(null, { status: 499 }); // client closed request
      }
      console.error(`Proxy error for ${pathname}:`, err);
      return new Response(`Bad Gateway: backend unreachable at ${BACKEND_URL}`, {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  }

  const staticResp = await serveStatic(pathname);
  if (staticResp) return staticResp;

  // SPA fallback: let the client-side router handle unknown paths.
  return await serveIndex();
}

console.log(`mediatunes SPA server listening on http://0.0.0.0:${PORT}`);
console.log(
  `Serving SPA under ${PUBLIC_BASE_PATH}/; proxying ${PUBLIC_BASE_PATH}/api -> ${BACKEND_URL}${BACKEND_URL_PREFIX}, ${PUBLIC_BASE_PATH}/getfile -> ${BACKEND_URL}/getfile`,
);
Deno.serve({ port: PORT, hostname: "0.0.0.0" }, handler);
