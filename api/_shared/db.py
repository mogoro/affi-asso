"""Connexion Neon PostgreSQL pour AFFI — securisee."""
import os, logging, time, threading
from decimal import Decimal
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

log = logging.getLogger("affi.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# === PROTECTION: Timeout et limites de connexion ===
QUERY_TIMEOUT_MS = 10000      # 10s max par requete
CONN_TIMEOUT_S = 5            # 5s max pour se connecter
MAX_RESULTS = 1000            # Limite absolue de lignes retournees

# === PROTECTION: Rate limiting simple (par IP serait mieux, ici global) ===
_rate_lock = threading.Lock()
_rate_counter = 0
_rate_reset = time.time()
RATE_LIMIT = 200              # 200 requetes par fenetre
RATE_WINDOW = 60              # fenetre de 60 secondes

def _check_rate_limit():
    global _rate_counter, _rate_reset
    now = time.time()
    with _rate_lock:
        if now - _rate_reset > RATE_WINDOW:
            _rate_counter = 0
            _rate_reset = now
        _rate_counter += 1
        if _rate_counter > RATE_LIMIT:
            raise RuntimeError("Trop de requetes — reessayez dans quelques secondes")

# === PROTECTION: Blocage des requetes dangereuses ===
_DANGEROUS_PATTERNS = ['DROP ', 'TRUNCATE ', 'ALTER ', 'CREATE ', 'GRANT ', 'REVOKE ']

def _validate_query(sql):
    upper = sql.strip().upper()
    for pattern in _DANGEROUS_PATTERNS:
        if upper.startswith(pattern):
            raise RuntimeError(f"Requete interdite: {pattern.strip()}")

def get_conn():
    if not psycopg2:
        raise RuntimeError("psycopg2 non installe")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL non configuree")
    conn = psycopg2.connect(DATABASE_URL, sslmode="require", connect_timeout=CONN_TIMEOUT_S)
    # Timeout par requete
    with conn.cursor() as cur:
        cur.execute(f"SET statement_timeout = {QUERY_TIMEOUT_MS}")
    return conn

def _clean_row(row):
    """Convertit les types PostgreSQL en types JSON-serialisables."""
    for k, v in row.items():
        if hasattr(v, 'isoformat'):
            row[k] = v.isoformat()
        elif isinstance(v, Decimal):
            row[k] = float(v)
    return row

def fetchall(sql, params=None):
    _check_rate_limit()
    _validate_query(sql)
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            rows = cur.fetchmany(MAX_RESULTS)
            return [_clean_row(r) for r in rows]
    finally:
        conn.close()

def fetchone(sql, params=None):
    _check_rate_limit()
    _validate_query(sql)
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            row = cur.fetchone()
            return _clean_row(row) if row else None
    finally:
        conn.close()

def execute(sql, params=None):
    _check_rate_limit()
    _validate_query(sql)
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            conn.commit()
            try:
                return cur.fetchone()
            except Exception:
                return None
    finally:
        conn.close()
