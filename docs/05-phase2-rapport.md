# 05 — Rapport de la Phase 2 : prototype fonctionnel

> 19 novembre 2026 · Version 0.2.0

## Résultat

Un échiquier complet et vérifié, jouable de bout en bout à deux joueurs sur le même appareil, dans une coquille d'application à 12 sections (responsive, thème clair et sombre).

| Exigence de la Phase 2 | État | Preuve |
|---|---|---|
| Interface (12 sections, navigation, responsive) | ✅ | e2e « 12 sections », e2e mobile (sans défilement horizontal) |
| Échiquier intégré (souris, toucher, coups légaux, derniers coups, flèches) | ✅ | e2e clic-clic, glisser-déposer, toucher |
| Règles complètes, aucun coup illégal | ✅ | 17 tests perft (6 positions de référence) + 45 tests de règles |
| Partie complète | ✅ | e2e « mat du berger » joué à la souris, échiquier bloqué ensuite |
| Coups spéciaux | ✅ | roque (10 cas dont interdictions), prise en passant (dont clouage horizontal), promotion ×4 + sous-promotion + annulation |
| Fins de partie | ✅ | mat, pat, matériel insuffisant, triple répétition, 50 coups, priorité du mat, abandon, nulle par accord |
| Historique, navigation, notation algébrique | ✅ | feuille de partie cliquable, ⏮ ◀ ▶ ⏭, clavier, « Reprendre d'ici », annulation |
| Import / export PGN | ✅ | 13 tests (multi-parties, erreurs claires, FEN, variantes refusées, aller-retour) |
| Sauvegarde entre les sessions | ✅ (partie en cours) | e2e rechargement de page |

## Tests

| Suite | Commande | Résultat |
|---|---|---|
| Unitaires (Vitest) | `npm test` | **83 / 83** |
| Bout en bout (Playwright, ordinateur + téléphone) | `npm run test:e2e` | **14 / 14**, stables sur 4 répétitions, aucune erreur dans la console |
| Typage strict | `npm run typecheck` | 0 erreur |
| Compilation de production | `npm run build` | OK (≈ 114 Ko compressé) |
| Audit des dépendances | `npm audit` | 0 vulnérabilité |

## Problèmes rencontrés et corrigés

1. **Défilement intempestif** : la feuille de partie faisait défiler toute la page après chaque coup (vu lors de l'essai visuel). Corrigé : seule la liste défile.
2. **Deux boutons « Annuler le coup »** (panneau et fenêtre de promotion) : ambigu pour un lecteur d'écran et source d'un test instable. Le bouton de la fenêtre s'appelle maintenant « Annuler la promotion ».
3. **Avertissement React** sur l'élément `<piece>` de Chessground dans la fenêtre de promotion. Corrigé (élément créé hors de React) ; les tests e2e échouent désormais à la moindre erreur de console.
4. Deux erreurs dans mes propres tests (position de test mal construite, lecture de l'écran trop tôt), corrigées.

## Choix à connaître

- **Triple répétition et règle des 50 coups** terminent la partie automatiquement, comme sur les plateformes en ligne. En compétition FIDE, ces nulles doivent être *réclamées* ; la leçon sur les règles l'expliquera.
- **Notation** : affichage en figurines par défaut (♘f3), française (Cf3) ou anglaise (Nf3) dans les Paramètres. Le PGN reste en notation anglaise, standard international lisible par tous les logiciels.
- **Stockage** : la partie en cours et les préférences sont dans `localStorage` (protégé contre les erreurs). La base IndexedDB arrive en Phase 3 avec le profil.
- **Licence** : GPL-3.0-or-later (fichier `LICENSE`), validée par toi.
- **Pièces** : jeu « cburnett » fourni avec Chessground (licence libre compatible). Couleurs de l'échiquier, logo et thème : originaux.

## Limites connues (prévues plus tard)

- Pas encore d'adversaire ni d'analyse (Phase 4).
- L'import de plusieurs parties charge seulement la première ; la bibliothèque de parties arrive avec l'analyse.
- Dessin de flèches : à la souris (clic droit) seulement ; au toucher, prévu avec l'entraîneur.
- Pas encore d'installation hors ligne (PWA) ni d'application Windows (Phase 7).

## Fichiers créés

```
package.json, package-lock.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, LICENSE
public/favicon.svg
src/main.tsx, src/App.tsx
src/core/      game.ts, pgn.ts, notation.ts + perft/rules/pgn/notation.test.ts
src/board/     BoardView.tsx, board.css
src/sections/  Pages.tsx, board/BoardPage.tsx, MoveList.tsx, PromotionPicker.tsx, gameText.ts(+test), savedGame.ts
src/ui/        theme.css, settings.tsx, sections.ts, Modal.tsx, storage.ts
tests/e2e/     helpers.ts, board.spec.ts, mobile.spec.ts
```

## Vérification avant la Phase 3 (règle de gestion du projet)

1. Phase 2 terminée : ✅ toutes les exigences ci-dessus sont vérifiées par des tests.
2. Fonctionnalités testées : ✅ 83 tests unitaires + 14 scénarios e2e.
3. Erreurs connues corrigées : ✅ (4 problèmes ci-dessus).
4. Données sauvegardées : ✅ partie et préférences persistantes ; dépôt Git à jour.
5. Architecture prête : ✅ `core/` indépendant de l'interface, `BoardView` remplaçable, sections déjà routées.
6. Solution de repli : ✅ aucune dépendance réseau ; tout fonctionne hors ligne.
