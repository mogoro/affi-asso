# Guide de Developpement & Production — AFFI-ASSO

## 1. Environnement de Developpement

### Outils necessaires

- **Visual Studio Code** : editeur de code
- **Claude Code** : extension VS Code (ou CLI) pour l'assistance IA
- **Git** : gestion de versions
- **GitHub CLI (gh)** : interaction avec GitHub
- **Node.js** : pour Vercel CLI
- **Python 3** : pour les scripts backend et seeds

### Installation

```bash
# Installer GitHub CLI
winget install GitHub.cli

# Installer Vercel CLI
npm install -g vercel

# Installer les dependances Python
pip install psycopg2-binary
```

### Structure du projet

```
affi-asso/
├── api/                  # Backend Python (Vercel Functions)
│   ├── _shared/db.py     # Connexion PostgreSQL
│   ├── events.py
│   ├── news.py
│   ├── publications.py
│   └── ...
├── public/               # Frontend statique
│   ├── index.html        # SPA principale
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js        # Router + logique pages
│   │   ├── members.js    # Espace membres
│   │   ├── admin.js      # Administration
│   │   ├── social.js     # Communaute / Feed
│   │   └── map.js        # Cartographie Leaflet
│   └── images/           # Logos, photos, slideshow
├── schema.sql            # Schema de la base de donnees
├── seed_v4.py            # Donnees initiales (vraies donnees AFFI)
├── vercel.json           # Configuration Vercel
└── .env                  # Variables d'environnement (NE PAS COMMITER)
```

### Workflow avec Claude Code dans VS Code

1. Ouvrir le projet dans VS Code : `code C:\DEV\perso\affi-asso`
2. Ouvrir Claude Code (extension ou terminal)
3. Decrire ce que tu veux modifier en francais
4. Claude Code lit les fichiers, propose des modifications, et les applique
5. Tester en local puis deployer

---

## 2. Deux Environnements : Staging (dev) et Production

### Principe

| | Staging (dev) | Production |
|---|---|---|
| **URL** | affi-asso-dev.vercel.app | affi-asso.vercel.app |
| **Branche Git** | `dev` | `master` |
| **Base de donnees** | Neon branch `dev` | Neon branch `main` |
| **But** | Tester les modifications | Site public visible |

### Mise en place

#### A. Creer la branche de developpement

```bash
cd C:\DEV\perso\affi-asso

# Creer la branche dev a partir de master
git checkout -b dev
git push -u origin dev
```

#### B. Configurer Vercel pour les deux environnements

Vercel deploie automatiquement :
- **Push sur `master`** → deploiement en **Production** (affi-asso.vercel.app)
- **Push sur `dev`** → deploiement en **Preview** (URL temporaire)

Pour un domaine de staging permanent :
1. Aller sur https://vercel.com → projet affi-asso → Settings → Domains
2. Ajouter `affi-asso-dev.vercel.app` lie a la branche `dev`

#### C. Creer une base de donnees de staging sur Neon

1. Aller sur https://console.neon.tech
2. Sur le projet neondb, creer une **branche** nommee `dev`
3. Copier la connection string de la branche `dev`
4. Dans Vercel → Settings → Environment Variables :
   - `DATABASE_URL` pour **Production** = connection string `main`
   - `DATABASE_URL` pour **Preview** = connection string `dev`

### Workflow quotidien

```bash
# 1. Travailler sur la branche dev
git checkout dev

# 2. Faire les modifications (avec Claude Code ou manuellement)
# ...

# 3. Commiter et pusher sur dev → deploiement staging automatique
git add .
git commit -m "Description des modifications"
git push origin dev

# 4. Tester sur l'URL de staging
# https://affi-asso-dev.vercel.app

# 5. Quand tout est OK, merger en production
git checkout master
git merge dev
git push origin master
# → deploiement production automatique sur affi-asso.vercel.app

# 6. Revenir sur dev pour la suite
git checkout dev
```

---

## 3. Sauvegardes (Backups)

### 3.1 Sauvegarde du Code Source

**Automatique via GitHub.**
Le code est sauvegarde sur :
- GitHub : https://github.com/mogoro/affi-asso
- En local : C:\DEV\perso\affi-asso

Chaque `git push` cree une sauvegarde. L'historique Git conserve toutes les versions.

Pour une sauvegarde supplementaire en ZIP :
```bash
# Creer un backup ZIP date
cd C:\DEV\perso
tar -czf affi-asso-backup-$(date +%Y%m%d).tar.gz affi-asso/
```

### 3.2 Sauvegarde de la Base de Donnees (Neon PostgreSQL)

#### Option A : Export manuel avec pg_dump

```bash
# Installer PostgreSQL client (pour pg_dump)
winget install PostgreSQL.PostgreSQL.16

# Exporter toute la base
pg_dump "postgresql://neondb_owner:PASSWORD@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require" > backup_neon_$(date +%Y%m%d).sql
```

Le fichier `.sql` contient tout : schema + donnees. Pour restaurer :
```bash
psql "CONNECTION_STRING" < backup_neon_20260330.sql
```

#### Option B : Export via Python (sans installer PostgreSQL)

Creer un script `backup_db.py` :

```python
#!/usr/bin/env python3
"""Backup de la base Neon en fichiers SQL."""
import psycopg2
import datetime

conn = psycopg2.connect('ta_connection_string_ici')
cur = conn.cursor()

date = datetime.datetime.now().strftime('%Y%m%d_%H%M')
filename = f'backup_neon_{date}.sql'

# Lister toutes les tables
cur.execute("""SELECT tablename FROM pg_tables WHERE schemaname = 'public'""")
tables = [row[0] for row in cur.fetchall()]

with open(filename, 'w', encoding='utf-8') as f:
    for table in tables:
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        f.write(f"\n-- Table: {table} ({len(rows)} rows)\n")
        f.write(f"DELETE FROM {table};\n")
        for row in rows:
            values = ', '.join(
                'NULL' if v is None else f"'{str(v).replace(chr(39), chr(39)+chr(39))}'"
                for v in row
            )
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({values});\n")

conn.close()
print(f"Backup sauvegarde dans {filename}")
```

```bash
python backup_db.py
```

#### Option C : Sauvegardes automatiques Neon (recommande)

Neon inclut automatiquement :
- **Point-in-time recovery** : restauration a n'importe quel moment des 7 derniers jours (plan gratuit) ou 30 jours (plan Pro)
- **Branching** : creer une copie instantanee de la base a tout moment

Pour creer un snapshot manuel :
1. Aller sur https://console.neon.tech
2. Projet → Branches → Create Branch
3. Nommer `backup-20260330`

Cela cree une copie complete et instantanee de la base.

### 3.3 Sauvegarde des Images et Medias

Les images sont dans `public/images/` et sont sauvegardees avec le code Git.

Pour une sauvegarde separee des images :
```bash
# Copier les images dans un dossier de backup
xcopy /E /I "C:\DEV\perso\affi-asso\public\images" "C:\DEV\backups\affi-asso-images-$(date +%Y%m%d)"
```

Les images originales scrapees sont aussi dans :
```
C:\DEV\pro\WebScraper\output_affi\assets\   (354 fichiers)
C:\DEV\pro\WebScraper\output_affi\documents\ (fichiers PDF, PPT, DOC)
```

### 3.4 Sauvegarde des Documents (PDFs, presentations)

Les documents scrapes (AFFI INFO, presentations, etc.) sont dans :
```
C:\DEV\pro\WebScraper\output_affi\documents\
```

Pour les integrer au backup :
```bash
# Copier les documents dans le projet
cp -r "C:\DEV\pro\WebScraper\output_affi\documents" "C:\DEV\perso\affi-asso\public\documents"

# OU les sauvegarder separement
tar -czf documents-affi-backup.tar.gz "C:\DEV\pro\WebScraper\output_affi\documents"
```

---

## 4. Script de Backup Complet

Creer `backup.sh` et l'executer regulierement :

```bash
#!/bin/bash
# backup.sh — Sauvegarde complete du site AFFI
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR="C:/DEV/backups/affi-asso/$DATE"
mkdir -p "$BACKUP_DIR"

echo "=== Backup AFFI-ASSO — $DATE ==="

# 1. Code source (ZIP du repo)
echo "[1/4] Code source..."
cd "C:/DEV/perso/affi-asso"
git bundle create "$BACKUP_DIR/affi-asso-repo.bundle" --all
echo "  -> affi-asso-repo.bundle"

# 2. Base de donnees
echo "[2/4] Base de donnees Neon..."
python backup_db.py
mv backup_neon_*.sql "$BACKUP_DIR/"
echo "  -> backup SQL"

# 3. Images du site
echo "[3/4] Images..."
tar -czf "$BACKUP_DIR/images.tar.gz" -C "C:/DEV/perso/affi-asso/public" images/
echo "  -> images.tar.gz"

# 4. Documents scrapes
echo "[4/4] Documents scrapes..."
tar -czf "$BACKUP_DIR/documents-scrapes.tar.gz" -C "C:/DEV/pro/WebScraper/output_affi" documents/ assets/
echo "  -> documents-scrapes.tar.gz"

echo ""
echo "=== Backup termine dans $BACKUP_DIR ==="
ls -lh "$BACKUP_DIR/"
```

```bash
bash backup.sh
```

---

## 5. Checklist avant mise en production

Avant chaque deploiement en production, verifier :

- [ ] Tester sur la branche `dev` / URL staging
- [ ] Verifier que le site s'affiche correctement (accueil, identite, agenda, evenements, publications)
- [ ] Verifier que les API fonctionnent (evenements, news, publications chargent)
- [ ] Verifier que la connexion membre fonctionne
- [ ] Verifier que les images/logos s'affichent
- [ ] Faire un backup de la base AVANT de modifier le schema ou les seeds
- [ ] Merger `dev` → `master` et pusher
- [ ] Verifier le deploiement sur https://affi-asso.vercel.app

---

## 6. Acces et Identifiants

| Service | URL | Compte |
|---|---|---|
| GitHub (code) | github.com/mogoro/affi-asso | mogoro |
| Vercel (deploiement) | vercel.com | fifsertech |
| Neon (base de donnees) | console.neon.tech | (ton compte) |
| Site production | affi-asso.vercel.app | — |

### Variables d'environnement (`.env`)

```
DATABASE_URL=postgresql://neondb_owner:***@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**IMPORTANT** : Ne jamais commiter le fichier `.env` sur GitHub. Il est dans `.gitignore`.

---

## 7. Commandes Utiles

```bash
# Deployer en production
cd C:\DEV\perso\affi-asso
npx vercel --prod

# Voir les logs Vercel
npx vercel logs affi-asso.vercel.app

# Tester en local
npx vercel dev

# Executer un seed (peupler la base)
python seed_v4.py

# Creer un backup de la base
python backup_db.py

# Pusher sur GitHub
git add . && git commit -m "description" && git push origin master
```
