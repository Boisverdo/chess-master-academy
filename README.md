# CHESS MASTER ACADEMY

Académie d'échecs indépendante, propulsée par un entraîneur IA qui apprend à **penser** comme un joueur expérimenté.

## État du projet

| Phase | Statut |
|---|---|
| 1 — Recherche et planification | ✅ Terminée |
| 2 — Prototype (échiquier, règles, partie complète, PGN) | ✅ Terminée et testée — [rapport](docs/05-phase2-rapport.md) |
| 3 — Apprentissage (évaluation, 16 leçons, 3 365 exercices, 14 ouvertures) | ✅ Terminée et testée — [rapport](docs/06-phase3-rapport.md) |
| 4 — Stockfish, adversaire à 6 niveaux, analyse, entraîneur | ✅ Terminée et testée — [rapport](docs/07-phase4-rapport.md) |
| 5 — Chess.com (liaison par pseudo, import, analyse groupée) | ✅ Terminée et testée — [rapport](docs/08-phase5-rapport.md) |
| 6 — Tableau de bord, défis, stratégie positionnelle et finales | ⏳ Prochaine |
| 7 — Tests, sécurité, application Windows, livraison | ⏳ À venir |

## Démarrer

Prérequis : Node.js 20 ou plus récent.

```powershell
npm install
npm run dev
```

Puis ouvrir http://localhost:5173.

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm test` | Tests unitaires (règles, perft, PGN, validation de tout le contenu pédagogique) |
| `npm run test:e2e` | Tests de bout en bout dans un navigateur (ordinateur + téléphone) |
| `npm run typecheck` | Vérification du typage |
| `npm run build` | Version de production dans `dist/` |
| `MEASURE=1 npx vitest run src/engine/levels.measure.test.ts` | Tournoi de mesure des niveaux de l'ordinateur (long) |

## Documentation

1. [Analyse fonctionnelle de Chess.com](docs/01-analyse-chesscom.md)
2. [Connexion Chess.com / Google : possibilités réelles](docs/02-integration-chesscom.md)
3. [Architecture technique](docs/03-architecture.md)
4. [Plan de développement et risques](docs/04-plan-et-risques.md)
5. [Rapport de la Phase 2](docs/05-phase2-rapport.md)
6. [Rapport de la Phase 3](docs/06-phase3-rapport.md)
7. [Rapport de la Phase 4](docs/07-phase4-rapport.md) · [mesure des niveaux](docs/mesures-niveaux.json)
8. [Rapport de la Phase 5](docs/08-phase5-rapport.md)

## Principes non négociables

- Aucun coup illégal accepté ; toutes les règles officielles appliquées.
- Aucune évaluation inventée : chaque chiffre vient d'un calcul réel (Stockfish).
- Fonctionne entièrement sans Chess.com ; intégrations externes facultatives et remplaçables.
- Données du joueur stockées localement, exportables.
- Rien n'est déclaré terminé sans avoir été testé.

## Licence et composants tiers

Chess Master Academy est distribué sous **GPL-3.0-or-later** (voir [LICENSE](LICENSE)).

| Composant | Licence | Usage |
|---|---|---|
| [chess.js](https://github.com/jhlywa/chess.js) | BSD-2-Clause | Règles, PGN, FEN |
| [Chessground](https://github.com/lichess-org/chessground) | GPL-3.0-or-later | Échiquier interactif, pièces « cburnett » |
| [Stockfish 19](https://stockfishchess.org) via [stockfish.js](https://github.com/nmrugg/stockfish.js) | GPL-3.0 | Moteur d'analyse et adversaire (WebAssembly, version lite) |
| [Dexie](https://dexie.org) | Apache-2.0 | Base de données locale (IndexedDB) |
| React, React Router, Vite | MIT | Interface |
| [Base de puzzles Lichess](https://database.lichess.org/#puzzles) | CC0 (domaine public) | 3 365 exercices tactiques (`src/data/puzzles.json`, régénérable avec `scripts/extract-puzzles.mjs`) |
