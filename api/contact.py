"""POST /api/contact — Formulaire de contact."""
from http.server import BaseHTTPRequestHandler
import json
from api._shared.db import execute

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        name = body.get("name", "").strip()
        email = body.get("email", "").strip()
        subject = body.get("subject", "").strip()
        message = body.get("message", "").strip()
        if not name or not email or not message:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Champs requis: name, email, message"}).encode())
            return
        execute("INSERT INTO contact_messages (name, email, subject, message) VALUES (%s,%s,%s,%s)",
                [name, email, subject, message])
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "message": "Message envoye"}).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
