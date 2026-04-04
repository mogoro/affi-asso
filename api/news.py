"""GET /api/news — Actualites."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall, fetchone

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)

        # Single news by ID
        id_param = qs.get("id", [""])[0]
        if id_param:
            row = fetchone("SELECT * FROM news WHERE id = %s", [int(id_param)])
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(row, ensure_ascii=False, default=str).encode("utf-8"))
            return

        search = qs.get("search", [""])[0]
        try:
            limit = max(1, min(int(qs.get("limit", ["10"])[0]), 200))
        except (ValueError, TypeError):
            limit = 20

        clauses = ["is_published=TRUE"]
        params = []

        if search:
            clauses.append("(title ILIKE %s OR content ILIKE %s)")
            s = f"%%{search}%%"
            params.extend([s, s])

        where = " WHERE " + " AND ".join(clauses)
        params.append(limit)

        rows = fetchall(f"SELECT * FROM news{where} ORDER BY is_pinned DESC, published_at DESC LIMIT %s", params)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
