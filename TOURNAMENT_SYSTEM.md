# Système de Tournois Kibaki

## Vue d'ensemble

Le système de tournois de Kibaki permet d'organiser des compétitions entre personnages avec un système de vote temporisé et une résolution automatique.

## Fonctionnalités

### 1. Menu Global
- Le menu de navigation global est maintenant disponible sur toutes les pages `/t/*`
- Lien "Tournois" ajouté dans la navigation principale

### 2. Vote Spécifique aux Tournois
- Les votes de tournois utilisent la table `tournament_votes` (pas le système Elo général)
- Chaque vote est lié à un match spécifique (`match_id`) et un choix (`choice_id`)
- Protection contre les votes multiples par utilisateur pour le même match

### 3. Fenêtre de Temps par Match
- Chaque match a une fenêtre de vote définie par `opens_at` et `closes_at`
- Les votes ne sont acceptés que pendant cette fenêtre
- Messages d'erreur appropriés si l'utilisateur tente de voter en dehors de la fenêtre

### 4. Résolution Automatique
- Edge Function `tournament-tick` pour la résolution automatique
- Scheduler GitHub Actions qui s'exécute toutes les 5 minutes
- Appelle `rpc('tournament_tick')` pour traiter tous les tournois actifs
- Peut aussi être appelée manuellement pour un tournoi spécifique

### 5. Gestion des Égalités
- La fonction `tournament_tick` gère automatiquement les égalités
- En cas d'égalité, un gagnant aléatoire est sélectionné
- (Note: La logique exacte dépend de l'implémentation de la fonction RPC dans la base de données)

### 6. Bouton Admin Manuel
- Le bouton "Mettre à jour" reste disponible pour les administrateurs
- Permet de déclencher manuellement `tournament_tick` pour un tournoi spécifique
- Fallback utile en cas de problème avec la résolution automatique

## Architecture Technique

### Composants Modifiés
- `src/pages/t/[id].astro` : Utilise maintenant `SiteLayout` avec le menu global
- `src/components/TournamentBracketClient.tsx` : Vote spécifique aux tournois avec vérification temporelle
- `src/components/AppHeader.tsx` : Lien "Tournois" ajouté

### Nouvelles Fonctions
- `supabase/functions/tournament-tick/index.ts` : Edge Function pour la résolution automatique
- `.github/workflows/tournament-scheduler.yml` : Scheduler pour l'exécution automatique

### Base de Données
- Table `tournament_votes` : Stockage des votes de tournois
- Table `tournament_matches` : Informations sur les matchs avec fenêtres temporelles
- Fonction RPC `tournament_tick` : Logique de résolution des matchs

## Configuration

### Variables d'Environnement
- `SUPABASE_URL` : URL de l'instance Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service pour les opérations admin

### Secrets GitHub (pour le scheduler)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Utilisation

### Pour les Utilisateurs
1. Naviguer vers `/t` pour voir la liste des tournois
2. Cliquer sur un tournoi pour voir le bracket
3. Voter pendant les fenêtres de temps ouvertes
4. Suivre la progression automatique du tournoi

### Pour les Administrateurs
1. Utiliser le bouton "Mettre à jour" pour forcer une résolution manuelle
2. Surveiller les logs de la Edge Function pour les erreurs
3. Déclencher manuellement le workflow GitHub si nécessaire

## Déploiement

1. Déployer la Edge Function : `supabase functions deploy tournament-tick`
2. Configurer les secrets GitHub pour le scheduler
3. S'assurer que la fonction RPC `tournament_tick` existe dans la base de données
4. Tester avec un tournoi de démonstration

## Monitoring

- Logs de la Edge Function disponibles dans le dashboard Supabase
- Historique des exécutions du scheduler dans GitHub Actions
- Surveillance des erreurs via les toasts dans l'interface utilisateur
