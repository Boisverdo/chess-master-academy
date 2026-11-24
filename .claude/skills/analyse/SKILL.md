---
name: analyse
description: Audit complet de Chess Master Academy (structure, code, tests, sécurité, données personnelles, déploiement) qui écrit un rapport d'améliorations concret. Utiliser quand l'utilisateur tape /analyse, dit « analyse le projet », « audit », « vérifie que tout va bien », « rapport du système » ou « analyse de nuit ».
model: sonnet
context: fork
user-invocable: true
---

# Skill : Analyse

> Copie adaptée du skill « analyst » du projet IAOS. Audit silencieux du projet Chess Master Academy :
> structure, code, tests, journaux et modules, pour produire un rapport d'améliorations.

## Ton rôle

Analyser le projet en lecture seule et produire un rapport d'améliorations. Tu ne modifies aucun fichier
du projet : tu écris seulement le fichier de rapport.

Projet : application web progressive d'échecs en français (React, TypeScript, Vite, chess.js, chessground,
Stockfish en WASM). Site publié : https://boisverdo.github.io/chess-master-academy/ (GitHub Pages, déployé
à chaque poussée sur `main`).

## Déroulement (dans cet ordre)

### ÉTAPE 1 — Audit technique
- Lire la structure du projet (`src/`, `tests/`, `scripts/`, `docs/`, `public/`, fichiers de configuration).
- Lire les derniers commits (`git log --oneline -20`) et l'état du dépôt (`git status`).
- Lancer la vérification des types : `npm run typecheck`.
- Lancer les tests unitaires : `npm test` (relever le nombre de tests réussis, échoués, ignorés).
- Ne lancer les tests de bout en bout (`npm run test:e2e`) que si l'utilisateur le demande : ils sont longs.
- Vérifier la configuration : `package.json`, `vite.config.ts`, `playwright.config.ts`, `.github/workflows/`.

### ÉTAPE 2 — Analyse des modules
- Parcourir chaque section (`src/sections/`), le moteur (`src/engine/`), l'analyse (`src/analysis/`),
  l'apprentissage (`src/learning/`), le stockage (`src/storage/`) et les intégrations (`src/integrations/`).
- Repérer le code mort, les doublons, les inefficacités et les textes incohérents.
- Vérifier les contraintes du projet :
  - toutes les règles des échecs respectées (roque, prise en passant, promotion, pat, nulles) ;
  - aucune analyse de moteur ni cote Elo officielle inventée ;
  - données du joueur conservées entre les sessions, données personnelles protégées ;
  - licences et conditions d'utilisation respectées (Lichess, Chess.com, Stockfish, pièces) ;
  - aucun mot de passe demandé ni enregistré, aucun contournement d'authentification Chess.com ;
  - version PC intacte et version téléphone confortable.
- Vérifier que la documentation (`docs/guide-utilisation.md`, `docs/documentation-technique.md`) suit le code.

### ÉTAPE 3 — Suggestions
- Bugs à corriger (priorité haute).
- Améliorations de fiabilité, d'accessibilité et de confort sur téléphone.
- Nouvelles fonctionnalités possibles pour l'apprentissage des échecs.
- Optimisations de performance (taille du paquet, chargement du moteur, service worker).

### ÉTAPE 4 — Rapport
Écrire le rapport dans :
`.claude/skills/analyse/data/reports/AAAA-MM-JJ_analyse.md`

Remplacer AAAA-MM-JJ par la date du jour.

Format du rapport (texte brut, en français) :

```
Date : [date]
Heure : [heure]

BUGS ET ERREURS
- [liste, avec priorité CRITIQUE / HAUTE / MOYENNE / BASSE et fichier:ligne]

AMÉLIORATIONS SUGGÉRÉES
- [liste avec priorité]

NOUVELLES IDÉES
- [liste]

ÉTAT GÉNÉRAL
[résumé en 2 ou 3 phrases, avec les résultats des tests]
```

Lire les rapports précédents du même dossier et signaler ce qui a été résolu depuis.

## Règles
- Ne JAMAIS envoyer de message à Telegram ni à un service externe.
- Ne JAMAIS modifier les fichiers du projet (lecture seule, sauf l'écriture du rapport).
- Ne jamais committer ni pousser.
- Ne jamais affirmer qu'un problème existe sans l'avoir vérifié dans le code ou par une commande.
- Rester concis et concret ; le rapport doit faire moins de 50 lignes.
- À la fin, donner à l'utilisateur le chemin du rapport et les 3 points les plus importants.
