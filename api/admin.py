"""API /api/admin — Administration complete (membres, evenements, news, publications, annonces, messages)."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall, fetchone, execute, get_conn
from api.auth import get_member_from_token

class handler(BaseHTTPRequestHandler):
    def _get_admin(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        user = get_member_from_token(token)
        if not user or not user.get("is_admin"):
            return None
        return user

    def do_GET(self):
        admin = self._get_admin()
        if not admin:
            return self._json(403, {"error": "Acces administrateur requis"})
        qs = parse_qs(urlparse(self.path).query)
        action = qs.get("action", [""])[0]

        if action == "members":
            status = qs.get("status", [""])[0]
            search = qs.get("search", [""])[0]
            clauses, params = [], []
            if status:
                clauses.append("status = %s"); params.append(status)
            if search:
                clauses.append("(first_name ILIKE %s OR last_name ILIKE %s OR email ILIKE %s OR company ILIKE %s)")
                s = f"%%{search}%%"; params.extend([s, s, s, s])
            where = " WHERE " + " AND ".join(clauses) if clauses else ""
            rows = fetchall(f"""SELECT id, email, first_name, last_name, company, job_title, sector,
                membership_type, status, is_admin, is_board, phone, joined_at, last_login
                FROM members {where} ORDER BY joined_at DESC LIMIT 200""", params)
            return self._json(200, rows)

        elif action == "member_detail":
            mid = qs.get("id", ["0"])[0]
            m = fetchone("SELECT * FROM members WHERE id = %s", [int(mid)])
            if m and "password_hash" in m:
                del m["password_hash"]
            return self._json(200, m or {"error": "Membre introuvable"})

        elif action == "events":
            rows = fetchall("SELECT * FROM events ORDER BY start_date DESC LIMIT 100")
            return self._json(200, rows)

        elif action == "news":
            rows = fetchall("SELECT * FROM news ORDER BY published_at DESC LIMIT 100")
            return self._json(200, rows)

        elif action == "publications":
            rows = fetchall("SELECT * FROM publications ORDER BY published_at DESC LIMIT 100")
            return self._json(200, rows)

        elif action == "announcements":
            rows = fetchall("""SELECT a.*, m.first_name, m.last_name, m.email
                FROM member_announcements a JOIN members m ON a.author_id = m.id
                ORDER BY a.created_at DESC LIMIT 100""")
            return self._json(200, rows)

        elif action == "messages":
            rows = fetchall("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100")
            return self._json(200, rows)

        elif action == "subscriptions":
            rows = fetchall("""SELECT s.*, m.first_name, m.last_name, m.email
                FROM subscriptions s JOIN members m ON s.member_id = m.id
                ORDER BY s.created_at DESC LIMIT 200""")
            return self._json(200, rows)

        elif action == "dashboard":
            stats = {}
            for key, sql in [
                ("total_members", "SELECT COUNT(*) FROM members"),
                ("active_members", "SELECT COUNT(*) FROM members WHERE status='active'"),
                ("pending_members", "SELECT COUNT(*) FROM members WHERE status='pending'"),
                ("blocked_members", "SELECT COUNT(*) FROM members WHERE status='blocked'"),
                ("total_events", "SELECT COUNT(*) FROM events"),
                ("upcoming_events", "SELECT COUNT(*) FROM events WHERE start_date >= NOW()"),
                ("total_news", "SELECT COUNT(*) FROM news"),
                ("total_publications", "SELECT COUNT(*) FROM publications"),
                ("total_announcements", "SELECT COUNT(*) FROM member_announcements"),
                ("pending_announcements", "SELECT COUNT(*) FROM member_announcements WHERE is_active=FALSE"),
                ("unread_messages", "SELECT COUNT(*) FROM contact_messages WHERE is_read=FALSE"),
                ("total_messages", "SELECT COUNT(*) FROM contact_messages"),
            ]:
                r = fetchone(sql)
                stats[key] = list(r.values())[0] if r else 0
            stats["by_sector"] = fetchall("SELECT sector, COUNT(*) as n FROM members WHERE status='active' AND sector IS NOT NULL GROUP BY sector ORDER BY n DESC")
            stats["by_type"] = fetchall("SELECT membership_type as type, COUNT(*) as n FROM members GROUP BY membership_type ORDER BY n DESC")
            stats["recent_members"] = fetchall("SELECT id, first_name, last_name, email, company, status, joined_at FROM members ORDER BY joined_at DESC LIMIT 5")
            return self._json(200, stats)

        return self._json(400, {"error": "Action inconnue"})

    def do_POST(self):
        admin = self._get_admin()
        if not admin:
            return self._json(403, {"error": "Acces administrateur requis"})
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "")

        # === MEMBERS ===
        if action == "approve_member":
            execute("UPDATE members SET status='active' WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Membre approuve"})

        elif action == "block_member":
            execute("UPDATE members SET status='blocked' WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Membre bloque"})

        elif action == "activate_member":
            execute("UPDATE members SET status='active' WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Membre reactive"})

        elif action == "set_admin":
            execute("UPDATE members SET is_admin=%s WHERE id=%s", [body.get("value", False), body["id"]])
            return self._json(200, {"ok": True})

        elif action == "set_board":
            execute("UPDATE members SET is_board=%s WHERE id=%s", [body.get("value", False), body["id"]])
            return self._json(200, {"ok": True})

        elif action == "update_member":
            fields = {}
            for k in ("first_name","last_name","email","phone","company","job_title","sector","membership_type","status"):
                if k in body:
                    fields[k] = body[k]
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE members SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True, "message": "Membre mis a jour"})

        elif action == "delete_member":
            execute("DELETE FROM members WHERE id=%s AND is_admin=FALSE", [body["id"]])
            return self._json(200, {"ok": True, "message": "Membre supprime"})

        # === EVENTS ===
        elif action == "create_event":
            execute("""INSERT INTO events (title, event_type, description, location, start_date, end_date, is_members_only, is_published)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                [body.get("title"), body.get("event_type","conference"), body.get("description"),
                 body.get("location"), body.get("start_date"), body.get("end_date"),
                 body.get("is_members_only", False), body.get("is_published", True)])
            return self._json(200, {"ok": True, "message": "Evenement cree"})

        elif action == "update_event":
            fields = {k: body[k] for k in ("title","event_type","description","location","start_date","end_date","is_members_only","is_published") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE events SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True, "message": "Evenement mis a jour"})

        elif action == "delete_event":
            execute("DELETE FROM events WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === NEWS ===
        elif action == "create_news":
            execute("INSERT INTO news (title, excerpt, content, is_published) VALUES (%s,%s,%s,%s)",
                [body.get("title"), body.get("excerpt"), body.get("content"), body.get("is_published", True)])
            return self._json(200, {"ok": True, "message": "Actualite creee"})

        elif action == "update_news":
            fields = {k: body[k] for k in ("title","excerpt","content","is_published") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE news SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True})

        elif action == "delete_news":
            execute("DELETE FROM news WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === PUBLICATIONS ===
        elif action == "create_publication":
            execute("INSERT INTO publications (title, category, content, excerpt, is_published) VALUES (%s,%s,%s,%s,%s)",
                [body.get("title"), body.get("category"), body.get("content"), body.get("excerpt"), body.get("is_published", True)])
            return self._json(200, {"ok": True})

        elif action == "delete_publication":
            execute("DELETE FROM publications WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === ANNOUNCEMENTS MODERATION ===
        elif action == "approve_announcement":
            execute("UPDATE member_announcements SET is_active=TRUE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Annonce approuvee"})

        elif action == "reject_announcement":
            execute("UPDATE member_announcements SET is_active=FALSE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Annonce rejetee"})

        elif action == "delete_announcement":
            execute("DELETE FROM member_announcements WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === MESSAGES ===
        elif action == "mark_read":
            execute("UPDATE contact_messages SET is_read=TRUE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        elif action == "delete_message":
            execute("DELETE FROM contact_messages WHERE id=%s", [body["id"]])
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
