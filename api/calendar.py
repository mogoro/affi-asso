"""GET /api/calendar — ICS feed for calendar subscription."""
from http.server import BaseHTTPRequestHandler
from api._shared.db import fetchall
import datetime

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        events = fetchall("SELECT * FROM events WHERE is_published=TRUE ORDER BY start_date DESC LIMIT 100")

        lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//AFFI//Agenda//FR',
            'X-WR-CALNAME:Agenda AFFI',
            'X-WR-CALDESC:Événements de l\'Association Ferroviaire Française des Ingénieurs',
        ]

        for e in events:
            start = (e.get('start_date') or '').replace('-','').replace(':','').replace('T','T')[:15]
            end = (e.get('end_date') or e.get('start_date') or '').replace('-','').replace(':','').replace('T','T')[:15]
            if not start: continue
            # Clean for ICS format
            start = start.replace(' ','T')[:15] + '00Z' if 'T' not in start else start + 'Z'

            lines.extend([
                'BEGIN:VEVENT',
                f'DTSTART:{start}',
                f'DTEND:{end}Z' if end else '',
                f'SUMMARY:{e.get("title","")}',
                f'DESCRIPTION:{(e.get("description","") or "").replace(chr(10),"\\n")[:500]}',
                f'LOCATION:{e.get("location","")}',
                f'URL:https://affi-asso.vercel.app/#agenda',
                'END:VEVENT',
            ])

        lines.append('END:VCALENDAR')
        ics = '\r\n'.join(l for l in lines if l)

        self.send_response(200)
        self.send_header("Content-Type", "text/calendar; charset=utf-8")
        self.send_header("Content-Disposition", "inline; filename=affi-agenda.ics")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(ics.encode('utf-8'))
