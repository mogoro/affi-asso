"""GET /api/health — Health check for monitoring."""
from http.server import BaseHTTPRequestHandler
import json, time
from api._shared.db import fetchone

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        start = time.time()
        status = "ok"
        db_ok = False
        try:
            result = fetchone("SELECT 1 as check")
            db_ok = result is not None
        except Exception:
            status = "degraded"
            db_ok = False

        elapsed = round((time.time() - start) * 1000)

        self.send_response(200 if status == "ok" else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(json.dumps({
            "status": status,
            "db": db_ok,
            "latency_ms": elapsed,
            "timestamp": int(time.time()),
        }).encode())
