"""GET /api/courses — Formations disponibles."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        cat = qs.get("category", [""])[0]
        level = qs.get("level", [""])[0]
        clauses, params = ["is_published = TRUE"], []
        if cat:
            clauses.append("category = %s"); params.append(cat)
        if level:
            clauses.append("level = %s"); params.append(level)
        where = " AND ".join(clauses)
        rows = fetchall(f"SELECT * FROM courses WHERE {where} ORDER BY next_date ASC LIMIT 50", params)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
