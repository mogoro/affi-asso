# Note de synthese -- Hebergement et securite du site AFFI

**Projet** : Site web de l'association AFFI
**Date** : 31 mars 2026
**Destinataires** : Bureau et Conseil d'administration

---

## 1. Ou en sommes-nous aujourd'hui ?

Le site fonctionne actuellement sur une **plateforme gratuite de prototypage** (Vercel + Neon). Cette solution nous permet de developper, tester et vous presenter le site, mais elle **n'est pas adaptee a un usage reel** par les membres :

- Aucune garantie de disponibilite
- Performances limitees
- Donnees hebergees aux Etats-Unis
- Support technique inexistant

**Le site actuel est une maquette fonctionnelle, pas un produit fini.**

---

## 2. Ce que nous proposons pour la mise en production

Nous recommandons d'heberger le site sur un **serveur dedie virtuel (VPS) base en France**, chez un fournisseur francais (OVH, Scaleway).

### Ce que cela apporte

- **Fiabilite** : serveur dedie avec ressources garanties (pas de ralentissements)
- **Securite renforcee** : pare-feu, protection contre les intrusions, chiffrement de toutes les communications
- **Donnees en France** : conformite RGPD renforcee, donnees des membres hebergees dans un datacenter francais
- **Independance** : nous maitrisons entierement l'infrastructure, pas de dependance a un fournisseur americain
- **Domaine professionnel** : le site sera accessible sur **affi-asso.fr** (au lieu d'une adresse technique)

### Combien ca coute

| Poste | Par mois | Par an |
|---|---|---|
| Serveur (VPS OVH en France) | 6 EUR | 72 EUR |
| Nom de domaine (affi-asso.fr) | 1 EUR | 12 EUR |
| Certificat de securite (HTTPS) | gratuit | gratuit |
| Sauvegardes distantes | 1 EUR | 12 EUR |
| **Total** | **8 EUR/mois** | **96 EUR/an** |

---

## 3. Comment les donnees des membres sont-elles protegees ?

### Sauvegardes

Les donnees sont protegees par **trois niveaux de sauvegarde** :

1. **Sauvegarde automatique quotidienne** de la base de donnees (conservee 30 jours)
2. **Copie hebdomadaire** sur un stockage distant (en cas de panne du serveur)
3. **Photo complete du serveur** (snapshot) chaque mois

En cas de probleme, les donnees peuvent etre restaurees en **10 a 30 minutes**.

### Securite

- Toutes les communications sont **chiffrees** (HTTPS) -- personne ne peut intercepter les echanges
- Les mots de passe des membres ne sont **jamais stockes en clair**
- La base de donnees n'est **pas accessible depuis Internet** (uniquement en interne sur le serveur)
- Un **pare-feu** bloque tout acces non autorise au serveur
- Un systeme **anti-intrusion** bloque automatiquement les adresses IP suspectes
- L'acces au serveur est protege par **cle de securite** (pas de simple mot de passe)
- Les **mises a jour de securite** du serveur sont appliquees automatiquement

### Conformite RGPD

- Les membres donnent leur **consentement explicite** pour l'affichage de leurs informations
- Toutes les actions sont **tracees** (qui a fait quoi, quand)
- Un membre peut demander la **suppression de son compte** a tout moment
- Les donnees sont hebergees **en France**, dans un datacenter soumis au droit europeen

---

## 4. Que se passe-t-il en cas de probleme ?

| Situation | Consequence | Delai de retablissement |
|---|---|---|
| Le site est lent ou inaccessible | Redemarrage du serveur | **2 a 5 minutes** |
| Le serveur tombe en panne | Restauration depuis une sauvegarde | **10 a 30 minutes** |
| Une erreur est mise en ligne | Retour a la version precedente | **5 a 15 minutes** |
| Perte totale du serveur | Reconstruction sur un nouveau serveur | **environ 2 heures** |

Dans le pire des cas (perte totale), les donnees sont recuperables grace aux sauvegardes distantes. **Aucune donnee ne peut etre definitivement perdue.**

---

## 5. Prochaines etapes

1. **Validation** de cette note par le bureau
2. **Commande** du serveur VPS et du nom de domaine (~10 min)
3. **Migration** du prototype vers le serveur de production (~1 journee de travail)
4. **Tests** et validation par le bureau
5. **Ouverture** du site aux membres

---

*Pour toute question technique, contactez le responsable informatique du projet.*
