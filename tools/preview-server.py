#!/usr/bin/env python3
"""No-cache static server for local previews of the Command Centre.

Plain `python -m http.server` sends Last-Modified with no Cache-Control, so
browsers apply heuristic caching and can show a stale index.html/sw.js even
after you save new ones. This server forbids all caching, so a reload always
shows exactly what is on disk.

    python3 tools/preview-server.py [port]     (default 8000)
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving on http://0.0.0.0:{PORT} (no-store)")
    httpd.serve_forever()
