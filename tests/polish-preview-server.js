"use strict";
// Read-only visual QA only. No application server, database or external APIs.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../public");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  res.setHeader("Cache-Control", "no-store");
  if (pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 503;
    return res.end(JSON.stringify({ success: false, error: "Database-free QA preview: APIs unavailable." }));
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let relative;
  try { relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"; }
  catch { res.writeHead(400); return res.end(); }
  if (!path.extname(relative)) relative += ".html";
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.setHeader("Content-Type", mime[path.extname(target)] || "application/octet-stream");
    res.end(req.method === "HEAD" ? undefined : data);
  });
}).listen(3327, "127.0.0.1", () => console.log("Read-only, database-free QA preview: http://127.0.0.1:3327"));
