"""POST /api/auth — Login / Logout / Session check / Password reset."""
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import json, hashlib, secrets, os, re, base64
from api._shared.db import fetchone, execute, get_conn

# bcrypt optionnel (ne marche pas sur Vercel serverless)
try:
    import bcrypt
    _HAS_BCRYPT = True
except ImportError:
    _HAS_BCRYPT = False

# === PBKDF2 comme methode de hash principale (fonctionne partout) ===
_PBKDF2_PREFIX = "pbkdf2:"
_PBKDF2_ITERATIONS = 260000

def hash_pw(pw):
    """Hash un mot de passe avec PBKDF2-SHA256 (sel aleatoire, 260k iterations)."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt, _PBKDF2_ITERATIONS)
    return _PBKDF2_PREFIX + base64.b64encode(salt).decode() + ":" + base64.b64encode(dk).decode()

def _verify_pbkdf2(password, hashed):
    """Verifie un hash PBKDF2."""
    parts = hashed[len(_PBKDF2_PREFIX):].split(":")
    if len(parts) != 2:
        return False
    salt = base64.b64decode(parts[0])
    expected = base64.b64decode(parts[1])
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, _PBKDF2_ITERATIONS)
    return secrets.compare_digest(dk, expected)

def _legacy_hash_pw(pw):
    """Ancien hash SHA-256 garde pour migration."""
    salt = "affi2026"
    return hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()

def verify_pw(password, hashed):
    """Verifie un mot de passe. Supporte PBKDF2, bcrypt et SHA-256 legacy."""
    if not hashed:
        return False
    # PBKDF2 (methode principale)
    if hashed.startswith(_PBKDF2_PREFIX):
        return _verify_pbkdf2(password, hashed)
    # bcrypt (si disponible)
    if hashed.startswith("$2b$") and _HAS_BCRYPT:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    # SHA-256 legacy
    return secrets.compare_digest(hashed, _legacy_hash_pw(password))

def _validate_password(password):
    """Return an error message if the password is too weak, or None if OK."""
    if len(password) < 8:
        return "Le mot de passe doit faire au moins 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return "Le mot de passe doit contenir au moins une majuscule"
    if not re.search(r'[a-z]', password):
        return "Le mot de passe doit contenir au moins une minuscule"
    if not re.search(r'[0-9]', password):
        return "Le mot de passe doit contenir au moins un chiffre"
    return None

def create_session(member_id):
    token = secrets.token_urlsafe(48)
    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE member_id = %s", [member_id])
                cur.execute("INSERT INTO sessions (token, member_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '7 days')", [token, member_id])
                cur.execute("UPDATE members SET last_login = NOW() WHERE id = %s", [member_id])
    finally:
        conn.close()
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
            if not member or not verify_pw(password, member["password_hash"]):
                return self._json(401, {"error": "Email ou mot de passe incorrect"})
            if member["status"] == "blocked":
                return self._json(403, {"error": "Compte desactive"})
            # Migrate legacy hash to PBKDF2 on successful login
            if member["password_hash"] and not member["password_hash"].startswith(_PBKDF2_PREFIX):
                execute("UPDATE members SET password_hash = %s WHERE id = %s",
                        [hash_pw(password), member["id"]])
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
            generic_msg = "Si ce compte existe, un code de reinitialisation a ete envoye."
            if not member:
                return self._json(200, {"ok": True, "message": generic_msg})
            # Generer un code de reset (6 chiffres)
            reset_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            reset_token = secrets.token_urlsafe(32)
            # Stocker dans la session avec un prefixe special
            execute("DELETE FROM sessions WHERE member_id = %s AND token LIKE 'reset_%%'", [member["id"]])
            execute("INSERT INTO sessions (token, member_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '1 hour')",
                    [f"reset_{reset_token}_{reset_code}", member["id"]])
            # Send reset email
            try:
                from api.email import send_email, make_html_email
                reset_html = make_html_email("Réinitialisation de mot de passe", f"""
                    <p>Bonjour {member['first_name']},</p>
                    <p>Voici votre code de réinitialisation :</p>
                    <div style="text-align:center;padding:20px;background:#f0f4f8;border-radius:8px;margin:20px 0">
                        <span style="font-size:36px;font-weight:900;color:#1a3c6e;letter-spacing:8px">{reset_code}</span>
                    </div>
                    <p style="color:#6c757d;font-size:13px">Ce code est valable 1 heure.</p>
                """)
                send_email(member['email'], "[AFFI] Code de réinitialisation", reset_html)
            except Exception:
                pass  # Email sending is best-effort
            # Le reset_token est renvoye (identifiant de session, pas secret)
            # Le reset_code reste secret (envoye par email/admin uniquement)
            return self._json(200, {"ok": True, "message": generic_msg, "reset_token": reset_token})

        elif action == "reset_password":
            reset_token = body.get("reset_token", "")
            reset_code = body.get("reset_code", "")
            new_password = body.get("new_password", "")
            if not reset_token or not reset_code or not new_password:
                return self._json(400, {"error": "Token, code et nouveau mot de passe requis"})
            pw_error = _validate_password(new_password)
            if pw_error:
                return self._json(400, {"error": pw_error})
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
