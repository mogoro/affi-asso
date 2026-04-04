"""GET /api/publications — Publications."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        try:
            limit = max(1, min(int(qs.get("limit", ["20"])[0]), 200))
        except (ValueError, TypeError):
            limit = 20
        cat = qs.get("category", [""])[0]
        if cat:
            rows = fetchall("SELECT * FROM publications WHERE is_published=TRUE AND category=%s ORDER BY published_at DESC LIMIT %s", [cat, limit])
        else:
            rows = fetchall("SELECT * FROM publications WHERE is_published=TRUE ORDER BY published_at DESC LIMIT %s", [limit])
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
