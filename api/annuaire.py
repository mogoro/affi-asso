"""GET /api/annuaire — Annuaire public des experts (consent_annuaire=true uniquement)."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        search = qs.get("search", [""])[0]
        specialty = qs.get("specialty", [""])[0]
        region = qs.get("region", [""])[0]
        sector = qs.get("sector", [""])[0]

        clauses = ["status = 'active'", "consent_annuaire = TRUE", "archived_at IS NULL"]
        params = []

        if search:
            clauses.append("(first_name ILIKE %s OR last_name ILIKE %s OR company ILIKE %s)")
            s = f"%%{search}%%"
            params.extend([s, s, s])
        if specialty:
            clauses.append("specialty = %s")
            params.append(specialty)
        if region:
            clauses.append("region = %s")
            params.append(region)
        if sector:
            clauses.append("sector = %s")
            params.append(sector)

        where = " AND ".join(clauses)
        rows = fetchall(f"""
            SELECT id, first_name, last_name, company, job_title, sector, specialty,
                   region, photo_url, bio, is_mentor, is_board, linkedin_url
            FROM members WHERE {where}
            ORDER BY last_name ASC LIMIT 200
        """, params)
        return self._json(200, rows)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))
