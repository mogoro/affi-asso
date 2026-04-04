"""GET /api/map — Membres geolocalises pour la cartographie."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall
from api.auth import get_member_from_token

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        user = get_member_from_token(token)
        if not user:
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Authentification requise"}).encode())
            return

        qs = parse_qs(urlparse(self.path).query)
        group_by = qs.get("group", ["member"])[0]

        if group_by == "company":
            rows = fetchall("""
                SELECT company, COUNT(*) as member_count,
                       AVG(latitude) as lat, AVG(longitude) as lng,
                       ARRAY_AGG(DISTINCT sector) as sectors,
                       ARRAY_AGG(first_name || ' ' || last_name) as members
                FROM members
                WHERE status='active' AND latitude IS NOT NULL AND company IS NOT NULL AND company != ''
                GROUP BY company
                ORDER BY member_count DESC
            """)
        else:
            rows = fetchall("""
                SELECT id, first_name, last_name, company, job_title, sector,
                       latitude as lat, longitude as lng, badges, skills, location
                FROM members
                WHERE status='active' AND latitude IS NOT NULL
            """)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(rows, ensure_ascii=False, default=str).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
