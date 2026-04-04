import os
#!/usr/bin/env python3
"""Seed v4: Real data from scraped AFFI website (ingenieur-ferroviaire.net).
Updates events, news, publications, partners, and board members with actual content.
"""
import psycopg2

conn = psycopg2.connect(os.environ.get('DATABASE_URL', ''))
conn.autocommit = True
cur = conn.cursor()

# ============================================================
# EVENTS — Real events from scraped AFFI data
# ============================================================
cur.execute("DELETE FROM event_registrations")
cur.execute("DELETE FROM events")

events = [
    # Upcoming / recent events
    ("Conference technique IRSE - Signalisation ETCS sur HPMV",
     "La section francaise de l'IRSE organise sa prochaine Conference Technique chez SNCF Reseau - DGII.SF. "
     "Theme : Signalisation ETCS sur le projet Haute Performance Marseille Vintimille (HPMV). "
     "Le projet HPMV est l'un des chantiers emblematiques de la modernisation du reseau ferroviaire historique francais. "
     "Il consiste a deployer le systeme de signalisation europeen ERTMS et une commande centralisee du reseau.\n\n"
     "Programme :\n"
     "17h30-18h00 : Ouverture - Presentation de l'IRSE et de la section francaise\n"
     "18h00-18h30 : Presentation par SNCF Reseau du projet HPMV\n"
     "18h30-19h00 : Presentation par Compagnie des Signaux (CSEE) de la solution ETCS ARGOS RBC\n"
     "19h00-19h30 : Questions / Reponses\n\n"
     "Format mixte Presentiel / Distanciel. 40 places en presentiel dont 10 reservees aux membres AFFI.",
     "conference", "SNCF Reseau - DGII.SF, Salle FRANCE", "6 Av. Francois Mitterrand, 93210 Saint-Denis",
     "2026-04-09 17:30:00", "2026-04-09 19:30:00", 40, 0, False),

    ("Conference - Les domaines de pertinence du ferroviaire",
     "L'AFFI et le Groupe Transports Mobilites de Centrale Supelec Alumni accueillent Jacques DAMAS, "
     "dirigeant referent du systeme ferroviaire, ingenieur de l'Ecole Centrale Paris. "
     "Il presentera sa perception des domaines de pertinence du ferroviaire, eclaire par pres d'un demi-siecle d'experience. "
     "Jacques DAMAS a occupe les postes de Directeur general de CNC, COO d'Eurostar, membre du COMEX SNCF, "
     "Directeur general delegue de SNCF, Directeur executif chez Keolis, et Directeur general d'Eurostar.\n\n"
     "Conference suivie d'un cocktail convivial. Inscription obligatoire par courriel.",
     "conference", "Maison Centrale-Supelec", "8 Rue Jean Goujon, Paris VIII",
     "2026-03-23 18:30:00", "2026-03-23 21:00:00", 60, 0, True),

    ("Conference VRT - MaaS & Billettique",
     "Comment unifier les initiatives territoriales et favoriser l'intermodalite ? "
     "Conference organisee en partenariat avec VRT sur les enjeux de la mobilite comme service (MaaS) "
     "et les solutions de billettique intermodale.",
     "conference", "Paris", None,
     "2026-03-19 17:00:00", "2026-03-19 19:00:00", None, 0, False),

    ("Rendez-vous mensuel de l'AFFI - Avril",
     "Le rendez-vous de l'AFFI est le temps d'echange mensuel entre les membres, dans un contexte informel. "
     "Il est traditionnellement programme le 1er jeudi de chaque mois.",
     "rencontre", "Paris", None,
     "2026-04-02 18:30:00", "2026-04-02 21:00:00", None, 0, True),

    ("Rendez-vous mensuel de l'AFFI - Mai",
     "Le rendez-vous de l'AFFI est le temps d'echange mensuel entre les membres, dans un contexte informel. "
     "Il est traditionnellement programme le 1er jeudi de chaque mois.",
     "rencontre", "Paris", None,
     "2026-05-07 18:30:00", "2026-05-07 21:00:00", None, 0, True),

    ("Conference VRT - RER Metropolitains",
     "Comment reussir le lancement des SERM en region ? "
     "Conference sur les projets de RER metropolitains et les services express regionaux metropolitains.",
     "conference", "Paris", None,
     "2026-04-14 17:00:00", "2026-04-14 19:00:00", None, 0, False),

    # Past events 2026
    ("Conference BEA-TT - Bureau Enquetes Accidents Transports Terrestres",
     "L'AFFI a organise dans les locaux de l'UDI une presentation du Bureau Enquetes Accidents Transports Terrestres, "
     "l'organisme national d'enquetes techniques sur les accidents de transport terrestre.\n\n"
     "Presentee par Marc ANTONI, Chef de la Division Transports Guides du BEATT, "
     "en presence d'une soixantaine de participants.\n\n"
     "Apres un mot d'accueil de Christian BALDIZONNE (UDI) et Francois-Xavier PICARD (president AFFI), "
     "Marc ANTONI a presente les missions, l'organisation, les ressources, les pouvoirs et les valeurs du BEA-TT. "
     "Plusieurs retours d'experiences issus d'enquetes recentes ont illustre concretement le deroulement d'une enquete.",
     "conference", "Universite de l'Ingenierie (UDI)", "Campus Saint-Denis",
     "2026-02-18 18:00:00", "2026-02-18 20:30:00", 60, 0, True),

    ("Voeux AFFI 2026 avec M. Gilles Pascault, President de la Compagnie des Signaux",
     "Ceremonie des voeux 2026 dans les salons de l'Automobile Club de France, en presence d'une centaine "
     "d'adherents et invites.\n\n"
     "Marc ANTONI a fait le bilan de ses 6 annees a la presidence. "
     "Le nouveau president Francois-Xavier PICARD a presente les perspectives 2026 et sa vision de l'AFFI.\n\n"
     "L'invite d'honneur Gilles PASCAULT, president de la Compagnie des Signaux, "
     "a partage l'histoire de renouveau de l'entreprise et ses perspectives sur les enjeux "
     "du secteur de la signalisation et des automatismes en 2026.",
     "ceremonie", "Automobile Club de France", "Paris",
     "2026-01-27 18:30:00", "2026-01-27 22:00:00", 100, 0, True),

    # Past events 2025
    ("Rail Innovation Challenge - Grande Finale",
     "Finale du concours pour les etudiants coorganise par l'AFFI et FERROCAMPUS.\n"
     "14h00 a 18h30 a l'Union Internationale des Chemins de Fer.",
     "challenge", "Union Internationale des Chemins de Fer", "16 rue Jean Rey, 75015 Paris",
     "2025-05-27 14:00:00", "2025-05-27 18:30:00", None, 0, False),

    ("Conference TGV M - Modularite, Innovation et Mobilite Durable",
     "L'AFFI et l'Universite de l'Ingenierie accueillent M. David GOERES, Directeur de projet "
     "a la direction du Materiel - SNCF Voyageurs.\n\n"
     "Le TGV M (M pour modulable) sera la 5e generation des TGV fabriques par Alstom. "
     "20% moins cher, consommation reduite de 20%, plus de passagers que les rames Duplex. "
     "Les essais sur les LGV sont en cours.",
     "conference", "Paris", None,
     "2025-05-14 18:00:00", "2025-05-14 20:30:00", None, 0, True),

    ("1ere Conference Franco-Allemande sur le Systeme Ferroviaire (FASF/FDBS)",
     "L'AFFI a co-organise les 26 et 27 mars 2025 la premiere conference Franco-Allemande "
     "sur le systeme ferroviaire a Metz.\n"
     "Theme : Defis et avancees dans le domaine de l'exploitation en autonomie de circulations ferroviaires.",
     "colloque", "Metz", None,
     "2025-03-26 09:00:00", "2025-03-27 17:00:00", None, 0, False),

    ("Voeux AFFI 2025 avec M. Frederic DELORME, PDG Rails Logistics Europe",
     "Soiree des voeux 2025 avec l'invite d'honneur M. Frederic DELORME, President Directeur General "
     "de Rail Logistics Europe au sein du Groupe SNCF.\n"
     "Theme : Comment la concurrence peut transcender la SNCF vers plus de competitivite "
     "dans le respect de ses valeurs. En presence d'une centaine d'invites.",
     "ceremonie", "Paris", None,
     "2025-01-27 18:30:00", "2025-01-27 22:00:00", 100, 0, True),

    ("Assemblee Generale AFFI - 25 novembre 2025",
     "Assemblee generale de l'AFFI dans les locaux de l'Union Internationale des Chemins de Fer (UIC) "
     "en presence d'une cinquantaine de participants.",
     "assemblee", "Union Internationale des Chemins de Fer", "Paris",
     "2025-11-25 18:00:00", "2025-11-25 21:00:00", 50, 0, True),

    # Past events 2024
    ("Assemblee Generale AFFI - Les records de vitesse des TGV",
     "Assemblee generale de l'AFFI a l'UIC, cloturant l'exercice 2023. "
     "Suivie d'une intervention de Francois Lacote sur les records de vitesse des TGV realises en France depuis 1980.",
     "assemblee", "Union Internationale des Chemins de Fer", "Paris",
     "2024-11-05 18:00:00", "2024-11-05 21:00:00", None, 0, True),

    ("Visite de la ligne T10 et de son site de maintenance",
     "Visite en Ile-de-France de la ligne T10 et de son site de maintenance et de remisage.",
     "visite", "Ile-de-France", None,
     "2024-06-07 09:00:00", "2024-06-07 17:00:00", None, 0, True),

    # Past events 2023
    ("Visite des ateliers RATP de la Porte de la Villette",
     "Visite AFFI des ateliers RATP de la Porte de la Villette a Paris.",
     "visite", "RATP Porte de la Villette", "Paris",
     "2023-05-26 09:00:00", "2023-05-26 17:00:00", None, 0, True),

    ("Visite d'un chantier de remplacement de rail avec le train BOA",
     "Visite nocturne d'un chantier de remplacement de rail avec le train BOA.",
     "visite", "Ile-de-France", None,
     "2023-05-10 22:00:00", "2023-05-11 05:00:00", None, 0, True),
]

for title, desc, etype, loc, addr, sdate, edate, maxatt, price, members_only in events:
    slug = title.lower().replace(' ', '-').replace("'", "")[:100]
    cur.execute("""INSERT INTO events (title, slug, description, event_type, location, address,
        start_date, end_date, max_attendees, price, is_members_only, is_published)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE)""",
        (title, slug, desc, etype, loc, addr, sdate, edate, maxatt, price, members_only))

print(f"  Events inserted")

# ============================================================
# NEWS — Real news/actualites from scraped content
# ============================================================
cur.execute("DELETE FROM news")

news = [
    ("Rail Innovation Challenge Edition 6 - C'est parti !",
     "L'edition 6 a demarre a l'automne, la phase d'ideation s'est deroulee au dernier trimestre 2025, "
     "et une premiere selection a ete realisee fin decembre. La phase d'approfondissement des projets "
     "selectionnes se poursuit maintenant avec l'aide de mentors et experts metiers, "
     "en vue de la selection pour la grande finale prevue au 2eme trimestre 2026.",
     "Le Rail Innovation Challenge edition 6 est en cours. Finale prevue au 2e trimestre 2026.",
     True, "2026-01-15 10:00:00"),

    ("30 ans de l'AFFI : 1996-2026",
     "L'AFFI celebre ses 30 ans au service du ferroviaire. Creee en avril 1996 a l'initiative "
     "des entreprises ferroviaires francaises, soutenues par la Federation des Industries Ferroviaires, "
     "la SNCF et la RATP, l'AFFI est devenue la premiere association francaise rassemblant les ingenieurs "
     "et cadres du secteur ferroviaire.",
     "L'AFFI fete ses 30 ans en 2026 : trois decennies au service de la communaute ferroviaire.",
     True, "2026-01-01 09:00:00"),

    ("Francois-Xavier Picard elu nouveau president de l'AFFI",
     "Lors de la ceremonie des voeux 2026, Marc Antoni a passe le relais apres 6 annees a la presidence. "
     "Francois-Xavier Picard a ete elu nouveau president de l'AFFI et a presente ses perspectives "
     "pour l'avenir de l'association et son role dans la promotion du ferroviaire.",
     "Francois-Xavier Picard succede a Marc Antoni a la presidence de l'AFFI.",
     False, "2026-01-27 20:00:00"),

    ("Conference BEA-TT : retour sur la securite ferroviaire",
     "La premiere conference de l'annee 2026, presentee par Marc Antoni, Chef de la Division Transports "
     "Guides du BEATT, a reuni une soixantaine de participants dans les locaux de l'Universite de l'Ingenierie. "
     "Au programme : missions du BEA-TT, deroulement des enquetes techniques et retours d'experience.",
     "60 participants pour la conference BEA-TT sur la securite ferroviaire.",
     False, "2026-02-19 10:00:00"),

    ("Rendez-vous mensuels de l'AFFI : prochaines dates",
     "Le rendez-vous de l'AFFI est le temps d'echange mensuel entre les membres, dans un contexte informel. "
     "Il est traditionnellement programme le 1er jeudi de chaque mois.\n"
     "Prochaines dates : Jeudi 2 avril 2026, Jeudi 7 mai 2026.",
     "Prochains rendez-vous mensuels : 2 avril et 7 mai 2026.",
     False, "2026-03-06 10:00:00"),

    ("Conference TGV M : le train du futur se devoile",
     "David Goeres de SNCF Voyageurs a presente le TGV M, 5e generation de TGV fabrique par Alstom. "
     "20% moins cher, consommation reduite de 20%, les essais sur LGV sont en cours.",
     "Le TGV M : modularite, innovation et mobilite durable pour le train du futur.",
     False, "2025-05-15 10:00:00"),

    ("Premiere conference franco-allemande sur le systeme ferroviaire",
     "L'AFFI a co-organise les 26 et 27 mars 2025 a Metz la premiere conference Franco-Allemande (FASF/FDBS) "
     "sur le systeme ferroviaire. Theme : defis et avancees dans le domaine de l'exploitation "
     "en autonomie de circulations ferroviaires.",
     "Succes de la 1ere conference franco-allemande AFFI a Metz.",
     False, "2025-03-28 10:00:00"),
]

for title, content, excerpt, pinned, pub_date in news:
    slug = title.lower().replace(' ', '-').replace("'", "").replace(":", "").replace("!", "")[:100]
    cur.execute("""INSERT INTO news (title, slug, content, excerpt, is_pinned, is_published, published_at)
        VALUES (%s,%s,%s,%s,%s,TRUE,%s)""",
        (title, slug, content, excerpt, pinned, pub_date))

print(f"  News inserted")

# ============================================================
# PUBLICATIONS — Real publications from scraped data
# ============================================================
cur.execute("DELETE FROM publications")

publications = [
    # AFFI INFO (annual)
    ("AFFI INFO n.31", "affi-info-31", "Numero 31 de la revue AFFI INFO.", "Janvier 2025", "AFFI INFO", "2025-01-15"),
    ("AFFI INFO n.30", "affi-info-30", "Numero 30 de la revue AFFI INFO.", "Janvier 2024", "AFFI INFO", "2024-01-15"),
    ("AFFI INFO n.29", "affi-info-29", "Numero 29 de la revue AFFI INFO.", "Juillet 2023", "AFFI INFO", "2023-07-15"),
    ("AFFI INFO n.28", "affi-info-28", "Numero 28 de la revue AFFI INFO.", "Fevrier 2021", "AFFI INFO", "2021-02-15"),
    ("AFFI INFO n.27", "affi-info-27", "Numero 27 de la revue AFFI INFO.", "Janvier 2020", "AFFI INFO", "2020-01-15"),
    ("AFFI INFO n.25", "affi-info-25", "Numero 25 de la revue AFFI INFO.", "Janvier 2018", "AFFI INFO", "2018-01-15"),
    ("AFFI INFO n.24", "affi-info-24", "Numero 24 de la revue AFFI INFO.", "Janvier 2017", "AFFI INFO", "2017-01-15"),
    ("AFFI INFO n.23", "affi-info-23", "Numero 23 de la revue AFFI INFO.", "Janvier 2016", "AFFI INFO", "2016-01-15"),
    ("AFFI INFO n.22", "affi-info-22", "Numero 22 de la revue AFFI INFO.", "Janvier 2015", "AFFI INFO", "2015-01-15"),
    ("AFFI INFO n.21", "affi-info-21", "Numero 21 de la revue AFFI INFO.", "Janvier 2014", "AFFI INFO", "2014-01-15"),
    ("AFFI INFO n.20", "affi-info-20", "Numero 20 de la revue AFFI INFO.", "Janvier 2013", "AFFI INFO", "2013-01-15"),
    ("AFFI INFO n.19", "affi-info-19", "Numero 19 de la revue AFFI INFO.", "Janvier 2012", "AFFI INFO", "2012-01-15"),
    ("AFFI INFO n.18", "affi-info-18", "Numero 18 de la revue AFFI INFO.", "Janvier 2011", "AFFI INFO", "2011-01-15"),
    ("AFFI INFO n.17", "affi-info-17", "Numero 17 de la revue AFFI INFO.", "Janvier 2010", "AFFI INFO", "2010-01-15"),
    ("AFFI INFO n.16", "affi-info-16", "Numero 16 de la revue AFFI INFO.", "Janvier 2009", "AFFI INFO", "2009-01-15"),
    ("AFFI INFO n.15", "affi-info-15", "Numero 15 de la revue AFFI INFO.", "Janvier 2008", "AFFI INFO", "2008-01-15"),
    ("AFFI INFO n.14", "affi-info-14", "Numero 14 de la revue AFFI INFO.", "Janvier 2007", "AFFI INFO", "2007-01-15"),
    ("AFFI INFO n.13", "affi-info-13", "Numero 13 de la revue AFFI INFO.", "Janvier 2006", "AFFI INFO", "2006-01-15"),
    ("AFFI INFO n.12", "affi-info-12", "Numero 12 de la revue AFFI INFO.", "Janvier 2005", "AFFI INFO", "2005-01-15"),
    ("AFFI INFO n.11", "affi-info-11", "Numero 11 de la revue AFFI INFO.", "Janvier 2004", "AFFI INFO", "2004-01-15"),
    ("AFFI INFO n.10", "affi-info-10", "Numero 10 de la revue AFFI INFO.", "Janvier 2003", "AFFI INFO", "2003-01-15"),
    # FLASH AFFI INFO
    ("Flash AFFI INFO n.20", "flash-affi-info-20", "Flash AFFI INFO numero 20.", "Octobre 2022", "Flash INFO", "2022-10-15"),
    ("Flash AFFI INFO n.19", "flash-affi-info-19", "Flash AFFI INFO numero 19.", "Juillet 2021", "Flash INFO", "2021-07-15"),
    ("Flash AFFI INFO n.18", "flash-affi-info-18", "Flash AFFI INFO numero 18.", "Juillet 2020", "Flash INFO", "2020-07-15"),
    ("Flash AFFI INFO n.17", "flash-affi-info-17", "Flash AFFI INFO numero 17.", "Juillet 2019", "Flash INFO", "2019-07-15"),
    ("Flash AFFI INFO n.16", "flash-affi-info-16", "Flash AFFI INFO numero 16.", "Juillet 2018", "Flash INFO", "2018-07-15"),
    ("Flash AFFI INFO n.15", "flash-affi-info-15", "Flash AFFI INFO numero 15.", "Juillet 2017", "Flash INFO", "2017-07-15"),
    ("Flash AFFI INFO n.14", "flash-affi-info-14", "Flash AFFI INFO numero 14.", "Juin 2016", "Flash INFO", "2016-06-15"),
    ("Flash AFFI INFO n.13", "flash-affi-info-13", "Flash AFFI INFO numero 13.", "Juillet 2015", "Flash INFO", "2015-07-15"),
    ("Flash AFFI INFO n.12", "flash-affi-info-12", "Flash AFFI INFO numero 12.", "Juillet 2014", "Flash INFO", "2014-07-15"),
    ("Flash AFFI INFO n.11", "flash-affi-info-11", "Flash AFFI INFO numero 11.", "Juillet 2013", "Flash INFO", "2013-07-15"),
    ("Flash AFFI INFO n.10", "flash-affi-info-10", "Flash AFFI INFO numero 10.", "Juillet 2012", "Flash INFO", "2012-07-15"),
    ("Flash AFFI INFO n.9", "flash-affi-info-9", "Flash AFFI INFO numero 9.", "Juillet 2011", "Flash INFO", "2011-07-15"),
    ("Flash AFFI INFO n.8", "flash-affi-info-8", "Flash AFFI INFO numero 8.", "Juillet 2010", "Flash INFO", "2010-07-15"),
    ("Flash AFFI INFO n.7", "flash-affi-info-7", "Flash AFFI INFO numero 7.", "Juillet 2009", "Flash INFO", "2009-07-15"),
    ("Flash AFFI INFO n.6", "flash-affi-info-6", "Flash AFFI INFO numero 6.", "Juillet 2008", "Flash INFO", "2008-07-15"),
    ("Flash AFFI INFO n.5", "flash-affi-info-5", "Flash AFFI INFO numero 5.", "Juin 2007", "Flash INFO", "2007-06-15"),
]

for title, slug, content, excerpt, category, pub_date in publications:
    cur.execute("""INSERT INTO publications (title, slug, content, excerpt, category, is_published, published_at)
        VALUES (%s,%s,%s,%s,%s,TRUE,%s)""",
        (title, slug, content, excerpt, category, pub_date))

print(f"  Publications inserted")

# ============================================================
# PARTNERS — Real partner organizations
# ============================================================
cur.execute("DELETE FROM partners")

partners = [
    ("SNCF", None, "https://www.sncf.com", "Societe Nationale des Chemins de fer Francais", 1),
    ("RATP", None, "https://www.ratp.fr", "Regie Autonome des Transports Parisiens", 2),
    ("Alstom", None, "https://www.alstom.com", "Leader mondial de la mobilite durable", 3),
    ("Arcadis", None, "https://www.arcadis.com", "Groupe d'ingenierie et de conseil", 4),
    ("BEA-TT", None, None, "Bureau d'Enquetes sur les Accidents de Transport Terrestre", 5),
    ("Certifer", None, "https://www.certifer.fr", "Organisme de certification ferroviaire", 6),
    ("EPSF", None, "https://www.securite-ferroviaire.fr", "Etablissement Public de Securite Ferroviaire", 7),
    ("FIF", None, "https://www.fif.french4dev.com/fr", "Federation des Industries Ferroviaires", 8),
    ("Framafer", None, None, "Plasser & Theurer - Equipements de voie", 9),
    ("Saferail", None, None, "Conseil en securite ferroviaire", 10),
    ("Universite de l'Ingenierie", None, None, "Formation et recherche en ingenierie", 11),
    ("Vossloh", None, "https://www.vossloh.com", "Technologie de voie ferroviaire", 12),
]

for name, logo, website, desc, sort in partners:
    cur.execute("""INSERT INTO partners (name, logo_url, website_url, description, sort_order, is_active)
        VALUES (%s,%s,%s,%s,%s,TRUE)""",
        (name, logo, website, desc, sort))

print(f"  Partners inserted")

# ============================================================
# BOARD MEMBERS — Real board from scraped organigramme
# ============================================================
cur.execute("DELETE FROM board_members")

# Get admin member id for linking (optional)
cur.execute("SELECT id FROM members WHERE email='admin@ingenieur-ferroviaire.net' LIMIT 1")
row = cur.fetchone()
admin_id = row[0] if row else None

board = [
    ("President", "Francois-Xavier Picard", 1),
    ("Vice-President", "Yves Ramette", 2),
    ("Vice-President", "Marc Antoni", 3),
    ("Vice-President, Delegue general FIF", "Igor Bilimoff", 4),
    ("Secretaire General", "Jean-Jacques Mogoro", 5),
    ("Secretaire General Adjoint", "Philippe Mingasson", 6),
    ("Secretaire General Adjoint", "Jean-Pierre Riff", 7),
    ("Tresorier", "Christophe Vandenbrouck", 8),
    ("Membre du Bureau", "Vivien Stamm-Douvier", 9),
    ("Membre du Bureau", "Patrick Laval", 10),
    ("Membre du Bureau", "Kevin Benoit", 11),
    ("Membre du Bureau", "Claude Mangone", 12),
    ("Membre du Bureau", "Antoine Gauchery", 13),
    ("Membre du Bureau", "Malek Harzallah", 14),
    ("President Honoraire", "Jean-Pierre Loubinoux", 15),
]

for role, title, sort in board:
    cur.execute("""INSERT INTO board_members (role, title, sort_order, is_active)
        VALUES (%s,%s,%s,TRUE)""",
        (role, title, sort))

print(f"  Board members inserted")

# ============================================================
# SUMMARY
# ============================================================
for t in ['events', 'news', 'publications', 'partners', 'board_members']:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"  {t}: {cur.fetchone()[0]}")

conn.close()
print("\nSeed v4 OK — Real AFFI data loaded!")
