"""GET /api/partners — Partenaires."""
from http.server import BaseHTTPRequestHandler
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        rows = fetchall("SELECT * FROM partners WHERE is_active=TRUE ORDER BY sort_order ASC, name ASC")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
