import psycopg2
DB_URL = 'postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("UPDATE members SET is_admin=TRUE, role='admin' WHERE email='claude.mangone@reseau.sncf.fr'")
conn.commit()
cur.execute("SELECT email, first_name, last_name, is_admin, role FROM members WHERE email IN ('mikael.beck@affi.fr','claude.mangone@reseau.sncf.fr')")
for r in cur.fetchall():
    print(f'{r[1]} {r[2]} ({r[0]}) - admin={r[3]}, role={r[4]}')
conn.close()
print('Done')
