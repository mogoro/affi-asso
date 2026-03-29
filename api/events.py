"""GET /api/events — Liste des evenements."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        upcoming = qs.get("upcoming", [""])[0]
        limit = int(qs.get("limit", ["20"])[0])
        if upcoming:
            rows = fetchall("SELECT * FROM events WHERE is_published=TRUE AND start_date >= NOW() ORDER BY start_date ASC LIMIT %s", [limit])
        else:
            rows = fetchall("SELECT * FROM events WHERE is_published=TRUE ORDER BY start_date DESC LIMIT %s", [limit])
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
