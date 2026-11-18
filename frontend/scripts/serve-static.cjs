// out/ 을 CloudFront처럼 열어 보는 로컬 미리보기예요. 주소 바꾸기는 실제로 올릴 함수 파일을 그대로 써요.
// 사용: npm run build:static → npm run preview:static → http://127.0.0.1:4310
// API_PROXY_TARGET=http://127.0.0.1:8000 을 주면 /api/v1/* 를 로컬 backend로 넘겨요. 없으면 503.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const FRONTEND = path.join(__dirname, "..");
const OUT_DIR = path.join(FRONTEND, "out");
const FUNCTION_FILE = path.join(FRONTEND, "build", "cloudfront-url-rewrite.js");
const PORT = Number(process.env.PORT || 4310);
const API_TARGET = process.env.API_PROXY_TARGET;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json", ".xml": "application/xml; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

/** 빌드가 만든 CloudFront Function을 불러와요. */
function loadHandler() {
  const code = fs.readFileSync(FUNCTION_FILE, "utf8");
  return new Function(`${code}\nreturn handler;`)();
}

/** /api/v1/* 요청을 로컬 backend로 넘겨요. */
function proxyApi(req, res) {
  if (!API_TARGET) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end('{"detail":"preview:static: API_PROXY_TARGET 이 없어요"}');
    return;
  }
  const target = new URL(req.url, API_TARGET);
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (up) => {
    res.writeHead(up.statusCode, up.headers);
    up.pipe(res);
  });
  upstream.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(upstream);
}

/** S3처럼 파일이 있으면 주고, 없으면 403을 줘요. */
function serveFile(key, res) {
  const file = path.join(OUT_DIR, decodeURIComponent(key));
  if (!file.startsWith(OUT_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("AccessDenied (S3에 없는 파일)");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

const handler = loadHandler();
http.createServer((req, res) => {
  const url = new URL(req.url, "http://preview");
  if (url.pathname.startsWith("/api/v1/")) return proxyApi(req, res);
  const request = handler({ request: { method: req.method, uri: url.pathname, querystring: {}, headers: {} } });
  console.log(`${url.pathname} → ${request.uri}`);
  serveFile(request.uri, res);
}).listen(PORT, "127.0.0.1", () => console.log(`preview:static → http://127.0.0.1:${PORT}`));
