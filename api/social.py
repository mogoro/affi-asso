"""API /api/social — Feed, messages, jobs, endorsements, notifications."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall, fetchone, execute
from api.auth import get_member_from_token

class handler(BaseHTTPRequestHandler):
    def _user(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        return get_member_from_token(token)

    def do_GET(self):
        user = self._user()
        qs = parse_qs(urlparse(self.path).query)
        action = qs.get("action", [""])[0]

        # --- FEED (public) ---
        if action == "feed":
            rows = fetchall("""
                SELECT p.*, m.first_name, m.last_name, m.company, m.photo_url, m.badges
                FROM feed_posts p JOIN members m ON p.author_id = m.id
                ORDER BY p.created_at DESC LIMIT 30
            """)
            if rows:
                post_ids = [r["id"] for r in rows]
                placeholders = ",".join(["%s"] * len(post_ids))
                comments = fetchall(f"""
                    SELECT c.*, m.first_name, m.last_name FROM feed_comments c
                    JOIN members m ON c.author_id = m.id WHERE c.post_id IN ({placeholders}) ORDER BY c.created_at
                """, post_ids)
                comments_by_post = {}
                for c in comments:
                    comments_by_post.setdefault(c["post_id"], []).append(c)
                for r in rows:
                    r["comments"] = comments_by_post.get(r["id"], [])
            return self._json(200, rows)

        # --- JOBS ---
        elif action == "jobs":
            freelance = qs.get("freelance", [""])[0]
            sector = qs.get("sector", [""])[0]
            search = qs.get("search", [""])[0]
            clauses, params = ["is_active = TRUE"], []
            if freelance == "1":
                clauses.append("is_freelance = TRUE")
            if sector:
                clauses.append("sector = %s"); params.append(sector)
            if search:
                clauses.append("(title ILIKE %s OR company ILIKE %s OR description ILIKE %s)")
                s = f"%%{search}%%"; params.extend([s, s, s])
            where = " AND ".join(clauses)
            rows = fetchall(f"SELECT * FROM jobs WHERE {where} ORDER BY created_at DESC LIMIT 50", params)
            return self._json(200, rows)

        elif action == "job_detail":
            jid = qs.get("id", ["0"])[0]
            job = fetchone("SELECT * FROM jobs WHERE id = %s", [int(jid)])
            return self._json(200, job or {"error": "Offre introuvable"})

        # --- MESSAGES (auth required) ---
        elif action == "conversations":
            if not user: return self._json(401, {"error": "Auth requise"})
            uid = user["id"]
            rows = fetchall("""
                SELECT DISTINCT ON (other_id) other_id, first_name, last_name, company, photo_url, last_msg, last_date, unread
                FROM (
                    SELECT CASE WHEN from_member_id=%s THEN to_member_id ELSE from_member_id END as other_id,
                           content as last_msg, created_at as last_date,
                           CASE WHEN to_member_id=%s AND is_read=FALSE THEN 1 ELSE 0 END as unread
                    FROM messages WHERE from_member_id=%s OR to_member_id=%s
                    ORDER BY created_at DESC
                ) sub
                JOIN members m ON m.id = sub.other_id
                ORDER BY other_id, last_date DESC
            """, [uid, uid, uid, uid])
            return self._json(200, rows)

        elif action == "thread":
            if not user: return self._json(401, {"error": "Auth requise"})
            other = int(qs.get("with", ["0"])[0])
            uid = user["id"]
            # Mark as read
            execute("UPDATE messages SET is_read=TRUE WHERE to_member_id=%s AND from_member_id=%s AND is_read=FALSE", [uid, other])
            rows = fetchall("""
                SELECT msg.*, m.first_name, m.last_name FROM messages msg
                JOIN members m ON m.id = msg.from_member_id
                WHERE (from_member_id=%s AND to_member_id=%s) OR (from_member_id=%s AND to_member_id=%s)
                ORDER BY created_at ASC LIMIT 200
            """, [uid, other, other, uid])
            return self._json(200, rows)

        # --- ENDORSEMENTS ---
        elif action == "endorsements":
            mid = int(qs.get("member_id", ["0"])[0])
            rows = fetchall("""
                SELECT e.skill, e.comment, e.created_at, m.first_name, m.last_name, m.company
                FROM endorsements e JOIN members m ON m.id = e.from_member_id
                WHERE e.to_member_id = %s ORDER BY e.created_at DESC
            """, [mid])
            return self._json(200, rows)

        # --- POLLS ---
        elif action == "polls":
            polls = fetchall("""SELECT p.*, m.first_name, m.last_name,
                (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id=p.id) as total_votes
                FROM polls p LEFT JOIN members m ON m.id=p.created_by
                WHERE p.is_active=TRUE ORDER BY p.created_at DESC""")
            for p in polls:
                p["options"] = fetchall("""SELECT po.id, po.label,
                    (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id=po.id) as votes
                    FROM poll_options po WHERE po.poll_id=%s ORDER BY po.sort_order""", [p["id"]])
                if user:
                    p["my_votes"] = [v["option_id"] for v in fetchall(
                        "SELECT option_id FROM poll_votes WHERE poll_id=%s AND member_id=%s", [p["id"], user["id"]])]
            return self._json(200, polls)

        # --- NOTIFICATIONS ---
        elif action == "notifications":
            if not user: return self._json(401, {"error": "Auth requise"})
            rows = fetchall("SELECT * FROM notifications WHERE member_id=%s ORDER BY created_at DESC LIMIT 30", [user["id"]])
            unread = fetchone("SELECT COUNT(*) as n FROM notifications WHERE member_id=%s AND is_read=FALSE", [user["id"]])
            return self._json(200, {"items": rows, "unread": unread["n"] if unread else 0})

        # --- MEMBER PROFILE (public) ---
        elif action == "profile":
            mid = int(qs.get("id", ["0"])[0])
            m = fetchone("""SELECT id, first_name, last_name, company, job_title, sector, bio, photo_url,
                skills, badges, certifications, experience_years, education, location, website_url,
                linkedin_url, is_freelance, daily_rate, availability, membership_type, is_board, joined_at
                FROM members WHERE id=%s AND status='active'""", [mid])
            if m:
                m["projects"] = fetchall("SELECT * FROM member_projects WHERE member_id=%s ORDER BY year DESC", [mid])
                m["endorsements"] = fetchall("""
                    SELECT e.skill, e.comment, m2.first_name, m2.last_name
                    FROM endorsements e JOIN members m2 ON m2.id = e.from_member_id
                    WHERE e.to_member_id=%s""", [mid])
            return self._json(200, m or {"error": "Membre introuvable"})

        # --- FREELANCES ---
        elif action == "freelances":
            rows = fetchall("""SELECT id, first_name, last_name, company, job_title, sector, skills, badges,
                location, daily_rate, availability, bio
                FROM members WHERE is_freelance=TRUE AND status='active' ORDER BY last_name""")
            return self._json(200, rows)

        return self._json(400, {"error": "Action inconnue"})

    def do_POST(self):
        user = self._user()
        if not user: return self._json(401, {"error": "Auth requise"})
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "")

        if action == "post_feed":
            content = (body.get("content") or "").strip()
            if not content: return self._json(400, {"error": "Contenu requis"})
            execute("INSERT INTO feed_posts (author_id, content, post_type, link_url, link_title) VALUES (%s,%s,%s,%s,%s)",
                [user["id"], content, body.get("post_type","text"), body.get("link_url"), body.get("link_title")])
            return self._json(200, {"ok": True})

        elif action == "comment_feed":
            execute("INSERT INTO feed_comments (post_id, author_id, content) VALUES (%s,%s,%s)",
                [body["post_id"], user["id"], body["content"]])
            execute("UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id=%s", [body["post_id"]])
            return self._json(200, {"ok": True})

        elif action == "like_feed":
            try:
                execute("INSERT INTO feed_likes (post_id, member_id) VALUES (%s,%s)", [body["post_id"], user["id"]])
                execute("UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id=%s", [body["post_id"]])
            except Exception as e:
                if "duplicate" not in str(e).lower() and "unique" not in str(e).lower():
                    raise
            return self._json(200, {"ok": True})

        elif action == "send_message":
            to = body.get("to_member_id")
            content = (body.get("content") or "").strip()
            if not to or not content: return self._json(400, {"error": "Destinataire et message requis"})
            execute("INSERT INTO messages (from_member_id, to_member_id, content) VALUES (%s,%s,%s)",
                [user["id"], to, content])
            execute("INSERT INTO notifications (member_id, type, title, content) VALUES (%s,'message',%s,%s)",
                [to, f"Message de {user['first_name']} {user['last_name']}", content[:100]])
            return self._json(200, {"ok": True})

        elif action == "endorse":
            execute("INSERT INTO endorsements (from_member_id, to_member_id, skill, comment) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                [user["id"], body["member_id"], body["skill"], body.get("comment","")])
            execute("INSERT INTO notifications (member_id, type, title, content) VALUES (%s,'endorsement',%s,%s)",
                [body["member_id"], f"{user['first_name']} valide votre competence", body["skill"]])
            return self._json(200, {"ok": True})

        elif action == "apply_job":
            execute("INSERT INTO job_applications (job_id, member_id, cover_letter) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                [body["job_id"], user["id"], body.get("cover_letter","")])
            return self._json(200, {"ok": True, "message": "Candidature envoyee"})

        elif action == "post_job":
            execute("""INSERT INTO jobs (title, company, location, contract_type, salary_range, description, sector, is_freelance, posted_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                [body.get("title"), body.get("company"), body.get("location"), body.get("contract_type"),
                 body.get("salary_range"), body.get("description"), body.get("sector"), body.get("is_freelance",False), user["id"]])
            return self._json(200, {"ok": True})

        elif action == "add_project":
            execute("INSERT INTO member_projects (member_id, title, description, role, company, year, tags) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [user["id"], body.get("title"), body.get("description"), body.get("role"), body.get("company"), body.get("year"), body.get("tags",[])])
            return self._json(200, {"ok": True})

        elif action == "read_notifications":
            execute("UPDATE notifications SET is_read=TRUE WHERE member_id=%s", [user["id"]])
            return self._json(200, {"ok": True})

        # --- POLLS ---
        elif action == "create_poll":
            if not user.get("is_admin"): return self._json(403, {"error": "Admin requis"})
            poll = execute("""INSERT INTO polls (title, description, is_anonymous, multiple_choice, ends_at, created_by)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                [body["title"], body.get("description",""), body.get("is_anonymous",False),
                 body.get("multiple_choice",False), body.get("ends_at"), user["id"]])
            for i, opt in enumerate(body.get("options",[])):
                execute("INSERT INTO poll_options (poll_id, label, sort_order) VALUES (%s,%s,%s)",
                    [poll["id"], opt, i])
            return self._json(200, {"ok": True, "poll_id": poll["id"]})

        elif action == "vote_poll":
            poll_id = body["poll_id"]
            option_id = body["option_id"]
            poll = fetchone("SELECT * FROM polls WHERE id=%s AND is_active=TRUE", [poll_id])
            if not poll: return self._json(400, {"error": "Sondage ferme"})
            if not poll.get("multiple_choice"):
                execute("DELETE FROM poll_votes WHERE poll_id=%s AND member_id=%s", [poll_id, user["id"]])
            execute("INSERT INTO poll_votes (poll_id, option_id, member_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                [poll_id, option_id, user["id"]])
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
