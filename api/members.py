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

        if action == "public_annuaire":
            # Annuaire public — pas de login requis, consent_annuaire=true uniquement
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
                clauses.append("specialty = %s"); params.append(specialty)
            if region:
                clauses.append("region = %s"); params.append(region)
            if sector:
                clauses.append("sector = %s"); params.append(sector)
            where = " AND ".join(clauses)
            rows = fetchall(f"""
                SELECT id, first_name, last_name, company, job_title, sector, specialty,
                       region, photo_url, bio, is_mentor, is_board, linkedin_url, interests, phone_visible, phone
                FROM members WHERE {where}
                ORDER BY last_name ASC LIMIT 200
            """, params)
            return self._json(200, rows)

        elif action == "board":
            rows = fetchall("""SELECT b.id, b.role, b.title, b.sort_order, b.category, b.level,
                m.first_name, m.last_name, m.company, m.photo_url
                FROM board_members b
                LEFT JOIN members m ON b.member_id = m.id
                WHERE b.is_active = TRUE
                ORDER BY b.level ASC, b.sort_order ASC""")
            return self._json(200, rows)

        elif action == "directory":
            # Annuaire membres (accessible aux membres connectes)
            if not user:
                return self._json(401, {"error": "Connexion requise"})
            search = qs.get("search", [""])[0]
            sector = qs.get("sector", [""])[0]
            company = qs.get("company", [""])[0]
            specialty = qs.get("specialty", [""])[0]
            mentor_only = qs.get("mentor", [""])[0]
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
            if specialty:
                clauses.append("specialty = %s")
                params.append(specialty)
            if mentor_only == "1":
                clauses.append("is_mentor = TRUE")
            where = " AND ".join(clauses)
            rows = fetchall(f"""
                SELECT id, first_name, last_name, company, job_title, sector, photo_url, bio,
                       membership_type, is_board, specialty, is_mentor, region, linkedin_url,
                       consent_annuaire, joined_at, interests, phone_visible, phone, availability
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
                       linkedin_url, cv_text, cv_updated_at, joined_at, specialty, is_mentor,
                       region, role, consent_annuaire, consent_newsletter, interests, phone_visible, availability
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

        elif action == "challenge_subjects":
            year = qs.get("year", [str(__import__('datetime').datetime.now().year)])[0]
            rows = fetchall("SELECT * FROM challenge_subjects WHERE year=%s AND status IN ('published','open') ORDER BY created_at DESC", [int(year)])
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
                    JOIN challenge_subjects s ON t.subject_id=s.id ORDER BY t.created_at DESC LIMIT 50""")
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
            for k in ("first_name","last_name","phone","company","job_title","sector","bio","photo_url","linkedin_url","specialty","is_mentor","region","consent_annuaire","consent_newsletter","interests","phone_visible","availability"):
                if k in body:
                    fields[k] = body[k]
            # MAJ consent_date si consentement change
            if "consent_annuaire" in body or "consent_newsletter" in body:
                fields["consent_date"] = "NOW()"
            if fields:
                sets_parts = []
                vals = []
                for k, v in fields.items():
                    if v == "NOW()":
                        sets_parts.append(f"{k} = NOW()")
                    else:
                        sets_parts.append(f"{k} = %s")
                        vals.append(v)
                sets = ", ".join(sets_parts)
                vals.append(user["id"])
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
            # Admins publish directly, members need approval
            is_active = bool(user.get("is_admin"))
            execute("INSERT INTO member_announcements (author_id, title, content, category, is_active) VALUES (%s,%s,%s,%s,%s)",
                    [user["id"], title, content, category, is_active])
            msg = "Annonce publiee" if is_active else "Annonce soumise — en attente de validation par un administrateur"
            return self._json(200, {"ok": True, "message": msg, "published": is_active})

        elif action == "propose_event":
            title = (body.get("title") or "").strip()
            if not title:
                return self._json(400, {"error": "Titre requis"})
            is_published = bool(user.get("is_admin"))
            execute("""INSERT INTO events (title, event_type, description, location, start_date, end_date,
                is_published, created_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                [title, body.get("event_type","conference"), body.get("description"),
                 body.get("location"), body.get("start_date"), body.get("end_date"),
                 is_published, user["id"]])
            msg = "Evenement cree" if is_published else "Evenement propose — en attente de validation"
            return self._json(200, {"ok": True, "message": msg, "published": is_published})

        elif action == "propose_news":
            title = (body.get("title") or "").strip()
            if not title:
                return self._json(400, {"error": "Titre requis"})
            is_published = bool(user.get("is_admin"))
            execute("INSERT INTO news (title, excerpt, content, is_published, author_id) VALUES (%s,%s,%s,%s,%s)",
                [title, body.get("excerpt"), body.get("content"), is_published, user["id"]])
            msg = "Actualite publiee" if is_published else "Actualite proposee — en attente de validation"
            return self._json(200, {"ok": True, "message": msg, "published": is_published})

        elif action == "submit_subject":
            # Company submits a challenge subject
            execute("""INSERT INTO challenge_subjects (title, description, company, contact_email, contact_name, skills_needed, status)
                VALUES (%s,%s,%s,%s,%s,%s,'pending')""",
                [body.get("title"), body.get("description"), body.get("company"),
                 body.get("contact_email"), body.get("contact_name"), body.get("skills_needed")])
            return self._json(200, {"ok": True, "message": "Sujet soumis — en attente de validation"})

        elif action == "apply_team":
            # Student team applies
            team_name = body.get("team_name")
            subject_id = body.get("subject_id")
            if not team_name or not subject_id:
                return self._json(400, {"error": "Nom d'équipe et sujet requis"})
            execute("""INSERT INTO challenge_teams (subject_id, team_name, school, motivation, status)
                VALUES (%s,%s,%s,%s,'pending')""",
                [subject_id, team_name, body.get("school"), body.get("motivation")])
            # Get team ID
            team = fetchone("SELECT id FROM challenge_teams ORDER BY id DESC LIMIT 1")
            # Add team members
            for m in body.get("members", []):
                execute("INSERT INTO challenge_team_members (team_id, name, email, role) VALUES (%s,%s,%s,%s)",
                    [team["id"], m.get("name"), m.get("email"), m.get("role","")])
            return self._json(200, {"ok": True, "message": "Candidature soumise"})

        elif action == "evaluate_team":
            # Expert evaluates
            execute("""INSERT INTO challenge_evaluations (team_id, evaluator_id, score_innovation, score_feasibility, score_presentation, score_teamwork, comments)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                [body.get("team_id"), user["id"], body.get("score_innovation",0), body.get("score_feasibility",0),
                 body.get("score_presentation",0), body.get("score_teamwork",0), body.get("comments","")])
            return self._json(200, {"ok": True, "message": "Évaluation enregistrée"})

        elif action == "my_proposals":
            events = fetchall("""SELECT id, title, event_type, start_date, is_published, created_at
                FROM events WHERE created_by = %s ORDER BY created_at DESC LIMIT 20""", [user["id"]])
            news = fetchall("""SELECT id, title, is_published, published_at, created_at
                FROM news WHERE author_id = %s ORDER BY created_at DESC LIMIT 20""", [user["id"]])
            announcements = fetchall("""SELECT id, title, category, is_active, created_at
                FROM member_announcements WHERE author_id = %s ORDER BY created_at DESC LIMIT 20""", [user["id"]])
            return self._json(200, {"events": events, "news": news, "announcements": announcements})

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
