# 04 — Plan de développement, risques et critères de passage

> Phase 1 · 19 novembre 2026. Ordre conforme aux priorités absolues : fondations d'abord, entraîneur IA comme objectif central, indépendance totale vis-à-vis de Chess.com.

## Règle de passage entre phases

Une phase n'est terminée que si : ✅ ses tests passent · ✅ les erreurs connues sont corrigées · ✅ les données sont sauvegardées · ✅ un commit Git marque la fin · ✅ la documentation est à jour · ✅ une solution de repli existe pour chaque dépendance externe.

## Phases

### Phase 2 — Prototype fonctionnel (échiquier + règles + partie complète)
- Initialiser Vite + React + TypeScript strict, ESLint, Vitest, Playwright ; licence GPL-3.0.
- Adaptateur `core/` autour de chess.js ; **tests perft** sur les positions de référence (position initiale, « Kiwipete », etc.).
- `BoardView` (Chessground) : glisser/toucher, coups légaux, derniers coups, flèches, retournement, **choix de la pièce de promotion**.
- Partie à deux joueurs sur le même appareil, historique en notation algébrique, navigation ◀ ▶, annulation, export/import PGN.
- Fin de partie détectée et affichée : mat, pat, 50 coups, triple répétition, matériel insuffisant, abandon, nulle d'un commun accord.
- Squelette de navigation des 12 sections, thème original, responsive.
- **Critères** : tests de tous les coups spéciaux (roque des deux côtés et interdictions, prise en passant, promotion ×4, sous-promotion), aucun coup illégal possible (tests e2e), partie complète jouée de bout en bout.

### Phase 3 — Apprentissage (sans moteur)
- Format de leçon (données JSON/MDX versionnées) + lecteur : démonstration animée → exercice → validation.
- Module 2 complet (règles), premières leçons du Module 3 (principes).
- Module 5 : import d'un sous-ensemble filtré de la base de puzzles Lichess (CC0), classé par thème ; indices progressifs ; résultats enregistrés.
- Module 4 : arborescence des 14 ouvertures avec idées, pièges et erreurs typiques ; exercices de mémorisation.
- Module 1 : évaluation initiale (questionnaire + exercices + positions) → niveau de départ et profil.
- Stockage Dexie + export/import de sauvegarde.

### Phase 4 — Moteur et entraîneur IA
- `EngineService` (Stockfish WASM en Worker) ; jeu contre l'IA, 6 niveaux **mesurés** ; avec ou sans pendule.
- Analyse de partie : évaluation par coup, classification, précision, moments critiques, graphique d'évaluation.
- Couche « faits » : détecteurs de motifs + réfutations (testés sur des positions annotées à la main).
- Entraîneur : méthode socratique, gabarits français, commentaire en direct ou en fin de partie, « Comprendre mon erreur ».
- Profil de compétences, détection d'habitudes, programme personnalisé, répétition espacée.
- LLM facultatif (mode B) branché sur les faits, avec revérification des variantes.

### Phase 5 — Chess.com (complément facultatif)
- Module `integrations/chesscom` (PubAPI, lecture seule, séquentiel, ETag, consentement) — voir 02.
- Tests réels avec ton pseudo, **après ton accord**.
- Les parties importées alimentent le profil d'apprentissage.

### Phase 6 — Progression et motivation
- Tableau de bord (Module 13), graphiques, historique.
- Défis quotidiens, objectifs hebdomadaires, examens, badges de maîtrise (Module 14).
- Modules 6 et 7 complets (stratégie positionnelle, finales).

### Phase 7 — Tests, sécurité, livraison
- Campagne de tests complète, performances (temps d'analyse, mémoire, mobile), audit de sécurité et des dépendances.
- PWA installable + **application Windows (Tauri) avec Stockfish natif**.
- Documentation technique + guide d'utilisation en français.

## Risques identifiés

| # | Risque | Prob. | Impact | Mesure |
|---|---|---|---|---|
| R1 | Licence GPL-3.0 (Stockfish, Chessground) incompatible avec une distribution fermée | Certaine si distribution fermée | Élevé | CMA sous GPL-3.0 ; plateau remplaçable (interface `BoardView`) |
| R2 | Stockfish WASM lent sur téléphone | Moyenne | Moyen | Version lite, profondeur adaptative, analyse en arrière-plan avec progression ; binaire natif sous Tauri |
| R3 | Multi-thread WASM bloqué sans en-têtes COOP/COEP | Moyenne | Faible | Repli automatique en mono-thread |
| R4 | L'entraîneur LLM « invente » des analyses | Élevée sans garde-fous | Critique | LLM limité aux faits calculés ; variantes revérifiées ; mode A sans LLM par défaut |
| R5 | Niveaux de l'IA mal calibrés (trop forts/faibles, coups absurdes) | Moyenne | Moyen | Tournois automatiques entre niveaux ; ajustement ; « Elo » affiché seulement comme estimation |
| R6 | PubAPI Chess.com modifiée, bloquée ou indisponible | Faible à moyenne | Faible | Module isolé et désactivable ; import PGN manuel toujours disponible |
| R7 | OAuth Chess.com refusé ou non adapté à un projet personnel | Élevée | Faible | Non nécessaire : la PubAPI couvre les besoins |
| R8 | Perte de données locales (navigateur vidé) | Moyenne | Élevé | Stockage persistant demandé, sauvegarde exportable, rappels de sauvegarde, synchronisation plus tard |
| R9 | Contenus pédagogiques insuffisants en volume/qualité | Moyenne | Élevé | Priorité à la qualité ; relecture des explications ; puzzles CC0 pour le volume |
| R10 | Coût et confidentialité d'une API LLM | Moyenne | Moyen | Facultatif, clé fournie par toi, seules des données de position envoyées, jamais d'information personnelle |
| R11 | Ressemblance avec Chess.com (marques, glyphes, design) | Faible | Élevé | Identité originale, vocabulaire et icônes propres, aucun asset copié |

## Décisions prises (sans besoin de ton arbitrage)

1. PWA React/TypeScript, puis Tauri pour Windows.
2. chess.js pour les règles, Chessground pour le plateau, Stockfish WASM pour le moteur.
3. Stockage local-first (IndexedDB), sauvegarde exportable.
4. Entraîneur en 3 couches ; LLM facultatif et strictement encadré.
5. Chess.com via PubAPI en lecture seule ; pas d'OAuth sans documentation officielle.
6. Licence du projet : GPL-3.0 (à confirmer, voir ci-dessous).

## Seul point qui t'appartient
La licence : **GPL-3.0 recommandée** (le plus simple et conforme). Tu ne devras changer d'avis que si tu prévois de vendre l'application en code fermé.
