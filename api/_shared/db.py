"""Connexion Neon PostgreSQL pour AFFI."""
import os, logging
from decimal import Decimal
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

log = logging.getLogger("affi.db")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

def get_conn():
    if not psycopg2:
        raise RuntimeError("psycopg2 non installe")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL non configuree")
    return psycopg2.connect(DATABASE_URL, sslmode="require")

def fetchall(sql, params=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            rows = cur.fetchall()
            for r in rows:
                for k, v in r.items():
                    if hasattr(v, 'isoformat'):
                        r[k] = v.isoformat()
                    elif isinstance(v, Decimal):
                        r[k] = float(v)
            return rows
    finally:
        conn.close()

def fetchone(sql, params=None):
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or [])
            row = cur.fetchone()
            if row:
                for k, v in row.items():
                    if hasattr(v, 'isoformat'):
                        row[k] = v.isoformat()
                    elif isinstance(v, Decimal):
                        row[k] = float(v)
            return row
    finally:
        conn.close()

def execute(sql, params=None):
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
