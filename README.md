# CHESS MASTER ACADEMY

Académie d'échecs indépendante, propulsée par un entraîneur IA qui apprend à **penser** comme un joueur expérimenté.

## État du projet

| Phase | Statut |
|---|---|
| 1 — Recherche et planification | ✅ Terminée |
| 2 — Prototype (échiquier, règles, partie complète, PGN) | ✅ Terminée et testée — [rapport](docs/05-phase2-rapport.md) |
| 3 — Apprentissage (leçons, exercices, ouvertures, évaluation initiale) | ⏳ Prochaine |
| 4 à 7 | ⏳ À venir |

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
| `npm test` | Tests unitaires (règles, perft, PGN) |
| `npm run test:e2e` | Tests de bout en bout dans un navigateur (ordinateur + téléphone) |
| `npm run typecheck` | Vérification du typage |
| `npm run build` | Version de production dans `dist/` |

## Documentation

1. [Analyse fonctionnelle de Chess.com](docs/01-analyse-chesscom.md)
2. [Connexion Chess.com / Google : possibilités réelles](docs/02-integration-chesscom.md)
3. [Architecture technique](docs/03-architecture.md)
4. [Plan de développement et risques](docs/04-plan-et-risques.md)
5. [Rapport de la Phase 2](docs/05-phase2-rapport.md)

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
| React, React Router, Vite | MIT | Interface |
