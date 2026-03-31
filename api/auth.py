"""POST /api/auth — Login / Logout / Session check / Password reset."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json, hashlib, secrets, os
from api._shared.db import fetchone, execute, get_conn

def hash_pw(pw):
    salt = "affi2026"
    return hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()

def create_session(member_id):
    token = secrets.token_urlsafe(48)
    execute("DELETE FROM sessions WHERE member_id = %s", [member_id])
    execute("INSERT INTO sessions (token, member_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')", [token, member_id])
    execute("UPDATE members SET last_login = NOW() WHERE id = %s", [member_id])
    return token

def get_member_from_token(token):
    if not token:
        return None
    return fetchone("""
        SELECT m.id, m.email, m.first_name, m.last_name, m.company, m.job_title,
               m.sector, m.bio, m.photo_url, m.phone, m.membership_type, m.status,
               m.is_admin, m.is_board
        FROM sessions s JOIN members m ON s.member_id = m.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, [token])

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "login")

        if action == "login":
            email = (body.get("email") or "").strip().lower()
            password = body.get("password", "")
            if not email or not password:
                return self._json(400, {"error": "Email et mot de passe requis"})
            member = fetchone("SELECT id, email, password_hash, status, is_admin FROM members WHERE email = %s", [email])
            if not member or member["password_hash"] != hash_pw(password):
                return self._json(401, {"error": "Email ou mot de passe incorrect"})
            if member["status"] == "blocked":
                return self._json(403, {"error": "Compte desactive"})
            token = create_session(member["id"])
            user = get_member_from_token(token)
            return self._json(200, {"ok": True, "token": token, "user": user})

        elif action == "check":
            token = body.get("token", "")
            user = get_member_from_token(token)
            if user:
                return self._json(200, {"ok": True, "user": user})
            return self._json(401, {"error": "Session expiree"})

        elif action == "logout":
            token = body.get("token", "")
            if token:
                execute("DELETE FROM sessions WHERE token = %s", [token])
            return self._json(200, {"ok": True})

        elif action == "request_reset":
            email = (body.get("email") or "").strip().lower()
            if not email:
                return self._json(400, {"error": "Email requis"})
            member = fetchone("SELECT id, email, first_name FROM members WHERE email = %s", [email])
            if not member:
                # On ne revele pas si l'email existe ou non (securite)
                return self._json(200, {"ok": True, "message": "Si ce compte existe, un code de reinitialisation a ete genere."})
            # Generer un code de reset (6 chiffres)
            reset_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            reset_token = secrets.token_urlsafe(32)
            # Stocker dans la session avec un prefixe special
            execute("DELETE FROM sessions WHERE member_id = %s AND token LIKE 'reset_%%'", [member["id"]])
            execute("INSERT INTO sessions (token, member_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '1 hour')",
                    [f"reset_{reset_token}_{reset_code}", member["id"]])
            return self._json(200, {
                "ok": True,
                "message": "Code de reinitialisation genere.",
                "reset_token": reset_token,
                "reset_code": reset_code,
                "email": email,
                "hint": f"Communiquez ce code a {member['first_name']}: {reset_code}"
            })

        elif action == "reset_password":
            reset_token = body.get("reset_token", "")
            reset_code = body.get("reset_code", "")
            new_password = body.get("new_password", "")
            if not reset_token or not reset_code or not new_password:
                return self._json(400, {"error": "Token, code et nouveau mot de passe requis"})
            if len(new_password) < 6:
                return self._json(400, {"error": "Le mot de passe doit faire au moins 6 caracteres"})
            session = fetchone("""SELECT member_id FROM sessions
                WHERE token = %s AND expires_at > NOW()""",
                [f"reset_{reset_token}_{reset_code}"])
            if not session:
                return self._json(400, {"error": "Code invalide ou expire"})
            execute("UPDATE members SET password_hash = %s WHERE id = %s",
                    [hash_pw(new_password), session["member_id"]])
            execute("DELETE FROM sessions WHERE token LIKE 'reset_%%' AND member_id = %s", [session["member_id"]])
            return self._json(200, {"ok": True, "message": "Mot de passe modifie avec succes"})

        return self._json(400, {"error": "Action inconnue"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))
