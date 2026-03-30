# AFFI-ASSO — Hébergement, Sauvegarde, Reprise d'activité et Cybersécurité

> Documentation technique destinée aux responsables de l'association AFFI.
> Dernière mise à jour : 31 mars 2026

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Hébergement](#2-hébergement)
3. [Sauvegarde des données](#3-sauvegarde-des-données)
4. [Plan de reprise et remise en route](#4-plan-de-reprise-et-remise-en-route)
5. [Cybersécurité](#5-cybersécurité)
6. [Conformité RGPD](#6-conformité-rgpd)
7. [Contacts et accès](#7-contacts-et-accès)

---

## 1. Architecture générale

Le projet affi-asso repose sur une architecture **serverless** (sans serveur à administrer) composée de trois briques principales :

| Brique | Technologie | Rôle |
|---|---|---|
| **Frontend** | HTML5 / CSS3 / JavaScript vanilla | Interface utilisateur (SPA) |
| **Backend** | Python 3 (Vercel Functions) | API REST (authentification, données) |
| **Base de données** | PostgreSQL (Neon Cloud) | Stockage des membres, événements, contenus |
| **Hébergement & CDN** | Vercel | Déploiement, distribution mondiale, HTTPS |
| **Dépôt de code** | GitHub | Versionnement, sauvegarde du code source |

### Schéma simplifié

```
Utilisateur (navigateur)
     │  HTTPS
     ▼
┌──────────────┐
│   Vercel     │ ── CDN mondial (fichiers statiques)
│  (Serverless)│ ── Fonctions Python (API /api/*)
└──────┬───────┘
       │  SSL (sslmode=require)
       ▼
┌──────────────┐
│  Neon Cloud  │ ── PostgreSQL managé
│  (Database)  │ ── Branches : main (prod) / dev (staging)
└──────────────┘
```

---

## 2. Hébergement

### 2.1 Plateforme Vercel

- **Type** : Platform-as-a-Service (PaaS) serverless
- **URL production** : `affi-asso.vercel.app` (ou domaine personnalisé)
- **URL staging** : `affi-asso-dev.vercel.app`
- **Localisation** : CDN mondial avec edge locations en Europe
- **Disponibilité** : SLA de 99,99 % (plan Pro)
- **Déploiement** : Automatique à chaque push sur GitHub
  - Branche `master` → production
  - Branche `dev` → staging

#### Ce que Vercel gère automatiquement

- Certificats SSL/TLS (HTTPS)
- Mise à l'échelle automatique (auto-scaling)
- Protection DDoS de base
- Distribution CDN mondiale
- Logs d'exécution des fonctions

#### Limites de la configuration actuelle

| Paramètre | Valeur |
|---|---|
| Durée max d'une fonction | 30 secondes |
| Runtime Python | @vercel/python@4.3.0 |
| Fichiers statiques | Servis depuis `/public` |

### 2.2 Base de données Neon

- **Type** : PostgreSQL managé (Database-as-a-Service)
- **Fournisseur** : Neon (https://console.neon.tech)
- **Connexion** : SSL obligatoire (`sslmode=require`)
- **Branches** :
  - `main` → base de production
  - `dev` → base de développement/staging
- **Capacité** : Mise à l'échelle automatique (compute on-demand)
- **Localisation** : Région configurable (Europe recommandée)

### 2.3 Code source — GitHub

- **Dépôt** : `https://github.com/mogoro/affi-asso`
- **Branches** : `master` (production), `dev` (développement)
- **Accès** : Privé, limité aux développeurs autorisés

---

## 3. Sauvegarde des données

### 3.1 Stratégie multi-niveaux

La sauvegarde repose sur **trois niveaux complémentaires** :

| Niveau | Méthode | Fréquence | Rétention | Responsable |
|---|---|---|---|---|
| **Niveau 1** | Neon — Point-in-Time Recovery | Continue (automatique) | 7 jours (Free) / 30 jours (Pro) | Neon (automatique) |
| **Niveau 2** | Neon — Branches / Snapshots | À la demande | Illimitée (tant que la branche existe) | Développeur |
| **Niveau 3** | Export SQL manuel (`backup_db.py`) | Hebdomadaire (recommandé) | Stockage local + cloud externe | Développeur |

### 3.2 Niveau 1 — Restauration automatique (Neon)

Neon enregistre en continu toutes les modifications de la base. Il est possible de restaurer la base à **n'importe quel instant** des 7 (ou 30) derniers jours.

**Procédure de restauration** :
1. Se connecter à https://console.neon.tech
2. Sélectionner le projet affi-asso
3. Aller dans **Branches** → sélectionner la branche `main`
4. Cliquer sur **Restore** → choisir la date et l'heure souhaitées
5. Confirmer la restauration

### 3.3 Niveau 2 — Branches Neon (snapshots)

Avant toute opération sensible (migration, mise à jour majeure), créer une branche de sauvegarde :

```bash
# Via l'interface Neon : Branches → Create Branch
# Nom suggéré : backup-YYYY-MM-DD
```

La branche est une copie complète et instantanée de la base à un instant T.

### 3.4 Niveau 3 — Export SQL manuel

Le script `backup_db.py` permet d'exporter toutes les données au format SQL sans nécessiter d'outils PostgreSQL installés localement :

```bash
# Depuis la racine du projet
python backup_db.py
# Génère un fichier SQL daté dans le répertoire courant
```

**Alternative avec pg_dump** (si PostgreSQL est installé) :

```bash
pg_dump "$DATABASE_URL" > backup_affi_$(date +%Y%m%d).sql
```

**Recommandation** : stocker les exports sur un support externe (disque dur, Google Drive, OneDrive) en plus du stockage local.

### 3.5 Sauvegarde du code source

- **GitHub** : historique complet de toutes les versions du code
- **Export ZIP** : téléchargeable depuis GitHub (Settings → Download ZIP)
- **Clone local** : `git clone https://github.com/mogoro/affi-asso.git`

---

## 4. Plan de reprise et remise en route

### 4.1 Scénarios d'incidents et procédures

#### Scénario A — Le site est inaccessible (panne Vercel)

| Étape | Action |
|---|---|
| 1 | Vérifier le statut Vercel : https://www.vercel-status.com |
| 2 | Si panne confirmée → attendre la résolution (SLA 99,99 %) |
| 3 | Si le problème persiste > 1h → contacter le support Vercel |
| 4 | En dernier recours → redéployer sur une autre plateforme (voir §4.2) |

**Temps de reprise estimé** : quelques minutes (automatique) à 1 heure.

#### Scénario B — La base de données est corrompue ou des données sont perdues

| Étape | Action |
|---|---|
| 1 | Se connecter à Neon Console |
| 2 | Utiliser le Point-in-Time Recovery pour restaurer à un instant avant l'incident |
| 3 | Vérifier les données restaurées via l'interface ou un client SQL |
| 4 | Si PITR indisponible → restaurer depuis une branche de backup |
| 5 | Si aucune branche → importer le dernier export SQL manuel |

**Temps de reprise estimé** : 5 à 30 minutes.

#### Scénario C — Le code est cassé (bug en production)

| Étape | Action |
|---|---|
| 1 | Aller sur Vercel Dashboard → Deployments |
| 2 | Identifier le dernier déploiement fonctionnel |
| 3 | Cliquer sur **Promote to Production** (rollback instantané) |
| 4 | Corriger le bug sur la branche `dev`, tester, puis redéployer |

**Temps de reprise estimé** : 1 à 5 minutes (rollback instantané).

#### Scénario D — Compromission du compte GitHub ou Vercel

| Étape | Action |
|---|---|
| 1 | Changer immédiatement les mots de passe des comptes concernés |
| 2 | Révoquer tous les tokens d'accès (GitHub → Settings → Tokens) |
| 3 | Régénérer la variable `DATABASE_URL` dans Neon |
| 4 | Mettre à jour la variable d'environnement dans Vercel |
| 5 | Auditer les commits récents et déploiements pour détecter des modifications malveillantes |
| 6 | Forcer un nouveau déploiement depuis un commit vérifié |

**Temps de reprise estimé** : 30 minutes à 2 heures.

### 4.2 Plan de reprise sur une infrastructure alternative

En cas de défaillance prolongée de Vercel ou Neon, le projet peut être redéployé :

**Frontend + Backend (alternative à Vercel)** :
- Netlify, Railway, Render, ou un VPS (OVH, Scaleway)
- Le code est standard Python + HTML, compatible avec toute plateforme

**Base de données (alternative à Neon)** :
- Supabase (PostgreSQL managé)
- Railway PostgreSQL
- Tout serveur PostgreSQL (OVH, Scaleway, AWS RDS)
- Importer le schéma (`schema.sql`) puis les données (export SQL)

**Procédure de migration complète** :

```bash
# 1. Cloner le code
git clone https://github.com/mogoro/affi-asso.git

# 2. Créer une base PostgreSQL sur le nouveau fournisseur

# 3. Importer le schéma
psql $NEW_DATABASE_URL < schema.sql

# 4. Importer les données
psql $NEW_DATABASE_URL < backup_affi_YYYYMMDD.sql

# 5. Configurer la variable DATABASE_URL sur la nouvelle plateforme

# 6. Déployer (exemple avec Railway ou Render)
```

---

## 5. Cybersécurité

### 5.1 Sécurité des communications

| Mesure | Technologie | Description |
|---|---|---|
| **HTTPS obligatoire** | TLS 1.2+ (Vercel) | Tout le trafic entre l'utilisateur et le serveur est chiffré. Certificats SSL gérés et renouvelés automatiquement par Vercel. |
| **Connexion BDD chiffrée** | SSL (`sslmode=require`) | La connexion entre les fonctions API et la base PostgreSQL est chiffrée via SSL. Aucune donnée ne transite en clair. |

### 5.2 Protection contre les attaques web

| Menace | Protection | Technologie |
|---|---|---|
| **Injection SQL** | Requêtes paramétrées | `psycopg2` avec paramètres `%s` — les données utilisateur ne sont jamais concaténées dans les requêtes SQL |
| **Attaques DDoS** | Protection réseau | Vercel intègre une protection DDoS au niveau CDN (filtrage automatique du trafic malveillant) |
| **Attaques par force brute** | Sessions à durée limitée | Tokens de session expirés après 30 jours, invalidation possible via logout |
| **Cross-Site Scripting (XSS)** | Échappement des données | Les données affichées sont traitées côté client avec des méthodes sécurisées |
| **Exposition des secrets** | Variables d'environnement | `DATABASE_URL` et secrets stockés dans les variables d'environnement Vercel, jamais dans le code source (`.env` dans `.gitignore`) |

### 5.3 Authentification et gestion des accès

| Composant | Implémentation |
|---|---|
| **Hachage des mots de passe** | SHA-256 avec sel (salt) — les mots de passe ne sont jamais stockés en clair dans la base |
| **Tokens de session** | Générés aléatoirement (48 octets, URL-safe), stockés en base avec date d'expiration |
| **Contrôle d'accès** | Vérification du token + rôle (`is_admin`, `is_board`) à chaque requête API protégée |
| **Séparation des rôles** | Visiteur (public) / Membre authentifié / Administrateur — chaque niveau a des permissions distinctes |
| **Déconnexion** | Suppression du token en base (invalidation immédiate) |

### 5.4 Sécurité de l'infrastructure

| Mesure | Fournisseur | Détail |
|---|---|---|
| **Isolation serverless** | Vercel | Chaque fonction s'exécute dans un conteneur isolé, sans accès au système de fichiers partagé |
| **Pas de serveur à administrer** | Vercel + Neon | Aucun OS à patcher, aucun serveur SSH exposé — réduit drastiquement la surface d'attaque |
| **Mises à jour automatiques** | Vercel + Neon | Les plateformes appliquent automatiquement les correctifs de sécurité |
| **Accès réseau restreint** | Neon | La base de données n'est accessible que via les connexions authentifiées SSL |
| **Journalisation** | Table `logs` | Toutes les actions sensibles (connexion, modification, suppression) sont tracées avec horodatage et adresse IP |

### 5.5 Sécurité du code source

| Mesure | Détail |
|---|---|
| **Dépôt privé** | Le code est hébergé sur un dépôt GitHub privé, accessible uniquement aux développeurs autorisés |
| **Pas de secrets dans le code** | Le fichier `.gitignore` exclut `.env` et tout fichier contenant des identifiants |
| **Déploiement contrôlé** | Seuls les pushs sur `master` déclenchent un déploiement en production |
| **Historique complet** | Git conserve l'historique de toutes les modifications, permettant un audit à tout moment |

### 5.6 Avantages sécuritaires de l'architecture serverless

L'architecture choisie (Vercel + Neon) offre des avantages structurels en matière de cybersécurité par rapport à un hébergement traditionnel :

1. **Aucun serveur à maintenir** : pas de système d'exploitation à patcher, pas de service SSH/FTP exposé, pas de ports ouverts à surveiller.

2. **Isolation des fonctions** : chaque requête API s'exécute dans un conteneur éphémère et isolé. Une éventuelle faille dans une fonction ne compromet pas les autres.

3. **Mise à l'échelle automatique** : en cas de pic de trafic (légitime ou attaque), la plateforme absorbe la charge sans indisponibilité.

4. **Certificats SSL automatiques** : aucun risque d'oubli de renouvellement de certificat, source fréquente de failles sur les hébergements classiques.

5. **Aucune donnée sensible sur le serveur** : les variables d'environnement sont chiffrées au repos et injectées uniquement à l'exécution.

### 5.7 Recommandations d'amélioration

Pour renforcer davantage la sécurité, les mesures suivantes sont recommandées :

| Priorité | Recommandation | Impact |
|---|---|---|
| **Haute** | Migrer le hachage des mots de passe vers **bcrypt** ou **argon2** (plus résistant que SHA-256 aux attaques par dictionnaire) | Protection des comptes |
| **Haute** | Activer l'**authentification à deux facteurs (2FA)** sur les comptes GitHub, Vercel et Neon | Protection des accès administrateur |
| **Moyenne** | Ajouter un **rate limiting** sur l'endpoint `/api/auth` (limiter les tentatives de connexion) | Protection contre le brute-force |
| **Moyenne** | Restreindre le CORS (`Access-Control-Allow-Origin`) au domaine de production au lieu de `*` | Réduction de la surface d'attaque |
| **Basse** | Mettre en place une **politique de rotation** des tokens de base de données (tous les 90 jours) | Réduction du risque en cas de fuite |

---

## 6. Conformité RGPD

Le projet intègre des mécanismes de conformité au Règlement Général sur la Protection des Données :

| Exigence RGPD | Implémentation |
|---|---|
| **Consentement explicite** | Table `consentements` avec type de consentement, date et version des CGU |
| **Droit à l'oubli** | Champ `archived_at` pour suppression logique des comptes membres |
| **Minimisation des données** | Les membres choisissent ce qu'ils rendent visible (`consent_annuaire`, `consent_newsletter`) |
| **Traçabilité** | Table `logs` enregistrant toutes les actions avec utilisateur, cible, détails et adresse IP |
| **Sécurité des données** | Chiffrement en transit (SSL/TLS), mots de passe hachés, accès contrôlé par rôle |

---

## 7. Contacts et accès

| Service | URL d'accès | Rôle |
|---|---|---|
| **Site production** | affi-asso.vercel.app | Site public |
| **Site staging** | affi-asso-dev.vercel.app | Tests et validation |
| **Vercel Dashboard** | vercel.com/dashboard | Gestion des déploiements |
| **Neon Console** | console.neon.tech | Gestion de la base de données |
| **GitHub** | github.com/mogoro/affi-asso | Code source |

---

*Document généré pour le projet AFFI-ASSO — Association des Femmes et Filles d'Ingénieurs.*
