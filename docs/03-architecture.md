# 03 — Architecture technique recommandée

> Phase 1 · 19 novembre 2026. Les versions exactes seront fixées et vérifiées au début de la Phase 2.

## Vue d'ensemble

**Application web progressive (PWA) « local-first », écrite en TypeScript, empaquetable ensuite en application Windows avec Tauri.**

```
┌──────────────────────────── Interface (React + TypeScript) ─────────────────────────────┐
│ Accueil · Apprentissage · Leçons · Échiquier · Tactiques · Ouvertures · Jouer · Analyse │
│ Chess.com · Entraîneur · Progression · Paramètres                    (i18n : fr d'abord)│
└──────────────┬───────────────────────────────┬──────────────────────────────┬───────────┘
               │                               │                              │
   ┌───────────▼──────────┐       ┌────────────▼───────────┐      ┌──────────▼──────────┐
   │ Noyau échecs          │       │ Service moteur          │      │ Entraîneur IA        │
   │ chess.js (règles)     │       │ Stockfish WASM          │      │ 1. Faits calculés    │
   │ PGN / FEN             │       │ dans un Web Worker      │      │ 2. Profil + carnet   │
   │ Chessground (plateau) │       │ (UCI, file d'attente)   │      │ 3. Rédaction (gabarits│
   └───────────┬──────────┘       └────────────┬───────────┘      │    ou LLM facultatif)│
               │                               │                  └──────────┬──────────┘
   ┌───────────▼───────────────────────────────▼─────────────────────────────▼──────────┐
   │ Stockage local : IndexedDB (Dexie) — profil, parties, analyses, exercices, carnet   │
   │ Export / import de sauvegarde (JSON) · export PGN                                    │
   └───────────────────────────────────────────┬──────────────────────────────────────────┘
                                               │ (modules facultatifs, désactivables)
                              ┌────────────────▼────────────────┐
                              │ Intégrations : Chess.com PubAPI, │
                              │ fichiers PGN, Lichess (plus tard)│
                              └──────────────────────────────────┘
```

## Choix et justifications

### Plateforme : PWA web + Tauri pour Windows
| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **PWA (React/TS/Vite)** | Une base de code pour PC, tablette, téléphone ; hors ligne ; Stockfish WASM éprouvé (Lichess l'utilise) | WASM plus lent qu'un binaire natif | **Retenue** |
| Tauri (Windows) | Même code web, binaire léger, peut lancer **Stockfish natif** (bien plus fort) | Étape d'empaquetage en plus | **Ajout en Phase 7** |
| Electron | Mature | ~150 Mo, consomme beaucoup de mémoire | Écartée |
| .NET / WPF | Natif Windows | Pas de téléphone/tablette, écosystème échecs pauvre | Écartée |
| Flutter | Multiplateforme | Pas d'équivalent mûr à chess.js + Chessground | Écartée |

### Règles : **chess.js** (licence BSD-2-Clause)
Référence de l'écosystème JavaScript : génération de coups légaux, échec, mat, pat, roque, prise en passant, promotion, triple répétition, règle des 50 coups, matériel insuffisant, FEN/PGN. Bien testée. **Toute validation de coup passe par chess.js** : l'échiquier ne fait qu'afficher.
Elle sera vérifiée par nos propres tests « perft » (comptage des positions sur des positions de référence connues) avant toute utilisation.

### Échiquier : **Chessground** (licence GPL-3.0)
Moteur d'échiquier de Lichess : glisser-déposer souris et tactile, clic-clic, coups légaux, derniers coups, échec, flèches et cercles, animations, retournement, très léger (pas de dépendance). C'est exactement la liste du Module 15.
Alternatives : `react-chessboard` (MIT, moins riche : flèches et tactile moins aboutis), `cm-chessboard` (MIT).
→ Chessground est **encapsulé derrière une interface `BoardView`** : on peut le remplacer sans toucher au reste.

### Moteur : **Stockfish** (GPL-3.0) en WebAssembly
- Version WASM « lite » mono-thread (quelques Mo) pour fonctionner partout ; version multi-thread si le navigateur l'autorise (en-têtes COOP/COEP requis — nous les configurons).
- Exécuté dans un **Web Worker** : l'interface ne gèle jamais.
- Service `EngineService` avec une file d'attente : analyse, meilleur coup, multi-PV, arrêt.
- **Niveaux de l'adversaire** : option UCI `Skill Level` + profondeur/temps limités + `UCI_LimitStrength`/`UCI_Elo` pour les niveaux élevés. Chaque niveau sera **mesuré** (tournois automatiques entre niveaux) avant d'être étiqueté.
- Sous Tauri : binaire Stockfish natif comme processus séparé (même interface UCI).

### Licences : conséquence importante
Chessground et Stockfish sont sous **GPL-3.0**. Pour un usage personnel, aucune contrainte. Si l'application est **distribuée** à d'autres, son code source devra être publié sous GPL-3.0.
**Recommandation : placer CMA sous GPL-3.0 dès maintenant.** C'est simple et conforme, et cela n'empêche pas un usage commercial. Si un jour tu veux du code fermé : remplacer Chessground par une alternative MIT (l'interface `BoardView` le permet) et garder Stockfish comme programme séparé, avec avis juridique.

### Données pédagogiques (licences ouvertes)
| Ressource | Licence | Usage |
|---|---|---|
| Base de puzzles Lichess (millions de positions, thèmes : fourchette, clouage, enfilade, découverte, déviation, attraction, interférence, surcharge, mat en N…) | **CC0** (domaine public) | Module 5 — un sous-ensemble filtré, classé par thème et difficulté |
| `lichess-org/chess-openings` (noms et codes ECO) | **CC0** | Reconnaissance d'ouvertures |
| Leçons, plans d'ouvertures, explications | Rédigés par nous | Modules 2, 3, 4, 6, 7 |
| Positions de finales | Positions théoriques (non protégeables) | Module 7 |

### Stockage : **local-first** (IndexedDB via Dexie)
- Tes données restent sur ton appareil : confidentialité maximale, fonctionne hors ligne, aucun serveur à sécuriser au départ.
- **Schéma versionné** avec migrations ; **export/import de sauvegarde** JSON complet ; sauvegarde automatique.
- Synchronisation multi-appareils plus tard (option : Supabase/PostgreSQL avec authentification), sans changer le modèle de données.

### Interface
React 19 + TypeScript strict + Vite · routage par sections · CSS avec variables de thème (clair/sombre) · i18n (`fr` d'abord, structure prête pour d'autres langues) · conception responsive (mobile → bureau) · accessibilité (contraste, clavier, lecteurs d'écran pour la notation).
**Identité visuelle originale** : nom, couleurs, jeu de pièces sous licence libre (ex. ensembles libres utilisés par Lichess, licences vérifiées une à une), aucun élément de Chess.com.

### Qualité
Vitest (tests unitaires : règles, PGN, classification, profil) · Playwright (tests de bout en bout : parties complètes, coups spéciaux, import PGN) · ESLint + Prettier · CI GitHub Actions si le dépôt est publié.

---

## L'entraîneur IA — cœur du produit

Principe absolu : **l'IA ne fabrique jamais un fait échiquéen.** Les chiffres viennent de Stockfish, les motifs viennent de calculs sur la position ; le langage ne fait que les expliquer.

### Couche 1 — Faits calculés (déterministe, testable)
Pour chaque position et chaque coup :
- Évaluation Stockfish avant/après, meilleur coup, variante principale (multi-PV).
- **Probabilité de gain** depuis l'évaluation : `P = 50 + 50 · (2 / (1 + e^(−0,00368208·cp)) − 1)` (formule publiée par Lichess, réimplémentée).
- **Classification** par perte de probabilité : imprécision / erreur / gaffe (seuils ≈ 10 / 20 / 30 points, à calibrer), « occasion manquée », coup de théorie (ouverture reconnue).
- **Précision** d'une partie : moyenne de `103,1668 · e^(−0,04354·perte) − 3,1669` par coup (formule ouverte, appelée « précision CMA »).
- **Détecteurs de motifs** sur l'échiquier réel : pièce non défendue, pièce attaquée par une pièce de moindre valeur, fourchette, clouage, enfilade, découverte, échec disponible, surcharge d'un défenseur, roi non roqué / exposé, pièces non développées, pion passé, pion isolé/doublé, colonne ouverte…
- **Réfutation** : pourquoi le coup joué est mauvais = la meilleure réponse adverse et ce qu'elle gagne (matériel, mat, position).

### Couche 2 — Profil et carnet de l'entraîneur
- Profil de compétences par **thème** (fourchettes, finales de tours, Italienne…) : taux de réussite, tendance, dernière révision.
- **Habitude vs accident** : un même type d'erreur ≥ 3 fois sur les 10 dernières parties = habitude ; sinon ponctuelle.
- Répétition espacée (type SM-2) des notions et des lignes d'ouverture.
- Carnet : notions vues, erreurs récurrentes, objectifs, dernière séance → l'entraîneur ne recommence jamais à zéro.
- Elo **estimé** (étiqueté « estimation ») à partir des résultats contre des niveaux mesurés et de la cote d'exercices.

### Couche 3 — Rédaction pédagogique
- **Mode A (par défaut, hors ligne)** : gabarits rédigés en français par type de fait (« Ton cavalier en f3 n'est plus défendu ; après … , l'adversaire gagne une pièce. »). Fiable, rapide, gratuit.
- **Mode B (facultatif)** : un grand modèle de langage (API Claude) reçoit **uniquement les faits calculés** (FEN, coups, évaluations, motifs détectés, profil) et doit les expliquer. Il sert au dialogue socratique libre et à « Comprendre mon erreur ». Garde-fous : il ne cite aucune évaluation absente des faits fournis ; toute variante qu'il propose est **revérifiée par chess.js et Stockfish** avant affichage.
- La clé d'API reste dans tes paramètres (stockage sécurisé sous Tauri ; jamais dans le code). Sans clé, l'entraîneur fonctionne en mode A.

### Méthode socratique (machine à états)
`question ouverte → indice 1 (zone) → indice 2 (pièce) → indice 3 (idée/motif) → solution expliquée → conséquences montrées → leçon à retenir → résultat noté dans le profil`
Les questions types (« Que menace ton adversaire ? », « As-tu vérifié les échecs, prises et menaces ? ») sont choisies selon les faits calculés de la position.

---

## Structure du dépôt (prévue en Phase 2)

```
chess-master-academy/
  docs/                    analyses, architecture, décisions, guide d'utilisation
  src/
    core/                  règles (adaptateur chess.js), PGN, FEN, types partagés
    board/                 BoardView (adaptateur Chessground)
    engine/                EngineService, worker Stockfish, niveaux
    coach/                 faits, détecteurs de motifs, classification, gabarits, LLM facultatif
    learning/              leçons, parcours, ouvertures, finales, exercices (données + lecteur)
    profile/               profil, compétences, répétition espacée, statistiques
    storage/               Dexie, schéma versionné, sauvegarde/restauration
    integrations/          gameSource (pgn-file, chesscom, lichess…)
    ui/                    sections, composants, thèmes, i18n
  tests/                   unitaires + e2e
```

Chaque dossier expose une interface publique ; aucune section de l'interface n'appelle directement Stockfish, Chessground ou une API externe.
