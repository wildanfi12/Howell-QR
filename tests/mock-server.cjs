const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = 4173;
const expectedOrigin = "http://127.0.0.1:" + port;
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!source.includes("https://script.google.com/macros/s/")) {
  throw new Error("Production endpoint marker not found; refusing to start mock.");
}
const html = source
  .replace(/https:\/\/script\.google\.com\/macros\/s\/[^"]+\/exec/, expectedOrigin + "/submit")
  .replace("'https://script.googleusercontent.com'", "'" + expectedOrigin + "'");
if (html === source || html.includes("https://script.google.com/macros/s/")) {
  throw new Error("Could not replace production endpoint; refusing to start mock.");
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(html);
    return;
  }
  if (request.method === "GET" && /^\/[a-z0-9-]+\.png$/i.test(request.url)) {
    const filePath = path.join(root, path.basename(request.url));
    if (!fs.existsSync(filePath)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
    fs.createReadStream(filePath).pipe(response);
    return;
  }
  if (request.method === "POST" && request.url === "/submit") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      const fields = new URLSearchParams(body);
      const requestId = fields.get("requestId") || "";
      const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
      const valid = validId && fields.get("nama") && fields.get("whatsapp") &&
        fields.get("kategori") && fields.get("perusahaan") && fields.get("produk");
      const message = JSON.stringify({
        source: "howell-data-capture",
        status: valid ? "success" : "error",
        requestId: validId ? requestId : ""
      });
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "x-frame-options": "ALLOWALL",
        "cache-control": "no-store"
      });
      response.end("<!doctype html><script>window.parent.postMessage(" +
        message + ", " + JSON.stringify(expectedOrigin) + ");</script>");
      process.stdout.write(valid ? "Mock accepted one synthetic submission.\n" : "Mock rejected one invalid submission.\n");
    });
    return;
  }
  response.writeHead(404).end();
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write("Local mock listening on http://127.0.0.1:" + port + "/\n");
});
process.on("SIGINT", () => server.close(() => process.exit(0)));
