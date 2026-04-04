"""POST /api/email — Email sending service via Resend API."""
from http.server import BaseHTTPRequestHandler
import json, os
try:
    from urllib.request import Request, urlopen
except ImportError:
    pass

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "AFFI <noreply@ingenieur-ferroviaire.net>")

def send_email(to, subject, html_body):
    """Send an email via Resend API."""
    if not RESEND_API_KEY:
        # Fallback: log to console if no API key
        print(f"[EMAIL] To: {to}, Subject: {subject}")
        return {"ok": True, "message": "Email logged (no API key configured)"}

    data = json.dumps({
        "from": FROM_EMAIL,
        "to": [to] if isinstance(to, str) else to,
        "subject": subject,
        "html": html_body,
    }).encode()

    req = Request("https://api.resend.com/emails", data=data, method="POST")
    req.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
    req.add_header("Content-Type", "application/json")

    try:
        with urlopen(req) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return {"error": str(e)}

def make_html_email(title, body_html):
    """Wrap email content in a nice HTML template."""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a3c6e;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">AFFI</h1>
        <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:13px">Association Ferroviaire Française des Ingénieurs</p>
    </div>
    <div style="padding:32px 24px">
        <h2 style="color:#1a3c6e;margin:0 0 16px;font-size:20px">{title}</h2>
        {body_html}
    </div>
    <div style="padding:16px 24px;background:#f8f9fa;text-align:center;font-size:12px;color:#6c757d">
        AFFI — 60 rue Anatole France, 92300 Levallois-Perret<br>
        <a href="https://affi-asso.vercel.app" style="color:#2d5a9e">affi-asso.vercel.app</a>
    </div>
</div>
</body></html>"""

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        from api.auth import get_member_from_token
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "")
        user = get_member_from_token(token)

        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        action = body.get("action", "")

        # Only admins can send arbitrary emails
        if action == "send" and (not user or not user.get("is_admin")):
            return self._json(403, {"error": "Admin requis"})

        if action == "send":
            to = body.get("to")
            subject = body.get("subject")
            html = body.get("html") or make_html_email(subject, body.get("body", ""))
            result = send_email(to, subject, html)
            return self._json(200, result)

        # Contact form notification (no auth needed, called internally)
        elif action == "notify_contact":
            admin_email = os.environ.get("ADMIN_EMAIL", "contact@ingenieur-ferroviaire.net")
            html = make_html_email("Nouveau message de contact", f"""
                <p><strong>De :</strong> {body.get('name','')} ({body.get('email','')})</p>
                <p><strong>Sujet :</strong> {body.get('subject','')}</p>
                <div style="background:#f8f9fa;padding:16px;border-radius:6px;margin-top:12px;white-space:pre-line">{body.get('message','')}</div>
            """)
            send_email(admin_email, f"[AFFI Contact] {body.get('subject','')}", html)
            return self._json(200, {"ok": True})

        # Welcome email
        elif action == "welcome":
            html = make_html_email("Bienvenue à l'AFFI !", f"""
                <p>Bonjour <strong>{body.get('name','')}</strong>,</p>
                <p>Votre compte AFFI a été créé avec succès.</p>
                <p><strong>Email :</strong> {body.get('email','')}</p>
                <p><strong>Mot de passe temporaire :</strong> {body.get('password','')}</p>
                <p style="margin-top:20px"><a href="https://affi-asso.vercel.app/#membres" style="background:#c8102e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Se connecter</a></p>
                <p style="color:#6c757d;font-size:13px;margin-top:16px">Nous vous recommandons de changer votre mot de passe à la première connexion.</p>
            """)
            send_email(body.get('email'), "Bienvenue à l'AFFI", html)
            return self._json(200, {"ok": True})

        # Password reset email
        elif action == "reset":
            html = make_html_email("Réinitialisation de mot de passe", f"""
                <p>Bonjour,</p>
                <p>Voici votre code de réinitialisation :</p>
                <div style="text-align:center;padding:20px;background:#f0f4f8;border-radius:8px;margin:20px 0">
                    <span style="font-size:36px;font-weight:900;color:#1a3c6e;letter-spacing:8px">{body.get('code','')}</span>
                </div>
                <p style="color:#6c757d;font-size:13px">Ce code est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            """)
            send_email(body.get('email'), "[AFFI] Code de réinitialisation", html)
            return self._json(200, {"ok": True})

        return self._json(400, {"error": "Action inconnue"})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))
