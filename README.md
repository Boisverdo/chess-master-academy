# CHESS MASTER ACADEMY

Académie d'échecs indépendante, propulsée par un entraîneur IA qui apprend à **penser** comme un joueur expérimenté.

## État du projet

| Phase | Statut |
|---|---|
| 1 — Recherche et planification | ✅ Documents rédigés (aucun code) |
| 2 — Prototype (échiquier, règles, partie complète) | ⏳ À venir |
| 3 à 7 | ⏳ À venir |

## Documentation (Phase 1)

1. [Analyse fonctionnelle de Chess.com](docs/01-analyse-chesscom.md)
2. [Connexion Chess.com / Google : possibilités réelles](docs/02-integration-chesscom.md)
3. [Architecture technique](docs/03-architecture.md)
4. [Plan de développement et risques](docs/04-plan-et-risques.md)

## Principes non négociables

- Aucun coup illégal accepté ; toutes les règles officielles appliquées.
- Aucune évaluation inventée : chaque chiffre vient d'un calcul réel (Stockfish).
- Fonctionne entièrement sans Chess.com ; intégrations externes facultatives et remplaçables.
- Données du joueur stockées localement, exportables.
- Rien n'est déclaré terminé sans avoir été testé.
