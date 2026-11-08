import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

const securityHeaders = {
  // 只允许同源脚本/样式（字体来自 Google Fonts），接口仅可访问本机后端，禁止内页被嵌套
  "Content-Security-Policy": [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' http://localhost:8080",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'"
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    const safePath = normalize(requestPath === "/" ? "/index.html" : requestPath);
    const filePath = join(root, safePath);
    if (!filePath.startsWith(root)) throw new Error("Forbidden");
    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream", ...securityHeaders });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders });
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`Chirp is running at http://localhost:${port}`);
});
