"""POST /api/contact — Formulaire de contact."""
from http.server import BaseHTTPRequestHandler
import json, os
from api._shared.db import execute

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            name = body.get("name", "").strip()
            email = body.get("email", "").strip()
            subject = body.get("subject", "").strip()
            message = body.get("message", "").strip()
            if not name or not email or not message:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Champs requis: name, email, message"}).encode())
                return
            execute("INSERT INTO contact_messages (name, email, subject, message) VALUES (%s,%s,%s,%s)",
                    [name, email, subject, message])
            # Notify admin by email
            try:
                from api.email import send_email, make_html_email
                admin_email = os.environ.get("ADMIN_EMAIL", "contact@ingenieur-ferroviaire.net")
                notify_html = make_html_email("Nouveau message de contact", f"""
                    <p><strong>De :</strong> {name} ({email})</p>
                    <p><strong>Sujet :</strong> {subject}</p>
                    <div style="background:#f8f9fa;padding:16px;border-radius:6px;margin-top:12px;white-space:pre-line">{message}</div>
                """)
                send_email(admin_email, f"[AFFI Contact] {subject}", notify_html)
            except Exception:
                pass
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "message": "Message envoye"}).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Erreur interne du serveur"}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
