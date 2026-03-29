"""API /api/members — Annuaire, profil, annonces, CV."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall, fetchone, execute, get_conn
from api.auth import get_member_from_token, hash_pw

class handler(BaseHTTPRequestHandler):
    def _get_user(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        return get_member_from_token(token)

    def do_GET(self):
        user = self._get_user()
        qs = parse_qs(urlparse(self.path).query)
        action = qs.get("action", ["directory"])[0]

        if action == "directory":
            # Annuaire membres (accessible aux membres connectes)
            if not user:
                return self._json(401, {"error": "Connexion requise"})
            search = qs.get("search", [""])[0]
            sector = qs.get("sector", [""])[0]
            company = qs.get("company", [""])[0]
            clauses = ["status = 'active'"]
            params = []
            if search:
                clauses.append("(first_name ILIKE %s OR last_name ILIKE %s OR company ILIKE %s)")
                s = f"%%{search}%%"
                params.extend([s, s, s])
            if sector:
                clauses.append("sector = %s")
                params.append(sector)
            if company:
                clauses.append("company ILIKE %s")
                params.append(f"%%{company}%%")
            where = " AND ".join(clauses)
            rows = fetchall(f"""
                SELECT id, first_name, last_name, company, job_title, sector, photo_url, bio,
                       membership_type, is_board
                FROM members WHERE {where}
                ORDER BY last_name ASC LIMIT 200
            """, params)
            return self._json(200, rows)

        elif action == "profile":
            # Mon profil
            if not user:
                return self._json(401, {"error": "Connexion requise"})
            full = fetchone("""
                SELECT id, email, first_name, last_name, phone, company, job_title, sector,
                       bio, photo_url, membership_type, status, is_admin, is_board,
                       linkedin_url, cv_text, cv_updated_at, joined_at
                FROM members WHERE id = %s
            """, [user["id"]])
            return self._json(200, full)

        elif action == "announcements":
            # Annonces des membres
            if not user:
                return self._json(401, {"error": "Connexion requise"})
            rows = fetchall("""
                SELECT a.id, a.title, a.content, a.category, a.created_at,
                       m.first_name, m.last_name, m.company, m.photo_url
                FROM member_announcements a
                JOIN members m ON a.author_id = m.id
                WHERE a.is_active = TRUE
                ORDER BY a.created_at DESC LIMIT 50
            """)
            return self._json(200, rows)

        elif action == "stats":
            # Stats pour admin
            if not user or not user.get("is_admin"):
                return self._json(403, {"error": "Admin requis"})
            stats = {}
            stats["total_members"] = fetchone("SELECT COUNT(*) as n FROM members")["n"]
            stats["active_members"] = fetchone("SELECT COUNT(*) as n FROM members WHERE status='active'")["n"]
            stats["pending_members"] = fetchone("SELECT COUNT(*) as n FROM members WHERE status='pending'")["n"]
            stats["total_events"] = fetchone("SELECT COUNT(*) as n FROM events")["n"]
            stats["total_publications"] = fetchone("SELECT COUNT(*) as n FROM publications")["n"]
            stats["unread_messages"] = fetchone("SELECT COUNT(*) as n FROM contact_messages WHERE is_read=FALSE")["n"]
            stats["by_sector"] = fetchall("SELECT sector, COUNT(*) as n FROM members WHERE status='active' AND sector IS NOT NULL GROUP BY sector ORDER BY n DESC")
            stats["by_type"] = fetchall("SELECT membership_type, COUNT(*) as n FROM members WHERE status='active' GROUP BY membership_type ORDER BY n DESC")
            return self._json(200, stats)

        return self._json(400, {"error": "Action inconnue"})

    def do_POST(self):
        user = self._get_user()
        if not user:
            return self._json(401, {"error": "Connexion requise"})

        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "")

        if action == "update_profile":
            fields = {}
            for k in ("first_name","last_name","phone","company","job_title","sector","bio","photo_url","linkedin_url"):
                if k in body:
                    fields[k] = body[k]
            if fields:
                sets = ", ".join(f"{k} = %s" for k in fields)
                vals = list(fields.values()) + [user["id"]]
                execute(f"UPDATE members SET {sets} WHERE id = %s", vals)
            return self._json(200, {"ok": True, "message": "Profil mis a jour"})

        elif action == "update_cv":
            cv_text = body.get("cv_text", "")
            execute("UPDATE members SET cv_text = %s, cv_updated_at = NOW() WHERE id = %s", [cv_text, user["id"]])
            return self._json(200, {"ok": True, "message": "CV mis a jour"})

        elif action == "import_linkedin":
            # Stocke les donnees LinkedIn fournies par le frontend
            li = body.get("linkedin_data", {})
            updates = {}
            if li.get("headline"): updates["job_title"] = li["headline"]
            if li.get("company"): updates["company"] = li["company"]
            if li.get("summary"): updates["bio"] = li["summary"]
            if li.get("profileUrl"): updates["linkedin_url"] = li["profileUrl"]
            if li.get("photoUrl"): updates["photo_url"] = li["photoUrl"]
            if updates:
                sets = ", ".join(f"{k} = %s" for k in updates)
                vals = list(updates.values()) + [user["id"]]
                execute(f"UPDATE members SET {sets} WHERE id = %s", vals)
            return self._json(200, {"ok": True, "message": "Profil LinkedIn importe"})

        elif action == "post_announcement":
            title = (body.get("title") or "").strip()
            content = (body.get("content") or "").strip()
            category = body.get("category", "general")
            if not title or not content:
                return self._json(400, {"error": "Titre et contenu requis"})
            execute("INSERT INTO member_announcements (author_id, title, content, category) VALUES (%s,%s,%s,%s)",
                    [user["id"], title, content, category])
            return self._json(200, {"ok": True, "message": "Annonce publiee"})

        # Admin actions
        elif action == "approve_member" and user.get("is_admin"):
            mid = body.get("member_id")
            execute("UPDATE members SET status = 'active' WHERE id = %s", [mid])
            return self._json(200, {"ok": True})

        elif action == "block_member" and user.get("is_admin"):
            mid = body.get("member_id")
            execute("UPDATE members SET status = 'blocked' WHERE id = %s", [mid])
            return self._json(200, {"ok": True})

        return self._json(400, {"error": "Action inconnue"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))
