#!/usr/bin/env python3
"""Build a single Cloudflare Worker from the three versioned HTML pages."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pages = {
    "/": (root / "public/index.html").read_text(encoding="utf-8"),
    "/capitales/": (root / "public/capitales/index.html").read_text(encoding="utf-8"),
    "/relieve/": (root / "public/relieve/index.html").read_text(encoding="utf-8"),
}
routing = """
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/capitales" || path === "/relieve") {
      return Response.redirect(url.origin + path + "/", 308);
    }
    const normalized = path === "/index.html" ? "/" : path.replace(/index\\.html$/, "");
    const html = pages[normalized];
    if (!html) return new Response("404 · No encontrado", {
      status: 404,
      headers: {"content-type": "text/plain; charset=utf-8"}
    });
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "cache-control": "no-cache",
        "permissions-policy": "camera=(), microphone=(), geolocation=()"
      }
    });
  }
};
"""
output = root / "dist/worker.mjs"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text("const pages=" + json.dumps(pages, ensure_ascii=False) + ";\n" + routing, encoding="utf-8")
print(f"Built {output.relative_to(root)} ({output.stat().st_size} bytes)")
