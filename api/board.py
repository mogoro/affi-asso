"""GET /api/board — Organigramme / Bureau."""
from http.server import BaseHTTPRequestHandler
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        rows = fetchall("""
            SELECT b.role, b.title, b.sort_order, m.first_name, m.last_name, m.company, m.photo_url
            FROM board_members b
            JOIN members m ON b.member_id = m.id
            WHERE b.is_active = TRUE
            ORDER BY b.sort_order ASC
        """)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))
