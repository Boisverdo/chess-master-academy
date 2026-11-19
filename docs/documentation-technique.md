# Documentation technique — Chess Master Academy

> Version 1.0 · Pour qui reprend ou fait évoluer le code.

## Pile technique

| Rôle | Choix | Licence |
|---|---|---|
| Interface | React 19, React Router 7 (routes en `HashRouter`), TypeScript strict, Vite 8 | MIT / Apache-2.0 |
| Règles, PGN, FEN | chess.js 1.4 | BSD-2-Clause |
| Échiquier | Chessground 9 (encapsulé dans `BoardView`) | GPL-3.0+ |
| Moteur | Stockfish 19 lite (WebAssembly, `stockfish` 19.0.1), dans un Web Worker | GPL-3.0 |
| Données locales | IndexedDB via Dexie 4 (schéma versionné v1→v3) | Apache-2.0 |
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
  integrations/  Chess.com (client PubAPI, import, service) — module isolé et facultatif
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
| `npm run test:prod` | Toute la suite sur la version de production (CSP, hors ligne, performances) |
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
| `integrations` (v3) | Liaison Chess.com (pseudo, consentement, statistiques) |
| `monthCache` (v3) | Mois d'archives Chess.com terminés (jamais redemandés) |

**Toute évolution du schéma ajoute une nouvelle `version()`** dans `storage/db.ts`. La sauvegarde (format v3) accepte les sauvegardes v1 et v2.

## Sécurité

- **CSP** (production) : `default-src 'self'`, `connect-src 'self' https://api.chess.com`, `script-src 'self' 'wasm-unsafe-eval'`, `object-src 'none'`, `form-action 'none'`, `base-uri 'self'` ; `referrer` désactivé.
- Aucun HTML injecté (`innerHTML` absent) ; les textes des leçons passent par `RichText` (gras uniquement).
- Les adresses reçues de Chess.com ne deviennent un lien que si elles sont `https://www.chess.com/…` (`safeChessComUrl`) ; seules des URL d'archives de l'API sont suivies.
- Entrées bornées : PGN ≤ 5 Mo, sauvegarde ≤ 20 Mo et validée avant toute écriture (aucune donnée effacée si elle est invalide), pseudo validé.
- Aucun mot de passe, aucune clé, aucun suivi ; aucune donnée personnelle envoyée (les requêtes Chess.com ne contiennent que le pseudo public).
- `npm audit` : 0 vulnérabilité ; dépendances figées (`--save-exact`).

## Application installable (PWA)

- `public/manifest.webmanifest` + icônes générées (`scripts/make-icons.mjs`).
- `dist/sw.js` est généré à la compilation (`vite.config.ts`, modèle `scripts/sw-template.js`) : met en cache **tous** les fichiers (moteur et exercices compris), version = empreinte du contenu, anciens caches supprimés.
- Correctif notable : `caches.match(..., { ignoreVary: true })` — sans lui, les modules chargés à la demande (en-tête `Origin`, réponses `Vary: Origin`) ne sont pas retrouvés hors ligne.

## Pistes d'évolution

Tournois et multijoueur (nouveau module `integrations/` ou serveur), entraîneur à question libre via un modèle de langage (facultatif, faits calculés uniquement, clé de l'utilisateur), application Tauri avec Stockfish complet, autres langues (textes à extraire dans des fichiers de traduction), tables de finales pour démontrer les forteresses.
