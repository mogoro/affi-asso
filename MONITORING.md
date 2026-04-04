# Monitoring AFFI-ASSO

## Health Check
URL: https://affi-asso.vercel.app/api/health

## Setup UptimeRobot (gratuit)
1. Créer un compte sur https://uptimerobot.com
2. Ajouter un nouveau moniteur:
   - Type: HTTP(s)
   - URL: https://affi-asso.vercel.app/api/health
   - Intervalle: 5 minutes
   - Alerte: votre email
3. Le moniteur vérifie:
   - La réponse du serveur
   - La connexion à la base de données
   - La latence
