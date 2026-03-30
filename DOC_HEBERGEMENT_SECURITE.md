# AFFI-ASSO — Hébergement, Sauvegarde, Reprise d'activité et Cybersécurité

> Documentation technique destinée aux responsables de l'association AFFI.
> Dernière mise à jour : 31 mars 2026

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Hébergement — Prototypage vs Production](#2-hébergement--prototypage-vs-production)
3. [Sauvegarde des données](#3-sauvegarde-des-données)
4. [Plan de reprise et remise en route](#4-plan-de-reprise-et-remise-en-route)
5. [Cybersécurité](#5-cybersécurité)
6. [Conformité RGPD](#6-conformité-rgpd)
7. [Contacts et accès](#7-contacts-et-accès)

---

## 1. Architecture générale

### 1.1 Phase de prototypage (actuelle)

Le prototype utilise des services gratuits cloud pour le développement rapide :

| Brique | Technologie | Rôle |
|---|---|---|
| **Frontend** | HTML5 / CSS3 / JavaScript vanilla | Interface utilisateur (SPA) |
| **Backend** | Python 3 (Vercel Functions) | API REST (authentification, données) |
| **Base de données** | PostgreSQL (Neon Cloud Free) | Stockage des données |
| **Hébergement** | Vercel Hobby (gratuit) | Déploiement serverless |
| **Dépôt de code** | GitHub | Versionnement du code source |

### 1.2 Phase de production (cible)

La production repose sur un **VPS (Virtual Private Server)** offrant un contrôle total, des performances garanties et une sécurité renforcée :

| Brique | Technologie | Rôle |
|---|---|---|
| **Frontend** | HTML5 / CSS3 / JavaScript vanilla | Interface utilisateur (SPA) |
| **Backend** | Python 3 (Gunicorn / uWSGI) | Serveur d'application WSGI |
| **Reverse proxy** | Nginx | Routage, HTTPS, cache, protection |
| **Base de données** | PostgreSQL (installé sur le VPS) | Stockage des données |
| **Conteneurisation** | Docker + Docker Compose | Isolation et déploiement reproductible |
| **SSL/TLS** | Let's Encrypt (Certbot) | Certificats HTTPS gratuits et automatiques |
| **Pare-feu** | UFW + Fail2Ban | Protection réseau et anti-brute-force |
| **Hébergement** | VPS (OVH, Scaleway, Hetzner ou Contabo) | Serveur dédié virtualisé |
| **Dépôt de code** | GitHub | Versionnement et déploiement |

### 1.3 Schéma d'architecture de production

```
                        Internet
                           │
                      ┌────┴────┐
                      │  DNS    │  affi-asso.fr → IP du VPS
                      └────┬────┘
                           │
                    ┌──────┴──────┐
                    │  Pare-feu   │  UFW : ports 80, 443, 22 (SSH)
                    │  Fail2Ban   │  Blocage auto des IP malveillantes
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │        Nginx            │
              │    (Reverse Proxy)      │
              │                         │
              │  ● HTTPS (Let's Encrypt)│
              │  ● Cache fichiers stat. │
              │  ● Headers sécurité     │
              │  ● Rate limiting        │
              │  ● Protection DDoS      │
              └─────┬──────────┬────────┘
                    │          │
          /static/* │          │ /api/*
                    │          │
         ┌──────────┘    ┌─────┴──────────┐
         │               │                │
    ┌────┴────┐    ┌─────┴──────────┐     │
    │ Fichiers│    │   Gunicorn     │     │
    │ statiq. │    │  (Python WSGI) │     │
    │ HTML/CSS│    │                │     │
    │ JS/IMG  │    │  Application   │     │
    └─────────┘    │  Python API    │     │
                   └───────┬────────┘     │
                           │              │
                    ┌──────┴──────┐       │
                    │ PostgreSQL  │       │
                    │  (local)    │       │
                    │             │       │
                    │ Données     │       │
                    │ chiffrées   │       │
                    └─────────────┘       │
                                          │
                    ┌─────────────┐       │
                    │  Sauvegardes│◄──────┘  Cron jobs
                    │  (pg_dump)  │  quotidiennes
                    │  + rsync    │  → stockage distant
                    └─────────────┘
```

---

## 2. Hébergement — Prototypage vs Production

### 2.1 Vue d'ensemble des deux phases

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PHASE ACTUELLE                                   │
│                    ★ PROTOTYPAGE / MVP ★                                │
│                                                                         │
│  Vercel Hobby (gratuit) + Neon Free                                     │
│  → Développement rapide, tests, validation fonctionnelle                │
│  → Démonstration aux parties prenantes de l'association                  │
│  → Aucun engagement de disponibilité                                    │
│  → Aucune administration serveur requise                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  Migration après validation
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PHASE CIBLE                                      │
│              ★ PRODUCTION SUR VPS DÉDIÉ ★                               │
│                                                                         │
│  VPS (OVH/Scaleway/Hetzner) + PostgreSQL local + Nginx + Docker        │
│  → Contrôle total de l'infrastructure                                   │
│  → Performances garanties (CPU, RAM, disque dédiés)                     │
│  → Sécurité renforcée (pare-feu, Fail2Ban, headers)                    │
│  → Domaine personnalisé (affi-asso.fr)                                  │
│  → Sauvegardes automatisées et maîtrisées                               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Phase actuelle — Prototypage (Vercel + Neon gratuits)

La configuration actuelle est adaptée au **développement et à la validation** du projet. Elle ne convient **pas** pour un usage en production par les membres de l'association.

| Caractéristique | Valeur |
|---|---|
| **Coût** | 0 € |
| **URLs** | `affi-asso.vercel.app` / `affi-asso-dev.vercel.app` |
| **SLA** | Aucun |
| **Bande passante** | 100 Go/mois |
| **Stockage BDD** | 0,5 Go (Neon Free) |
| **Sauvegardes auto** | 7 jours (Neon PITR) |
| **Support** | Communautaire uniquement |
| **Contrôle serveur** | Aucun (serverless) |

#### Ce que cette phase permet

- Développer et tester toutes les fonctionnalités
- Valider l'ergonomie et les parcours utilisateur avec un groupe restreint
- Présenter le projet aux membres du bureau de l'association
- Préparer les données réelles (imports, seed)

#### Limites de cette phase

- Aucune garantie de disponibilité
- Performances limitées (fonctions 10s max, cold starts)
- Pas de contrôle sur l'infrastructure
- Dépendance totale envers Vercel et Neon
- Sauvegardes limitées (7 jours)
- Impossible de personnaliser la sécurité réseau

### 2.3 Phase cible — Production sur VPS

#### Pourquoi un VPS plutôt qu'un service cloud managé

| Critère | Service managé (Vercel/Neon) | VPS dédié |
|---|---|---|
| **Contrôle** | Limité aux options du fournisseur | **Total** : OS, réseau, logiciels |
| **Performance** | Variable (cold starts, mutualisé) | **Garantie** : CPU/RAM/disque dédiés |
| **Sécurité** | Dépend du fournisseur | **Configurable** : pare-feu, Fail2Ban, headers, WAF |
| **Coût à long terme** | Augmente avec l'usage | **Fixe et prévisible** |
| **Données** | Hébergées chez un tiers (US souvent) | **Localisées en France/UE** (choix du datacenter) |
| **Indépendance** | Vendor lock-in possible | **Portable** : migration facile vers tout VPS |
| **Personnalisation** | Limitée | **Illimitée** : Nginx, cron, monitoring, etc. |

#### Fournisseurs VPS recommandés (datacenters en France/UE)

| Fournisseur | Offre recommandée | CPU | RAM | Stockage | Bande passante | Coût/mois |
|---|---|---|---|---|---|---|
| **OVH** | VPS Starter | 1 vCore | 2 Go | 20 Go SSD | Illimitée | ~3,50 € |
| **OVH** | VPS Essential | 2 vCores | 4 Go | 40 Go SSD | Illimitée | ~6,00 € |
| **Scaleway** | DEV1-S | 2 vCores | 2 Go | 20 Go SSD | 200 Mbit/s | ~4,00 € |
| **Hetzner** | CX22 | 2 vCPU | 4 Go | 40 Go SSD | 20 To | ~4,00 € |
| **Contabo** | Cloud VPS S | 4 vCores | 8 Go | 50 Go SSD | Illimitée | ~6,00 € |

> **Recommandation** : OVH VPS Essential (2 vCores, 4 Go RAM, 40 Go SSD) à ~6 €/mois. Datacenter à Gravelines ou Strasbourg (France), support en français, facturation en euros.

#### Coût total estimé en production

| Poste | Coût mensuel | Coût annuel |
|---|---|---|
| VPS (OVH Essential) | ~6 € | ~72 € |
| Domaine affi-asso.fr | ~1 € | ~12 € |
| Certificat SSL (Let's Encrypt) | 0 € | 0 € |
| Sauvegardes distantes (optionnel, OVH Object Storage) | ~1 € | ~12 € |
| **Total** | **~8 €/mois** | **~96 €/an** |

#### Stack logicielle sur le VPS

| Couche | Logiciel | Version recommandée | Rôle |
|---|---|---|---|
| **OS** | Debian 12 ou Ubuntu 24.04 LTS | Dernière LTS | Système d'exploitation stable et sécurisé |
| **Conteneurs** | Docker + Docker Compose | Dernière stable | Isolation des services, déploiement reproductible |
| **Reverse proxy** | Nginx | 1.24+ | Routage HTTPS, cache, headers de sécurité, rate limiting |
| **Serveur app** | Gunicorn | 21+ | Serveur WSGI Python (multi-workers) |
| **Base de données** | PostgreSQL | 16+ | Stockage relationnel |
| **SSL** | Certbot (Let's Encrypt) | Dernière | Certificats HTTPS automatiques (renouvellement tous les 90j) |
| **Pare-feu** | UFW | Inclus OS | Filtrage des ports réseau |
| **Anti-brute-force** | Fail2Ban | 1.0+ | Blocage automatique des IP malveillantes |
| **Monitoring** | htop / Netdata / UptimeRobot | — | Surveillance des ressources et de la disponibilité |

#### Structure Docker Compose (cible)

```yaml
# docker-compose.yml (production)
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./public:/var/www/html          # fichiers statiques
      - ./certbot/conf:/etc/letsencrypt  # certificats SSL
    depends_on:
      - app
    restart: always

  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/affi_asso
    depends_on:
      - db
    restart: always

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups
    environment:
      - POSTGRES_DB=affi_asso
      - POSTGRES_USER=affi_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: always

volumes:
  pgdata:
```

### 2.4 Procédure de migration Prototypage → Production VPS

| Étape | Action | Temps estimé |
|---|---|---|
| 1 | Commander le VPS (OVH, Scaleway ou Hetzner) | 10 min |
| 2 | Installer Docker + Docker Compose sur le VPS | 15 min |
| 3 | Configurer le pare-feu (UFW) et Fail2Ban | 15 min |
| 4 | Adapter le code Python : Vercel Functions → application WSGI (Gunicorn) | 2-4 h |
| 5 | Créer le `Dockerfile` et `docker-compose.yml` | 1 h |
| 6 | Configurer Nginx (reverse proxy, SSL, headers de sécurité) | 30 min |
| 7 | Générer le certificat SSL avec Certbot | 5 min |
| 8 | Exporter les données de Neon (`backup_db.py` ou `pg_dump`) | 10 min |
| 9 | Importer le schéma (`schema.sql`) et les données dans PostgreSQL local | 10 min |
| 10 | Configurer le domaine DNS (affi-asso.fr → IP du VPS) | 15 min + propagation |
| 11 | Mettre en place les sauvegardes automatiques (cron + pg_dump) | 15 min |
| 12 | Tester l'ensemble du site | 1 h |
| 13 | Mettre en place le monitoring (UptimeRobot) | 10 min |

**Durée totale estimée** : 1 journée de travail.

> **Note** : L'étape 4 (adaptation du code) est la plus significative. Les fonctions Vercel (`api/*.py` basées sur `BaseHTTPRequestHandler`) devront être adaptées en application WSGI compatible Gunicorn (par exemple avec Flask ou un routeur WSGI léger). La logique métier et les requêtes SQL restent identiques.

### 2.5 Code source — GitHub

- **Dépôt** : `https://github.com/mogoro/affi-asso`
- **Branches** : `master` (production), `dev` (développement)
- **Accès** : Privé, limité aux développeurs autorisés
- **Déploiement en production** : `git pull` + `docker compose up -d --build` sur le VPS

---

## 3. Sauvegarde des données

### 3.1 Stratégie multi-niveaux

| Niveau | Méthode | Fréquence | Prototypage (Neon) | Production (VPS) |
|---|---|---|---|---|
| **Niveau 1** | Sauvegarde automatique BDD | Continue / Quotidienne | Neon PITR (7 jours) | **Cron pg_dump quotidien** (rétention configurable) |
| **Niveau 2** | Sauvegarde hors-site | Hebdomadaire | Export SQL manuel | **rsync / rclone** vers stockage distant |
| **Niveau 3** | Snapshot serveur complet | Mensuel | N/A | **Snapshot VPS** (OVH, Scaleway) |
| **Niveau 4** | Code source | Continue | GitHub | GitHub |

### 3.2 En prototypage — Sauvegardes Neon

Neon enregistre en continu toutes les modifications (PITR sur 7 jours) :

1. Se connecter à https://console.neon.tech
2. Sélectionner le projet → **Branches** → **Restore**
3. Choisir la date et l'heure souhaitées

Le script `backup_db.py` permet aussi un export SQL manuel :

```bash
python backup_db.py
```

### 3.3 En production (VPS) — Sauvegardes automatisées

#### Niveau 1 — Sauvegarde quotidienne de la base de données

Un script cron effectue un `pg_dump` chaque nuit :

```bash
# /etc/cron.d/affi-backup
# Sauvegarde quotidienne à 3h du matin
0 3 * * * root /opt/affi-asso/scripts/backup.sh >> /var/log/affi-backup.log 2>&1
```

```bash
#!/bin/bash
# /opt/affi-asso/scripts/backup.sh

BACKUP_DIR="/opt/affi-asso/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Dump de la base
docker exec affi-db pg_dump -U affi_user affi_asso | gzip > "$BACKUP_DIR/affi_${DATE}.sql.gz"

# Suppression des sauvegardes de plus de 30 jours
find "$BACKUP_DIR" -name "affi_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup terminé : affi_${DATE}.sql.gz"
```

**Rétention** : 30 jours de sauvegardes quotidiennes sur le VPS.

#### Niveau 2 — Sauvegarde hors-site (stockage distant)

Les sauvegardes sont copiées automatiquement vers un stockage externe pour se prémunir contre la perte du VPS :

```bash
# Envoi hebdomadaire vers un stockage objet (OVH Object Storage, Scaleway S3, Backblaze B2)
0 4 * * 0 root rclone sync /opt/affi-asso/backups remote:affi-backups --max-age 30d
```

**Options de stockage distant** :

| Service | Coût | Localisation | Capacité |
|---|---|---|---|
| OVH Object Storage | ~0,01 €/Go/mois | France | Illimité |
| Scaleway Object Storage | ~0,01 €/Go/mois | France | Illimité |
| Backblaze B2 | ~0,005 $/Go/mois | UE disponible | Illimité |
| Second VPS (rsync) | ~3-4 €/mois | Au choix | Selon offre |

#### Niveau 3 — Snapshots du serveur complet

Les fournisseurs VPS proposent des snapshots complets du serveur :

| Fournisseur | Snapshots inclus | Snapshots payants |
|---|---|---|
| OVH | 1 automatique/semaine (offres compatibles) | ~0,01 €/Go/mois |
| Scaleway | Snapshots manuels | ~0,04 €/Go/mois |
| Hetzner | Sauvegardes auto (~20% du prix VPS) | ~1 €/mois |

> **Recommandation** : activer les snapshots automatiques chez le fournisseur + sauvegardes pg_dump quotidiennes + copie hors-site hebdomadaire. Cette triple protection garantit la récupération dans tous les scénarios.

### 3.4 Sauvegarde du code source

- **GitHub** : historique complet de toutes les versions du code
- **Export ZIP** : téléchargeable depuis GitHub
- **Clone local** : `git clone https://github.com/mogoro/affi-asso.git`
- **Sur le VPS** : le code est également présent dans `/opt/affi-asso/`

### 3.5 Procédure de restauration (production VPS)

#### Restaurer la base de données depuis un dump

```bash
# Lister les sauvegardes disponibles
ls -lh /opt/affi-asso/backups/

# Restaurer une sauvegarde spécifique
gunzip < /opt/affi-asso/backups/affi_20260331_030000.sql.gz | \
  docker exec -i affi-db psql -U affi_user affi_asso
```

#### Restaurer depuis la sauvegarde hors-site

```bash
# Récupérer les sauvegardes distantes
rclone copy remote:affi-backups /opt/affi-asso/backups/

# Puis restaurer comme ci-dessus
```

#### Restaurer depuis un snapshot VPS

1. Se connecter au panel du fournisseur (OVH Manager, Scaleway Console, etc.)
2. Sélectionner le VPS → **Snapshots / Backups**
3. Choisir le snapshot souhaité → **Restaurer**
4. Attendre le redémarrage du VPS (~5-10 min)

---

## 4. Plan de reprise et remise en route

### 4.1 Scénarios d'incidents et procédures

#### Scénario A — Le site est inaccessible (panne du VPS)

| Étape | Action |
|---|---|
| 1 | Vérifier via le monitoring (UptimeRobot) si le VPS répond |
| 2 | Se connecter en SSH au VPS : `ssh root@IP_DU_VPS` |
| 3 | Vérifier l'état des conteneurs : `docker compose ps` |
| 4 | Si un service est arrêté → `docker compose up -d` |
| 5 | Consulter les logs : `docker compose logs --tail 100` |
| 6 | Si le VPS ne répond pas → vérifier le statut sur le panel fournisseur |
| 7 | Si panne matérielle → restaurer depuis un snapshot (voir §3.5) |
| 8 | Si panne prolongée → redéployer sur un nouveau VPS (voir §4.2) |

**Temps de reprise estimé** :
- Service arrêté : 2-5 min (redémarrage Docker)
- Panne VPS : 10-30 min (restauration snapshot)
- Panne prolongée : 1-2h (nouveau VPS + restauration complète)

#### Scénario B — La base de données est corrompue ou des données sont perdues

| Étape | Action |
|---|---|
| 1 | Arrêter l'application : `docker compose stop app` |
| 2 | Identifier la dernière sauvegarde saine dans `/opt/affi-asso/backups/` |
| 3 | Supprimer et recréer la base : `docker exec affi-db dropdb -U affi_user affi_asso && docker exec affi-db createdb -U affi_user affi_asso` |
| 4 | Importer le schéma : `docker exec -i affi-db psql -U affi_user affi_asso < schema.sql` |
| 5 | Restaurer les données : `gunzip < backup.sql.gz \| docker exec -i affi-db psql -U affi_user affi_asso` |
| 6 | Redémarrer l'application : `docker compose up -d` |
| 7 | Si aucune sauvegarde locale → récupérer depuis le stockage distant (rclone) |

**Temps de reprise estimé** : 10 à 30 minutes.

#### Scénario C — Le code est cassé (bug en production)

| Étape | Action |
|---|---|
| 1 | Se connecter en SSH au VPS |
| 2 | Revenir au dernier commit stable : `cd /opt/affi-asso && git log --oneline -5` |
| 3 | Rollback : `git checkout <commit-stable>` |
| 4 | Reconstruire et redéployer : `docker compose up -d --build` |
| 5 | Corriger le bug sur la branche `dev`, tester, puis redéployer |

**Temps de reprise estimé** : 5 à 15 minutes.

#### Scénario D — Compromission du serveur (intrusion)

| Étape | Action |
|---|---|
| 1 | **Isoler immédiatement** : couper l'accès réseau via le panel fournisseur |
| 2 | Changer tous les mots de passe : SSH, PostgreSQL, GitHub |
| 3 | Révoquer les clés SSH compromises |
| 4 | Analyser les logs : `/var/log/auth.log`, `docker compose logs`, Fail2Ban |
| 5 | Si le doute persiste → **détruire le VPS et repartir d'un snapshot sain** |
| 6 | Restaurer la base depuis une sauvegarde **antérieure** à la compromission |
| 7 | Régénérer les secrets (mot de passe BDD, clés API) |
| 8 | Auditer les commits GitHub récents |
| 9 | Renforcer : rotation des clés SSH, durcissement Fail2Ban |

**Temps de reprise estimé** : 1 à 4 heures.

### 4.2 Redéploiement complet sur un nouveau VPS

En cas de perte totale du VPS, la procédure de remise en route complète est la suivante :

```bash
# 1. Commander un nouveau VPS chez le fournisseur (~10 min)

# 2. Connexion SSH et installation de base
ssh root@NOUVEAU_VPS
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin ufw fail2ban certbot

# 3. Configurer le pare-feu
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# 4. Configurer Fail2Ban
systemctl enable fail2ban
systemctl start fail2ban

# 5. Cloner le projet
git clone git@github-mogoro:mogoro/affi-asso.git /opt/affi-asso
cd /opt/affi-asso

# 6. Configurer les variables d'environnement
cp .env.example .env
nano .env  # Renseigner DATABASE_URL, DB_PASSWORD, etc.

# 7. Récupérer la dernière sauvegarde
rclone copy remote:affi-backups/latest.sql.gz /opt/affi-asso/backups/

# 8. Lancer les conteneurs
docker compose up -d

# 9. Restaurer la base de données
gunzip < backups/latest.sql.gz | docker exec -i affi-db psql -U affi_user affi_asso

# 10. Configurer le SSL
certbot certonly --standalone -d affi-asso.fr -d www.affi-asso.fr

# 11. Mettre à jour le DNS si l'IP a changé

# 12. Remettre en place les cron de sauvegarde
crontab -e  # Ajouter les tâches de backup
```

**Temps de remise en route complète** : environ 2 heures.

---

## 5. Cybersécurité

### 5.1 Sécurité des communications (chiffrement)

| Mesure | Technologie | Description |
|---|---|---|
| **HTTPS obligatoire** | Let's Encrypt + Nginx | Tout le trafic est chiffré en TLS 1.2/1.3. Certificats gratuits, renouvelés automatiquement par Certbot tous les 90 jours. |
| **Redirection HTTP → HTTPS** | Nginx | Toute requête HTTP est automatiquement redirigée vers HTTPS. |
| **Connexion BDD locale** | Socket Unix ou localhost | PostgreSQL n'écoute que sur `localhost` ou via socket Unix — **aucun port BDD exposé sur Internet**. |
| **SSH chiffré** | OpenSSH | Accès administrateur uniquement via SSH avec clé (mot de passe désactivé). |

### 5.2 Protection réseau (pare-feu et anti-intrusion)

| Couche | Technologie | Description |
|---|---|---|
| **Pare-feu (UFW)** | iptables via UFW | Seuls 3 ports sont ouverts : **22** (SSH), **80** (HTTP→redir), **443** (HTTPS). Tous les autres ports sont **fermés par défaut**. |
| **Anti-brute-force (Fail2Ban)** | Fail2Ban | Surveille les logs SSH et Nginx. Bloque automatiquement les IP après 5 tentatives échouées (ban de 1h, configurable). |
| **Rate limiting (Nginx)** | `limit_req_zone` | Limite le nombre de requêtes par IP sur les endpoints sensibles (`/api/auth`). Protège contre le brute-force sur les mots de passe et les attaques par déni de service. |
| **Blocage géographique** (optionnel) | Nginx GeoIP | Possibilité de restreindre l'accès à certaines zones géographiques si nécessaire. |

#### Configuration UFW type

```bash
# Politique par défaut : tout bloquer
ufw default deny incoming
ufw default allow outgoing

# Ports autorisés
ufw allow 22/tcp    # SSH (administration)
ufw allow 80/tcp    # HTTP (redirection vers HTTPS)
ufw allow 443/tcp   # HTTPS (site web)

# Activer
ufw enable
```

### 5.3 Protection contre les attaques web

| Menace | Protection | Technologie sur le VPS |
|---|---|---|
| **Injection SQL** | Requêtes paramétrées | `psycopg2` avec paramètres `%s` — les données utilisateur ne sont jamais concaténées dans le SQL |
| **Cross-Site Scripting (XSS)** | Headers de sécurité Nginx | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` |
| **Clickjacking** | Header X-Frame-Options | Nginx ajoute `X-Frame-Options: DENY` sur toutes les réponses |
| **Attaques DDoS** | Rate limiting + Fail2Ban | Nginx limite les requêtes/seconde, Fail2Ban bloque les IP abusives |
| **Man-in-the-Middle** | HSTS | Header `Strict-Transport-Security` forçant HTTPS pendant 1 an |
| **Exposition des secrets** | Variables d'environnement | `.env` sur le serveur, jamais dans le code source (`.gitignore`) |
| **Directory traversal** | Nginx `root` + `try_files` | Nginx ne sert que les fichiers du répertoire autorisé |

#### Configuration Nginx sécurisée (exemple)

```nginx
server {
    listen 443 ssl http2;
    server_name affi-asso.fr www.affi-asso.fr;

    # SSL Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/affi-asso.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/affi-asso.fr/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Headers de sécurité
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data: *.tile.openstreetmap.org;" always;

    # Rate limiting sur l'authentification
    location /api/auth {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://app:8000;
    }

    # Fichiers statiques (avec cache)
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        expires 7d;
    }

    # API
    location /api/ {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.4 Authentification et gestion des accès

| Composant | Implémentation |
|---|---|
| **Hachage des mots de passe** | SHA-256 avec sel (salt) — les mots de passe ne sont jamais stockés en clair |
| **Tokens de session** | Générés aléatoirement (48 octets, URL-safe), stockés en base avec date d'expiration (30 jours) |
| **Contrôle d'accès** | Vérification du token + rôle (`is_admin`, `is_board`) à chaque requête API protégée |
| **Séparation des rôles** | Visiteur (public) / Membre authentifié / Administrateur |
| **Déconnexion** | Suppression du token en base (invalidation immédiate) |

### 5.5 Sécurité du serveur (hardening)

| Mesure | Détail |
|---|---|
| **SSH par clé uniquement** | Authentification par mot de passe désactivée (`PasswordAuthentication no`). Seules les clés SSH autorisées permettent l'accès. |
| **Port SSH personnalisé** (optionnel) | Changer le port SSH par défaut (22 → ex: 2222) pour réduire le bruit des scans automatisés |
| **Mises à jour automatiques** | `unattended-upgrades` activé pour appliquer les correctifs de sécurité OS automatiquement |
| **Isolation Docker** | Chaque service (Nginx, Python, PostgreSQL) tourne dans son propre conteneur isolé |
| **PostgreSQL non exposé** | Le port PostgreSQL (5432) n'est **jamais** ouvert sur Internet. Accessible uniquement en interne (réseau Docker) |
| **Principe du moindre privilège** | L'application Python se connecte à la BDD avec un utilisateur dédié (`affi_user`) aux droits limités |
| **Logs centralisés** | Logs système (`/var/log/`), logs Docker (`docker compose logs`), logs applicatifs (table `logs`) |

### 5.6 Sécurité du code source

| Mesure | Détail |
|---|---|
| **Dépôt privé** | Code sur GitHub privé, accès limité aux développeurs autorisés |
| **Pas de secrets dans le code** | `.gitignore` exclut `.env`, credentials, et fichiers sensibles |
| **Déploiement contrôlé** | Branche `master` uniquement, `git pull` + rebuild Docker |
| **Historique complet** | Git conserve l'historique de toutes les modifications (audit) |

### 5.7 Comparatif sécurité : Prototypage vs Production VPS

| Mesure de sécurité | Prototypage (Vercel) | Production (VPS) |
|---|---|---|
| HTTPS / TLS | Automatique (Vercel) | Automatique (Let's Encrypt + Certbot) |
| Pare-feu réseau | Géré par Vercel (basique) | **UFW configurable** (contrôle total) |
| Anti-brute-force | Aucun | **Fail2Ban** (blocage automatique) |
| Rate limiting | Aucun | **Nginx rate limiting** (configurable) |
| Headers de sécurité | Limité | **Complet** (CSP, HSTS, X-Frame, etc.) |
| DDoS | Protection basique Vercel | **Fail2Ban + rate limiting + blocage IP** |
| Accès BDD | Via Internet (SSL Neon) | **Localhost uniquement** (aucun port exposé) |
| Accès serveur | N/A (serverless) | **SSH par clé uniquement** |
| Mises à jour OS | Géré par Vercel | **unattended-upgrades** (automatique) |
| Isolation des services | Conteneurs Vercel | **Conteneurs Docker** (configurable) |
| Monitoring | Logs Vercel (limités) | **Complet** : système, Docker, applicatif |
| CORS | `*` (ouvert à tous) | **Restreint au domaine** affi-asso.fr |
| Localisation données | US (Vercel/Neon) | **France/UE** (choix du datacenter) |

### 5.8 Recommandations d'amélioration

| Priorité | Recommandation | Impact |
|---|---|---|
| **Haute** | Migrer le hachage des mots de passe vers **bcrypt** ou **argon2** (plus résistant que SHA-256 aux attaques par dictionnaire) | Protection des comptes |
| **Haute** | Activer l'**authentification 2FA** sur GitHub et le panel VPS | Protection des accès administrateur |
| **Moyenne** | Restreindre le CORS à `affi-asso.fr` uniquement | Réduction de la surface d'attaque |
| **Moyenne** | Mettre en place **Netdata** ou **Grafana** pour le monitoring temps réel | Détection rapide des anomalies |
| **Basse** | Rotation des mots de passe PostgreSQL tous les 90 jours | Réduction du risque en cas de fuite |
| **Basse** | Ajouter un **WAF** (ModSecurity avec Nginx) pour filtrage applicatif avancé | Protection contre les attaques ciblées |

---

## 6. Conformité RGPD

Le projet intègre des mécanismes de conformité au Règlement Général sur la Protection des Données :

| Exigence RGPD | Implémentation |
|---|---|
| **Consentement explicite** | Table `consentements` avec type de consentement, date et version des CGU |
| **Droit à l'oubli** | Champ `archived_at` pour suppression logique des comptes membres |
| **Minimisation des données** | Les membres choisissent ce qu'ils rendent visible (`consent_annuaire`, `consent_newsletter`) |
| **Traçabilité** | Table `logs` enregistrant toutes les actions avec utilisateur, cible, détails et adresse IP |
| **Sécurité des données** | Chiffrement en transit (TLS), mots de passe hachés, accès contrôlé par rôle |
| **Localisation des données** | En production VPS : **données hébergées en France/UE** (datacenter au choix) — conformité renforcée par rapport à un hébergement US |

---

## 7. Contacts et accès

### Phase actuelle (prototypage)

| Service | URL / Accès | Rôle |
|---|---|---|
| **Site prototype** | affi-asso.vercel.app | Démonstration et tests |
| **Site staging** | affi-asso-dev.vercel.app | Développement |
| **Neon Console** | console.neon.tech | Base de données (prototype) |
| **GitHub** | github.com/mogoro/affi-asso | Code source |

### Phase cible (production VPS)

| Service | URL / Accès | Rôle |
|---|---|---|
| **Site production** | affi-asso.fr *(à configurer)* | Site public pour les membres |
| **Accès SSH** | `ssh admin@IP_DU_VPS` | Administration du serveur |
| **PostgreSQL** | localhost:5432 (via SSH uniquement) | Base de données (non exposée) |
| **Monitoring** | UptimeRobot / Netdata | Surveillance de la disponibilité |
| **Sauvegardes distantes** | OVH Object Storage / Backblaze B2 | Stockage hors-site des backups |
| **Panel VPS** | OVH Manager / Scaleway Console | Gestion du serveur, snapshots |
| **GitHub** | github.com/mogoro/affi-asso | Code source et déploiement |

---

*Document généré pour le projet AFFI-ASSO — Association des Femmes et Filles d'Ingénieurs.*
