"""GET/POST /api/events — Liste des evenements + inscriptions."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json
from api._shared.db import fetchall, fetchone, execute
from api.auth import get_member_from_token

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)

        action = qs.get("action", [""])[0]

        # ICS calendar feed
        if action == "calendar":
            events = fetchall("SELECT * FROM events WHERE is_published=TRUE ORDER BY start_date DESC LIMIT 100")
            lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AFFI//Agenda//FR','X-WR-CALNAME:Agenda AFFI']
            for e in events:
                start = (e.get('start_date') or '').replace('-','').replace(':','').replace(' ','T')[:15]
                if not start: continue
                if 'T' not in start: start += 'T000000'
                lines.extend(['BEGIN:VEVENT',f'DTSTART:{start}Z',f'SUMMARY:{e.get("title","")}',
                    f'LOCATION:{e.get("location","")}',f'URL:https://affi-asso.vercel.app/#agenda','END:VEVENT'])
            lines.append('END:VCALENDAR')
            self.send_response(200)
            self.send_header("Content-Type", "text/calendar; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write('\r\n'.join(lines).encode('utf-8'))
            return

        # My registrations
        if action == "my_registrations":
            token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
            user = get_member_from_token(token)
            if not user:
                self._json(200, [])
                return
            rows = fetchall("""SELECT r.event_id, r.status, r.registered_at,
                e.title, e.start_date, e.end_date, e.location, e.event_type, e.description, e.max_attendees
                FROM event_registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.member_id = %s
                ORDER BY e.start_date DESC""", [user["id"]])
            self._json(200, rows)
            return

        # Single event by ID
        id_param = qs.get("id", [""])[0]
        if id_param:
            try:
                eid = int(id_param)
            except (ValueError, TypeError):
                self._json(400, {"error": "ID invalide"})
                return
            row = fetchone("SELECT e.*, (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as reg_count FROM events e WHERE e.id = %s", [eid])
            if row:
                regs = fetchall("SELECT m.first_name, m.last_name, m.company FROM event_registrations r JOIN members m ON r.member_id = m.id WHERE r.event_id = %s", [eid])
                row['registrants'] = [{'first_name': r['first_name'], 'last_name': r['last_name'], 'company': r.get('company','')} for r in regs]
            self._json(200, row)
            return

        upcoming = qs.get("upcoming", [""])[0]
        event_type = qs.get("type", [""])[0]
        search = qs.get("search", [""])[0]
        try:
            limit = max(1, min(int(qs.get("limit", ["20"])[0]), 200))
        except (ValueError, TypeError):
            limit = 20

        clauses = ["e.is_published=TRUE"]
        params = []

        if upcoming:
            clauses.append("e.start_date >= NOW()")

        if event_type:
            clauses.append("e.event_type = %s")
            params.append(event_type)

        if search:
            clauses.append("e.title ILIKE %s")
            params.append(f"%%{search}%%")

        where = " WHERE " + " AND ".join(clauses)
        order = "e.start_date ASC" if upcoming else "e.start_date DESC"
        params.append(limit)

        rows = fetchall(f"""SELECT e.*,
            (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) as reg_count
            FROM events e{where}
            ORDER BY {order} LIMIT %s""", params)
        self._json(200, rows)

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except (ValueError, TypeError):
            length = 0
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "")

        # Guest registration - no auth required
        if action == "guest_register":
            event_id = body.get("event_id")
            name = (body.get("name") or "").strip()
            email = (body.get("email") or "").strip()
            if not name or not email or not event_id:
                return self._json(400, {"error": "Nom et email requis"})
            try:
                event_id = int(event_id)
            except (ValueError, TypeError):
                return self._json(400, {"error": "ID evenement invalide"})
            execute("""INSERT INTO contact_messages (name, email, subject, message)
                VALUES (%s, %s, %s, %s)""",
                [name, email, f"Inscription evenement #{event_id}",
                 f"Inscription: {name} ({email})\nEntreprise: {body.get('company','')}\nTel: {body.get('phone','')}\nEvenement ID: {event_id}"])
            return self._json(200, {"ok": True, "message": "Inscription enregistree"})

        # All other actions require auth
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        user = get_member_from_token(token)
        if not user:
            return self._json(403, {"error": "Connexion requise"})

        if action == "register":
            event_id = body.get("event_id")
            try:
                event_id = int(event_id)
            except (ValueError, TypeError):
                return self._json(400, {"error": "ID evenement invalide"})
            existing = fetchone("SELECT id FROM event_registrations WHERE event_id=%s AND member_id=%s", [event_id, user["id"]])
            if existing:
                self._json(200, {"ok": True, "message": "Deja inscrit"})
                return
            # Check capacity
            event = fetchone("SELECT max_attendees FROM events WHERE id=%s", [event_id])
            if event and event.get("max_attendees"):
                reg_count = fetchone("SELECT COUNT(*) as n FROM event_registrations WHERE event_id=%s", [event_id])
                if reg_count and reg_count["n"] >= event["max_attendees"]:
                    execute("INSERT INTO event_registrations (event_id, member_id, status) VALUES (%s,%s,'waitlist') ON CONFLICT DO NOTHING", [event_id, user["id"]])
                    return self._json(200, {"ok": True, "status": "waitlist", "message": "Événement complet — vous êtes sur la liste d'attente"})
            execute("INSERT INTO event_registrations (event_id, member_id) VALUES (%s, %s)", [event_id, user["id"]])
            self._json(200, {"ok": True, "message": "Inscription confirmee"})
        elif action == "send_reminders":
            if not user.get("is_admin"):
                return self._json(403, {"error": "Admin requis"})

            import datetime
            today = datetime.date.today()
            j7 = today + datetime.timedelta(days=7)
            j1 = today + datetime.timedelta(days=1)

            sent = 0
            for delta_label, target_date in [("J-7", j7), ("J-1", j1)]:
                events = fetchall("SELECT e.*, (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id=e.id) as reg_count FROM events e WHERE DATE(e.start_date)=%s AND e.is_published=TRUE", [target_date.isoformat()])
                for event in events:
                    regs = fetchall("""SELECT m.email, m.first_name FROM event_registrations r
                        JOIN members m ON r.member_id=m.id WHERE r.event_id=%s""", [event["id"]])
                    for reg in regs:
                        try:
                            from api.email import send_email, make_html_email
                            html = make_html_email(f"Rappel {delta_label} — {event['title']}", f"""
                                <p>Bonjour {reg['first_name']},</p>
                                <p>Nous vous rappelons votre inscription à l'événement :</p>
                                <div style="background:#f0f4f8;border-radius:8px;padding:16px;margin:16px 0">
                                    <strong style="font-size:16px;color:#1a3c6e">{event['title']}</strong><br>
                                    <span>📅 {event['start_date'][:10]}</span>
                                    {' · 📍 ' + event.get('location','') if event.get('location') else ''}
                                </div>
                                <p style="font-size:13px;color:#6c757d">À bientôt !</p>
                            """)
                            send_email(reg['email'], f"[AFFI] Rappel {delta_label} — {event['title']}", html)
                            sent += 1
                        except: pass
            return self._json(200, {"ok": True, "sent": sent})

        elif action == "unregister":
            event_id = body.get("event_id")
            try:
                event_id = int(event_id)
            except (ValueError, TypeError):
                return self._json(400, {"error": "ID evenement invalide"})
            execute("DELETE FROM event_registrations WHERE event_id=%s AND member_id=%s", [event_id, user["id"]])
            self._json(200, {"ok": True, "message": "Desinscription confirmee"})
        else:
            self._json(400, {"error": "Action inconnue"})

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
