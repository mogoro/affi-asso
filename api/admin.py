"""API /api/admin — Administration complete (membres, evenements, news, publications, annonces, messages, import/export, RGPD)."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json, csv, io, traceback, secrets
from api._shared.db import fetchall, fetchone, execute, get_conn
from api.auth import get_member_from_token, hash_pw

def _safe_int(value, default=0, min_val=None, max_val=None):
    """Convert value to int safely, with optional clamping."""
    try:
        result = int(value)
    except (ValueError, TypeError):
        result = default
    if min_val is not None:
        result = max(result, min_val)
    if max_val is not None:
        result = min(result, max_val)
    return result

class handler(BaseHTTPRequestHandler):
    def _get_admin(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        user = get_member_from_token(token)
        if not user or not user.get("is_admin"):
            return None
        return user

    def do_GET(self):
      try:
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
            mid = _safe_int(qs.get("id", ["0"])[0])
            m = fetchone("SELECT * FROM members WHERE id = %s", [mid])
            if m and "password_hash" in m:
                del m["password_hash"]
            return self._json(200, m or {"error": "Membre introuvable"})

        elif action == "events":
            rows = fetchall("""SELECT e.*,
                (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as reg_count,
                (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.attended = TRUE) as attended_count
                FROM events e ORDER BY e.start_date DESC LIMIT 100""")
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

        elif action == "pending_content":
            pending_events = fetchall("""SELECT e.*, m.first_name, m.last_name
                FROM events e LEFT JOIN members m ON e.created_by = m.id
                WHERE e.is_published = FALSE ORDER BY e.created_at DESC""")
            pending_news = fetchall("""SELECT n.*, m.first_name, m.last_name
                FROM news n LEFT JOIN members m ON n.author_id = m.id
                WHERE n.is_published = FALSE ORDER BY n.created_at DESC""")
            pending_announcements = fetchall("""SELECT a.*, m.first_name, m.last_name
                FROM member_announcements a JOIN members m ON a.author_id = m.id
                WHERE a.is_active = FALSE ORDER BY a.created_at DESC""")
            return self._json(200, {
                "events": pending_events,
                "news": pending_news,
                "announcements": pending_announcements,
                "total": len(pending_events) + len(pending_news) + len(pending_announcements)
            })

        elif action == "event_registrations":
            event_id = qs.get("event_id", ["0"])[0]
            rows = fetchall("""SELECT r.id, r.status, r.registered_at, r.attended, r.attended_at,
                m.first_name, m.last_name, m.email, m.company, m.phone
                FROM event_registrations r
                JOIN members m ON r.member_id = m.id
                WHERE r.event_id = %s ORDER BY r.registered_at DESC""", [_safe_int(event_id)])
            return self._json(200, rows)

        elif action == "messages":
            rows = fetchall("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100")
            return self._json(200, rows)

        elif action == "partners":
            rows = fetchall("SELECT * FROM partners ORDER BY sort_order ASC, name ASC")
            return self._json(200, rows)

        elif action == "subscriptions":
            year = qs.get("year", [str(__import__('datetime').datetime.now().year)])[0]
            rows = fetchall("""SELECT s.*, m.first_name, m.last_name, m.email, m.company, m.membership_type
                FROM subscriptions s JOIN members m ON s.member_id = m.id
                WHERE s.year = %s ORDER BY m.last_name""", [int(year)])
            return self._json(200, rows)

        elif action == "dashboard":
            stats = {}
            for key, sql in [
                ("total_members", "SELECT COUNT(*) FROM members WHERE archived_at IS NULL"),
                ("active_members", "SELECT COUNT(*) FROM members WHERE status='active' AND archived_at IS NULL"),
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
                ("mentors", "SELECT COUNT(*) FROM members WHERE is_mentor=TRUE AND status='active'"),
                ("consent_annuaire", "SELECT COUNT(*) FROM members WHERE consent_annuaire=TRUE AND status='active'"),
                ("pending_events", "SELECT COUNT(*) FROM events WHERE is_published=FALSE"),
                ("pending_news", "SELECT COUNT(*) FROM news WHERE is_published=FALSE"),
            ]:
                r = fetchone(sql)
                stats[key] = list(r.values())[0] if r else 0
            stats["by_sector"] = fetchall("SELECT sector, COUNT(*) as n FROM members WHERE status='active' AND sector IS NOT NULL GROUP BY sector ORDER BY n DESC")
            stats["by_type"] = fetchall("SELECT membership_type as type, COUNT(*) as n FROM members GROUP BY membership_type ORDER BY n DESC")
            stats["by_region"] = fetchall("SELECT region, COUNT(*) as n FROM members WHERE status='active' AND region IS NOT NULL GROUP BY region ORDER BY n DESC")
            stats["by_specialty"] = fetchall("SELECT specialty, COUNT(*) as n FROM members WHERE status='active' AND specialty IS NOT NULL GROUP BY specialty ORDER BY n DESC")
            stats["recent_members"] = fetchall("SELECT id, first_name, last_name, email, company, status, joined_at FROM members ORDER BY joined_at DESC LIMIT 5")
            # Alertes
            stats["incomplete_profiles"] = fetchone("SELECT COUNT(*) FROM members WHERE status='active' AND (sector IS NULL OR company IS NULL OR specialty IS NULL)")
            stats["incomplete_profiles"] = list(stats["incomplete_profiles"].values())[0] if stats["incomplete_profiles"] else 0
            return self._json(200, stats)

        elif action == "export_csv":
            status_f = qs.get("status", [""])[0]
            sector_f = qs.get("sector", [""])[0]
            region_f = qs.get("region", [""])[0]
            clauses, params = ["archived_at IS NULL"], []
            if status_f: clauses.append("status = %s"); params.append(status_f)
            if sector_f: clauses.append("sector = %s"); params.append(sector_f)
            if region_f: clauses.append("region = %s"); params.append(region_f)
            where = " WHERE " + " AND ".join(clauses)
            rows = fetchall(f"""SELECT id, first_name, last_name, email, phone, company, job_title, sector,
                specialty, region, membership_type, status, is_mentor, is_board, consent_annuaire,
                consent_newsletter, joined_at, last_login
                FROM members {where} ORDER BY last_name ASC""", params)
            output = io.StringIO()
            if rows:
                writer = csv.DictWriter(output, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename=affi_membres_export.csv")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(output.getvalue().encode("utf-8"))
            return

        elif action == "stats_dashboard":
            total = fetchone("SELECT COUNT(*) as n FROM members WHERE status='active'")
            verified = fetchone("SELECT COUNT(*) as n FROM members WHERE is_verified=TRUE")
            board = fetchone("SELECT COUNT(*) as n FROM members WHERE is_board=TRUE")
            mentors = fetchone("SELECT COUNT(*) as n FROM members WHERE is_mentor=TRUE")
            by_sector = fetchall("SELECT sector, COUNT(*) as n FROM members WHERE status='active' AND sector IS NOT NULL GROUP BY sector ORDER BY n DESC")
            by_region = fetchall("SELECT region, COUNT(*) as n FROM members WHERE status='active' AND region IS NOT NULL GROUP BY region ORDER BY n DESC")
            by_month = fetchall("""SELECT TO_CHAR(joined_at, 'YYYY-MM') as month, COUNT(*) as n
                FROM members WHERE joined_at IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12""")
            events_count = fetchone("SELECT COUNT(*) as n FROM events WHERE is_published=TRUE")
            upcoming = fetchone("SELECT COUNT(*) as n FROM events WHERE start_date >= NOW()")
            return self._json(200, {
                "total": total["n"], "verified": verified["n"], "board": board["n"], "mentors": mentors["n"],
                "by_sector": by_sector, "by_region": by_region, "by_month": by_month,
                "events_total": events_count["n"], "events_upcoming": upcoming["n"]
            })

        elif action == "challenge_subjects":
            rows = fetchall("SELECT * FROM challenge_subjects ORDER BY created_at DESC")
            return self._json(200, rows)

        elif action == "challenge_teams":
            subject_id = qs.get("subject_id", [""])[0]
            if subject_id:
                rows = fetchall("""SELECT t.*, s.title as subject_title,
                    (SELECT json_agg(json_build_object('name',tm.name,'email',tm.email,'role',tm.role))
                     FROM challenge_team_members tm WHERE tm.team_id=t.id) as members
                    FROM challenge_teams t JOIN challenge_subjects s ON t.subject_id=s.id
                    WHERE t.subject_id=%s ORDER BY t.created_at""", [int(subject_id)])
            else:
                rows = fetchall("""SELECT t.*, s.title as subject_title FROM challenge_teams t
                    JOIN challenge_subjects s ON t.subject_id=s.id ORDER BY t.created_at DESC LIMIT 100""")
            return self._json(200, rows)

        elif action == "connexions":
            rows = fetchall("""SELECT m.id, m.first_name, m.last_name, m.email, m.company,
                    m.last_login, m.role, m.is_admin,
                    s.created_at as session_start, s.expires_at as session_expires
                FROM members m
                LEFT JOIN sessions s ON m.id = s.member_id AND s.expires_at > NOW()
                WHERE m.status = 'active' AND m.last_login IS NOT NULL
                ORDER BY m.last_login DESC LIMIT 100""")
            return self._json(200, rows)

        elif action == "logs":
            rows = fetchall("""SELECT l.*, m.first_name, m.last_name
                FROM logs l LEFT JOIN members m ON l.user_id = m.id
                ORDER BY l.created_at DESC LIMIT 100""")
            return self._json(200, rows)

        elif action == "board":
            rows = fetchall("""SELECT b.id, b.member_id, b.role, b.title, b.sort_order, b.is_active, b.category, b.level,
                m.first_name, m.last_name, m.company, m.photo_url, m.email
                FROM board_members b
                LEFT JOIN members m ON b.member_id = m.id
                WHERE b.is_active = TRUE
                ORDER BY b.level ASC, b.sort_order ASC, b.role ASC""")
            return self._json(200, rows)

        elif action == "helloasso_sync":
            # HelloAsso API integration (requires HELLOASSO_API_KEY env var)
            import os
            api_key = os.environ.get("HELLOASSO_API_KEY", "")
            if not api_key:
                return self._json(200, {"ok": False, "message": "Clé API HelloAsso non configurée. Ajoutez HELLOASSO_API_KEY dans les variables Vercel.", "synced": 0})
            # TODO: When API key is configured, sync here
            # https://api.helloasso.com/v5/organizations/{slug}/forms/Membership/{formSlug}/payments
            return self._json(200, {"ok": True, "message": "Synchronisation HelloAsso à configurer", "synced": 0})

        return self._json(400, {"error": "Action inconnue"})
      except Exception as e:
        return self._json(500, {"error": "Erreur interne"})

    def do_POST(self):
      try:
        admin = self._get_admin()
        if not admin:
            return self._json(403, {"error": "Acces administrateur requis"})
        length = _safe_int(self.headers.get('Content-Length', 0))
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

        elif action == "set_role":
            mid = body.get("id")
            new_role = body.get("role", "member")
            is_admin = new_role == "admin"
            execute("UPDATE members SET role=%s, is_admin=%s WHERE id=%s", [new_role, is_admin, mid])
            self._log(admin["id"], "set_role", f"#{mid} -> {new_role}")
            return self._json(200, {"ok": True, "message": f"Role mis a jour: {new_role}"})

        elif action == "update_member":
            fields = {}
            for k in ("first_name","last_name","email","phone","company","job_title","sector",
                       "membership_type","status","specialty","region","role","is_mentor",
                       "is_admin","is_board","consent_annuaire","consent_newsletter"):
                if k in body:
                    fields[k] = body[k]
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE members SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            self._log(admin["id"], "update_member", f"#{body.get('id')}")
            return self._json(200, {"ok": True, "message": "Membre mis a jour"})

        elif action == "create_member":
            email = (body.get("email") or "").strip().lower()
            if not email:
                return self._json(400, {"error": "Email requis"})
            existing = fetchone("SELECT id FROM members WHERE email = %s", [email])
            if existing:
                return self._json(400, {"error": "Email deja utilise"})
            password = body.get("password") or secrets.token_urlsafe(12)
            pw_hash = hash_pw(password)
            execute("""INSERT INTO members (email, password_hash, first_name, last_name, phone, company,
                job_title, sector, specialty, region, membership_type, status, is_admin, is_board,
                is_mentor, role, consent_annuaire, consent_newsletter, consent_date)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())""",
                [email, pw_hash, body.get("first_name",""), body.get("last_name",""),
                 body.get("phone"), body.get("company"), body.get("job_title"),
                 body.get("sector"), body.get("specialty"), body.get("region"),
                 body.get("membership_type","standard"), body.get("status","active"),
                 body.get("is_admin", False), body.get("is_board", False),
                 body.get("is_mentor", False), body.get("role", "member"),
                 body.get("consent_annuaire", False), body.get("consent_newsletter", False)])
            self._log(admin["id"], "create_member", f"Cree: {email}")
            return self._json(200, {"ok": True, "message": f"Membre {email} cree"})

        elif action == "import_csv":
            rows_data = body.get("rows", [])
            if not rows_data:
                return self._json(400, {"error": "Aucune donnee a importer"})
            imported, errors = 0, []
            for i, row in enumerate(rows_data):
                email = (row.get("email") or "").strip().lower()
                if not email:
                    errors.append(f"Ligne {i+1}: email manquant")
                    continue
                existing = fetchone("SELECT id FROM members WHERE email = %s", [email])
                if existing:
                    errors.append(f"Ligne {i+1}: {email} existe deja")
                    continue
                pw_hash = hash_pw(secrets.token_urlsafe(12))
                try:
                    execute("""INSERT INTO members (email, password_hash, first_name, last_name, company,
                        job_title, sector, specialty, region, membership_type, status,
                        consent_annuaire, consent_newsletter, consent_date)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())""",
                        [email, pw_hash, row.get("first_name",""), row.get("last_name",""),
                         row.get("company"), row.get("job_title"), row.get("sector"),
                         row.get("specialty"), row.get("region"),
                         row.get("membership_type","standard"), row.get("status","active"),
                         str(row.get("consent_annuaire","")).lower() in ("oui","true","1"),
                         str(row.get("consent_newsletter","")).lower() in ("oui","true","1")])
                    imported += 1
                except Exception as e:
                    errors.append(f"Ligne {i+1}: {str(e)[:80]}")
            self._log(admin["id"], "import_csv", f"Importe: {imported}, Erreurs: {len(errors)}")
            return self._json(200, {"ok": True, "imported": imported, "errors": errors})

        elif action == "archive_member":
            execute("UPDATE members SET archived_at=NOW(), status='blocked' WHERE id=%s AND is_admin=FALSE", [body["id"]])
            self._log(admin["id"], "archive_member", f"Archive: #{body['id']}")
            return self._json(200, {"ok": True, "message": "Membre archive"})

        elif action == "delete_member":
            # Soft delete: archive au lieu de supprimer definitivement
            execute("UPDATE members SET archived_at=NOW(), status='deleted', email=CONCAT('deleted_', id, '_', email) WHERE id=%s AND is_admin=FALSE", [body["id"]])
            # Nettoyage des sessions actives
            execute("DELETE FROM sessions WHERE member_id=%s", [body["id"]])
            self._log(admin["id"], "delete_member", f"Archive (soft delete): #{body['id']}")
            return self._json(200, {"ok": True, "message": "Membre supprime (archive)"})

        # === EVENTS ===
        elif action == "create_event":
            execute("""INSERT INTO events (title, event_type, description, location, address,
                start_date, end_date, image_url, max_attendees, price, is_members_only, is_published,
                organizer, tags)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                [body.get("title"), body.get("event_type","conference"), body.get("description"),
                 body.get("location"), body.get("address"),
                 body.get("start_date"), body.get("end_date"),
                 body.get("image_url"), body.get("max_attendees"), body.get("price", 0),
                 body.get("is_members_only", False), body.get("is_published", True),
                 body.get("organizer"), body.get("tags")])
            self._log(admin["id"], "create_event", f"Cree: {body.get('title')}")
            return self._json(200, {"ok": True, "message": "Evenement cree"})

        elif action == "update_event":
            fields = {k: body[k] for k in ("title","event_type","description","location","address","start_date","end_date","image_url","max_attendees","price","is_members_only","is_published","organizer","tags") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE events SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True, "message": "Evenement mis a jour"})

        elif action == "publish_event":
            execute("UPDATE events SET is_published=TRUE WHERE id=%s", [body["id"]])
            self._log(admin["id"], "publish_event", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Evenement publie"})

        elif action == "unpublish_event":
            execute("UPDATE events SET is_published=FALSE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Evenement depublie"})

        elif action == "delete_event":
            execute("UPDATE events SET is_published=FALSE, title=CONCAT('[SUPPRIME] ', title) WHERE id=%s", [body["id"]])
            self._log(admin["id"], "delete_event", f"#{body['id']}")
            return self._json(200, {"ok": True})

        # === NEWS ===
        elif action == "create_news":
            execute("""INSERT INTO news (title, excerpt, content, image_url, category, is_published)
                VALUES (%s,%s,%s,%s,%s,%s)""",
                [body.get("title"), body.get("excerpt"), body.get("content"),
                 body.get("image_url"), body.get("category"), body.get("is_published", True)])
            self._log(admin["id"], "create_news", f"Cree: {body.get('title')}")
            return self._json(200, {"ok": True, "message": "Actualite creee"})

        elif action == "update_news":
            fields = {k: body[k] for k in ("title","excerpt","content","image_url","category","is_published") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE news SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True})

        elif action == "publish_news":
            execute("UPDATE news SET is_published=TRUE WHERE id=%s", [body["id"]])
            self._log(admin["id"], "publish_news", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Actualite publiee"})

        elif action == "unpublish_news":
            execute("UPDATE news SET is_published=FALSE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Actualite depubliee"})

        elif action == "delete_news":
            execute("UPDATE news SET is_published=FALSE, title=CONCAT('[SUPPRIME] ', title) WHERE id=%s", [body["id"]])
            self._log(admin["id"], "delete_news", f"#{body['id']}")
            return self._json(200, {"ok": True})

        # === PUBLICATIONS ===
        elif action == "create_publication":
            execute("INSERT INTO publications (title, category, content, excerpt, is_published) VALUES (%s,%s,%s,%s,%s)",
                [body.get("title"), body.get("category"), body.get("content"), body.get("excerpt"), body.get("is_published", True)])
            return self._json(200, {"ok": True})

        elif action == "delete_publication":
            execute("UPDATE publications SET is_published=FALSE, title=CONCAT('[SUPPRIME] ', title) WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === PARTNERS ===
        elif action == "create_partner":
            execute("""INSERT INTO partners (name, description, website_url, logo_url, sector, city, address, contact, sort_order)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                [body.get("name"), body.get("description"), body.get("website_url"),
                 body.get("logo_url"), body.get("sector"), body.get("city"),
                 body.get("address"), body.get("contact"), _safe_int(body.get("sort_order", 0))])
            self._log(admin["id"], "create_partner", f"Cree: {body.get('name')}")
            return self._json(200, {"ok": True, "message": "Partenaire cree"})

        elif action == "update_partner":
            fields = {k: body[k] for k in ("name","description","website_url","logo_url","sector","city","address","contact","sort_order","is_active") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE partners SET {sets} WHERE id=%s", list(fields.values()) + [_safe_int(body.get("id"))])
            self._log(admin["id"], "update_partner", f"#{body.get('id')}")
            return self._json(200, {"ok": True, "message": "Partenaire mis a jour"})

        elif action == "delete_partner":
            execute("UPDATE partners SET is_active=FALSE, name=CONCAT('[SUPPRIME] ', name) WHERE id=%s", [_safe_int(body.get("id"))])
            self._log(admin["id"], "delete_partner", f"#{body.get('id')}")
            return self._json(200, {"ok": True, "message": "Partenaire supprime"})

        # === ANNOUNCEMENTS MODERATION ===
        elif action == "approve_announcement":
            execute("UPDATE member_announcements SET is_active=TRUE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Annonce approuvee"})

        elif action == "reject_announcement":
            execute("UPDATE member_announcements SET is_active=FALSE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True, "message": "Annonce rejetee"})

        elif action == "delete_announcement":
            execute("UPDATE member_announcements SET is_active=FALSE, title=CONCAT('[SUPPRIME] ', title) WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === BOARD MEMBERS ===
        elif action == "create_board_member":
            execute("""INSERT INTO board_members (member_id, role, title, sort_order, category, level)
                VALUES (%s,%s,%s,%s,%s,%s)""",
                [body.get("member_id"), body.get("role"), body.get("title"),
                 _safe_int(body.get("sort_order", 0)), body.get("category", "bureau"), _safe_int(body.get("level", 2))])
            self._log(admin["id"], "create_board_member", f"Role: {body.get('role')}")
            return self._json(200, {"ok": True, "message": "Poste cree"})

        elif action == "update_board_member":
            fields = {k: body[k] for k in ("member_id","role","title","sort_order","category","level","is_active") if k in body}
            if fields:
                sets = ", ".join(f"{k}=%s" for k in fields)
                execute(f"UPDATE board_members SET {sets} WHERE id=%s", list(fields.values()) + [body["id"]])
            return self._json(200, {"ok": True, "message": "Poste mis a jour"})

        elif action == "delete_board_member":
            execute("UPDATE board_members SET is_active=FALSE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === MESSAGES ===
        elif action == "mark_read":
            execute("UPDATE contact_messages SET is_read=TRUE WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        elif action == "delete_message":
            execute("DELETE FROM contact_messages WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === TOGGLE / ATTENDANCE / COMM ===
        elif action == "toggle_verified":
            mid = body.get("id")
            cur = fetchone("SELECT is_verified FROM members WHERE id=%s", [mid])
            if cur:
                execute("UPDATE members SET is_verified = NOT is_verified WHERE id=%s", [mid])
            return self._json(200, {"ok": True})

        elif action == "event_attend":
            reg_id = _safe_int(body.get("registration_id"))
            execute("UPDATE event_registrations SET attended=TRUE, attended_at=NOW() WHERE id=%s", [reg_id])
            return self._json(200, {"ok": True})

        elif action == "event_unattend":
            reg_id = _safe_int(body.get("registration_id"))
            execute("UPDATE event_registrations SET attended=FALSE, attended_at=NULL WHERE id=%s", [reg_id])
            return self._json(200, {"ok": True})

        elif action == "send_event_comm":
            execute("""INSERT INTO event_communications (event_id, subject, body, sent_by, recipient_type)
                VALUES (%s,%s,%s,%s,%s)""",
                [body["event_id"], body["subject"], body["body"], admin["id"], body.get("recipient_type","registered")])
            return self._json(200, {"ok": True, "message": "Communication enregistree"})

        # === SUBSCRIPTIONS ===
        elif action == "create_subscription":
            execute("""INSERT INTO subscriptions (member_id, year, amount, payment_method, status)
                VALUES (%s, %s, %s, %s, %s) ON CONFLICT (member_id, year) DO UPDATE
                SET amount=EXCLUDED.amount, payment_method=EXCLUDED.payment_method, status=EXCLUDED.status""",
                [body["member_id"], body.get("year", __import__('datetime').datetime.now().year),
                 body.get("amount", 0), body.get("payment_method", ""), body.get("status", "pending")])
            return self._json(200, {"ok": True})

        elif action == "mark_subscription_paid":
            execute("UPDATE subscriptions SET status='paid', paid_at=NOW() WHERE id=%s", [body["id"]])
            return self._json(200, {"ok": True})

        # === CHALLENGE RIC ===
        elif action == "approve_subject":
            execute("UPDATE challenge_subjects SET status='open' WHERE id=%s", [body["id"]])
            self._log(admin["id"], "approve_subject", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Sujet approuve et ouvert"})

        elif action == "reject_subject":
            execute("UPDATE challenge_subjects SET status='rejected' WHERE id=%s", [body["id"]])
            self._log(admin["id"], "reject_subject", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Sujet rejete"})

        elif action == "approve_team":
            execute("UPDATE challenge_teams SET status='approved' WHERE id=%s", [body["id"]])
            self._log(admin["id"], "approve_team", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Equipe approuvee"})

        elif action == "reject_team":
            execute("UPDATE challenge_teams SET status='rejected' WHERE id=%s", [body["id"]])
            self._log(admin["id"], "reject_team", f"#{body['id']}")
            return self._json(200, {"ok": True, "message": "Equipe rejetee"})

        return self._json(400, {"error": "Action inconnue"})
      except Exception as e:
        return self._json(500, {"error": "Erreur interne"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _log(self, user_id, action, details=""):
        try:
            import re
            # Mask email addresses in log details
            masked = re.sub(r'[\w.+-]+@[\w-]+\.[\w.-]+', lambda m: m.group()[:3] + '***@' + m.group().split('@')[1], str(details))
            ip = self.headers.get("X-Forwarded-For", self.client_address[0] if self.client_address else "")
            execute("INSERT INTO logs (action, user_id, details, ip_address) VALUES (%s,%s,%s,%s)",
                    [action, user_id, masked, ip])
        except Exception:
            pass

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))
