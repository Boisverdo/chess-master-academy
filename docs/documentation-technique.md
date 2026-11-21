# Documentation technique — Chess Master Academy

> Version 1.0 · Pour qui reprend ou fait évoluer le code.

## Pile technique

| Rôle | Choix | Licence |
|---|---|---|
| Interface | React 19, React Router 7 (routes en `HashRouter`), TypeScript strict, Vite 8 | MIT / Apache-2.0 |
| Règles, PGN, FEN | chess.js 1.4 | BSD-2-Clause |
| Échiquier | Chessground 9 (encapsulé dans `BoardView`) | GPL-3.0+ |
| Moteur | Stockfish 19 lite (WebAssembly, `stockfish` 19.0.1), dans un Web Worker | GPL-3.0 |
| Données locales | IndexedDB via Dexie 4 (schéma versionné v1→v4) | Apache-2.0 |
| Synchronisation (facultative) | Google Identity Services (chargé à la demande) + API Google Drive v3, dossier privé `appDataFolder` | Service Google |
| Exercices | Base de puzzles Lichess (extrait vérifié) | CC0 |
| Tests | Vitest, Playwright, axe-core | MIT / Apache-2.0 / MPL-2.0 (développement) |

Le projet est sous **GPL-3.0-or-later** (fichier `LICENSE`).

## Organisation du code

```
src/
  core/          Règles (ChessGame immuable), PGN, notation — seule porte vers chess.js
  board/         BoardView (Chessground), PlayableBoard (coups légaux, promotion)
  engine/        Service UCI (engine.ts), transport navigateur (browser.ts) et Node (node-engine.ts),
                 niveaux de l'ordinateur (levels.ts), lecture UCI et probabilité de gain (uci.ts)
  analysis/      Revue de partie (review.ts), analyse (runner.ts), service (service.ts), lot (batch.ts),
                 menace adverse et PGN annoté (extras.ts), vues (EvalViews.tsx)
  coach/         Faits calculés (facts.ts), explications (explain.ts), habitudes (habits.ts),
                 « Retente ta chance » (retry.ts), données de l'entraîneur (coachData.ts)
  learning/      Leçons (contenu + vérification), ouvertures, exercices, évaluation, recommandations
  progress/      Statistiques, défis, objectifs, badges, examens, graphique
  integrations/  Chess.com (client PubAPI, import, service), Lichess (client de l'API publique, import) et Google (connexion, Drive) — modules isolés et facultatifs
  sync/          Synchronisation entre appareils : instantané portable et fusion (snapshot.ts), base locale (local.ts),
                 gestionnaire automatique (manager.ts), bandeau et état pour les écrans
  storage/       Base Dexie, dépôt (lecture/écriture/sauvegarde), calculs d'apprentissage, événements
  sections/      Écrans (un dossier par section ; chargés à la demande)
  ui/            Thème, paramètres, fenêtres modales, textes riches, petits outils
  data/          puzzles.json (régénérable : scripts/extract-puzzles.mjs)
scripts/         Copie du moteur, extraction des exercices, icônes, service hors ligne, tests de production
tests/e2e/       Scénarios Playwright (dont accessibilité, hors ligne, performances)
docs/            Analyse, architecture, rapports de phase, mesures, guides
```

**Règles d'architecture** : aucune section n'appelle chess.js, Chessground, Stockfish ou une API externe directement ; elles passent par `core/`, `board/`, `engine/` et `integrations/`. Toute écriture de données passe par `storage/repo.ts` (qui notifie les écrans).

## Principes de fiabilité

- **Aucun coup illégal** : tout coup est validé par `ChessGame` (perft vérifié sur 6 positions de référence). Les positions impossibles (roi en échec sans le trait) sont refusées.
- **Aucune évaluation inventée** : les chiffres viennent de Stockfish ; les positions finales sont décidées par les règles.
- **Contenu vérifié** : `lessons.test.ts` (règles), `lessons.engine.test.ts` (Stockfish : coups acceptés bons, résultats annoncés justes, positions jouables), `openings.test.ts`, `puzzles.test.ts` (3 365 solutions rejouées).
- **Indépendance** : sans Chess.com, sans réseau (application installée), sans moteur (message clair), le reste fonctionne.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Développement (port 5173) |
| `npm run app` | Compile et sert la version de production (port 4173), installable |
| `npm test` | Tests unitaires (dont Stockfish réel sous Node) |
| `npm run test:e2e` | Scénarios navigateur sur le serveur de développement |
| `npm run test:prod` | Toute la suite sur la version de production (CSP, hors ligne, performances), servie sur le port 4179 pour ne pas gêner `npm run app` |
| `npm run typecheck` / `npm run build` | Typage / compilation |
| `MEASURE=1 npx vitest run src/engine/levels.measure.test.ts` | Tournoi de mesure des niveaux |
| `node scripts/extract-puzzles.mjs <fichier.csv.zst>` | Régénérer les exercices depuis la base Lichess |
| `npm run icons` | Régénérer les icônes depuis `public/favicon.svg` |

## Données

Base IndexedDB `chess-master-academy` :

| Table (version) | Contenu |
|---|---|
| `profile` (v1) | Niveau, objectifs, évaluation, cote d'exercices |
| `lessons` (v1) | Progression des leçons |
| `attempts` (v1) | Tous les essais : exercices, leçons, ouvertures, positions, examens, défis |
| `openings` (v1) | Révision espacée des ouvertures |
| `games` (v2, index `externalId` en v3) | Parties (PGN), analyses Stockfish, étiquettes d'habitudes |
| `drills` (v2) | Positions à retravailler (répétition espacée) |
| `integrations` (v3) | Liaison Chess.com (pseudo, consentement, statistiques, choix d'import automatique `autoImport` et dernière vérification `lastAutoCheckAt`) |
| `monthCache` (v3) | Mois d'archives Chess.com terminés (jamais redemandés) |
| `games.uid` (v4) | Identifiant stable d'une partie, identique sur tous les appareils |
| `tombstones` (v4) | Traces des suppressions (partie, Chess.com délié) pour la synchronisation |
| `sync` (v4) | État local de la synchronisation Google Drive (jeton d'une heure, fichier, date) |

**Toute évolution du schéma ajoute une nouvelle `version()`** dans `storage/db.ts`. La sauvegarde (format v3) accepte les sauvegardes v1 et v2.

## Sécurité

- **CSP** (production) : `default-src 'self'`, `connect-src 'self' https://api.chess.com https://lichess.org https://www.googleapis.com https://accounts.google.com/gsi/`, `script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client`, `frame-src https://accounts.google.com/gsi/`, `object-src 'none'`, `form-action 'none'`, `base-uri 'self'` ; `referrer` désactivé.
- Aucun HTML injecté (`innerHTML` absent) ; les textes des leçons passent par `RichText` (gras uniquement).
- Les adresses reçues de Chess.com ne deviennent un lien que si elles sont `https://www.chess.com/…` (`safeChessComUrl`) ; seules des URL d'archives de l'API sont suivies.
- **Lichess** (`integrations/lichess/`) : API publique sans connexion au compte (OAuth existe chez Lichess mais n'est pas nécessaire pour des parties publiques). Profil `GET /api/user/{pseudo}`, parties `GET /api/games/user/{pseudo}` en NDJSON (`pgnInJson`, `clocks`, `opening`, `finished`, filtres `perfType`, `rated`, `since`, `max`). Une requête à la fois ; après un 429, une minute d'attente puis une seule nouvelle tentative (règle de Lichess). Identifiant de partie : `https://lichess.org/{id}` (`externalId`), source `lichess`, liaison `integrations` d'id `lichess`. Variantes et parties non terminées ignorées. Vérifié le 21/11/2026 : l'API répond aux navigateurs avec `Access-Control-Allow-Origin: *` (elle renvoie 404 aux outils en ligne de commande sans en-tête de navigateur). L'import automatique reprend les règles de Chess.com (consentement distinct, 6 heures) avec `since` = dernière vérification et 100 parties au plus. Le bandeau `AutoImportBanner` vérifie Chess.com puis Lichess. Panneaux communs : `sections/integrations/shared.tsx`.
- **Import automatique Chess.com** (`integrations/chesscom/auto.ts`, lancé par `AutoImportBanner` à l'ouverture et au retour sur l'application) : consentement distinct de la liaison, désactivé par défaut ; au plus une vérification toutes les 6 heures (notée avant les requêtes, donc une erreur ne relance rien à chaque ouverture) ; seulement les mois depuis la dernière vérification, 3 au maximum ; requêtes en série par le même client ; échec silencieux ; aucune analyse automatique (coûteuse en processeur).
- Entrées bornées : PGN ≤ 5 Mo, sauvegarde ≤ 20 Mo et validée avant toute écriture (aucune donnée effacée si elle est invalide), pseudo validé.
- Aucun mot de passe, aucune clé, aucun suivi. Les requêtes Chess.com ne contiennent que le pseudo public. La synchronisation (facultative, consentement explicite) n'envoie la progression qu'au Google Drive du joueur, dans le dossier privé de l'application (permission `drive.appdata` uniquement) ; le fichier reçu est validé avant toute écriture. Détails : [guide-synchronisation.md](guide-synchronisation.md).
- `npm audit` : 0 vulnérabilité ; dépendances figées (`--save-exact`).

## Application installable (PWA)

- `public/manifest.webmanifest` + icônes générées (`scripts/make-icons.mjs`).
- `dist/sw.js` est généré à la compilation (`vite.config.ts`, modèle `scripts/sw-template.js`) : met en cache **tous** les fichiers (moteur et exercices compris), version = empreinte du contenu, anciens caches supprimés.
- Correctif notable : `caches.match(..., { ignoreVary: true })` — sans lui, les modules chargés à la demande (en-tête `Origin`, réponses `Vary: Origin`) ne sont pas retrouvés hors ligne.

## Affichage sur téléphone

- `src/ui/mobile.css`, chargé en dernier, regroupe tous les ajustements pour téléphone dans une seule requête `@media (max-width: 640px)` : l'affichage sur ordinateur et tablette n'est pas touché.
- Ajustements : cibles tactiles d'au moins 40 à 44 px (puces, onglets, liens de liste, cases à cocher), champs en 16 px (pas de zoom automatique sur iPhone), onglets sur plusieurs lignes, champ de fichier contenu dans la largeur, boutons principaux pleine largeur. Les coordonnées de l'échiquier (lettres et chiffres) sont placées dans les cases du bord sur tous les écrans (`src/board/board.css`).
- Vérification : `tests/e2e/mobile.spec.ts` (aucun débordement sur 15 écrans, cibles et champs) ; lors de la mise en place, 76 captures d'écran ordinateur et tablette (1920, 1366, 1024 et 768 px, 19 écrans) étaient identiques au pixel près avant et après.

### Confort sur téléphone

- **Mode paysage** : bloc `@media (orientation: landscape) and (max-height: 520px) and (pointer: coarse)` de `src/ui/mobile.css` — échiquier à gauche, à la hauteur de l'écran, le reste à droite. `pointer: coarse` limite la règle aux écrans tactiles : l'ordinateur n'est pas concerné.
- **Sons et vibration** (`src/board/feedback.ts`) : déclenchés par `BoardView` quand un nouveau coup apparaît (joueur, adversaire ou navigation) ; coup, prise (une pièce de moins) ou échec. Sons synthétisés avec Web Audio (aucun fichier, aucune licence). Vibration par `navigator.vibrate` quand elle existe. Son désactivé par défaut, vibration activée par défaut.
- **Couleurs d'échiquier** : attribut `data-board` sur `<html>` (posé par `SettingsProvider`) qui redéfinit `--sq-light` et `--sq-dark` (`src/board/board.css`) ; les coordonnées suivent automatiquement. Les pièces restent celles de cburnett (seul jeu fourni par chessground).
- Vérification : 54 captures PC et tablette (1920, 1366, 768 px) identiques au pixel à la version précédente ; seule la page Paramètres change (nouveaux réglages).

## Pistes d'évolution

Tournois et multijoueur (nouveau module `integrations/` ou serveur), entraîneur à question libre via un modèle de langage (facultatif, faits calculés uniquement, clé de l'utilisateur), application Tauri avec Stockfish complet, autres langues (textes à extraire dans des fichiers de traduction), tables de finales pour démontrer les forteresses.
