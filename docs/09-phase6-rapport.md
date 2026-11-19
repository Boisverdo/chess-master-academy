# 09 — Rapport de la Phase 6 : progression, défis, stratégie et finales

> 19 novembre 2026 · Version 0.6.0

## Résultat

| Exigence | État | Preuve |
|---|---|---|
| **Module 3** (suite) — coordination, tempo, échanges, espace, colonnes, cases faibles, avant-postes, initiative, prophylaxie, faiblesses | ✅ | Cours « Stratégie et jeu positionnel » (9 leçons) |
| **Module 6** — structures de pions, pions isolés, doublés, passés, chaînes, majorités, paire de fous, mauvais fou, domination, statique/dynamique, plans, échanges | ✅ | Même cours |
| **Module 7** — roi et pion, opposition, cases clés, règle du carré, tours, dames, fous, cavaliers, pièces mineures, conversion, défense | ✅ | Cours « Les finales » (7 leçons), dont 7 positions à jouer contre Stockfish |
| **Module 13** — niveau, Elo estimé (étiqueté), parties, % V/N/D, précision, progression tactique, ouvertures, finales, temps, exercices, faiblesses, objectifs, graphiques, historique | ✅ | Écran « Ma progression » (4 onglets) |
| **Module 14** — défi du jour, objectifs hebdomadaires, séries, examens, défis tactiques/ouvertures/finales, badges | ✅ | Badges de maîtrise uniquement (aucun point de volume) |

L'application compte désormais **32 leçons** dans 4 cours.

## Nouveauté : exercices joués contre le moteur

Dans les finales, tu joues la position contre Stockfish (pleine force) jusqu'à l'objectif : mater, promouvoir, ou tenir la nulle. L'arbitrage (mat, pat, promotion, matériel perdu, coups comptés) est une fonction pure testée. « Coup conseillé » montre le meilleur coup du moteur (l'exercice ne compte alors plus comme réussi du premier coup).

## Contenu vérifié par Stockfish

Nouveau test (`lessons.engine.test.ts`) : pour les cours de principes, stratégie et finales, Stockfish vérifie que chaque coup accepté est réellement bon (perte < 8 points de probabilité de gain), que chaque résultat annoncé (gain / nulle) est juste, et que chaque position à jouer est gagnable ou tenable.

**Erreurs de contenu détectées et corrigées grâce à ce contrôle :**
1. Exercice d'échange : un mat forcé existait (Tfe1+ puis Txd8#) — position refaite.
2. Avant-poste : Cd5 abandonnait la défense de e4 (…Cxe4) — pion f3 ajouté.
3. Position « bon fou » illégale (roi noir en échec sans le trait) — corrigée.
4. Dame contre pion de fou : avec le roi blanc en a1, c'est un gain (mat en 9), pas une nulle — roi blanc éloigné.

**Limite assumée :** Stockfish « lite », sans tables de finales, ne sait pas démontrer certaines nulles de forteresse (fou de la mauvaise couleur + pion de tour : il affiche ≈ +1,3). Cette nulle reste mentionnée comme **théorie**, mais la question posée porte sur un fait vérifiable (le fou contrôle-t-il la case de promotion ?), et non sur un résultat que le moteur ne confirme pas.

**Durcissement du noyau :** une position où le roi du camp qui n'a pas le trait est en échec est désormais refusée (elle faisait planter le moteur). Cela protège aussi l'import de PGN avec position de départ. Ce contrôle a révélé une position illégale dans un ancien test de roque, corrigé.

## Ma progression

- **Tableau de bord** : niveau (estimé seulement après 20 exercices, sinon celui de l'évaluation), fourchette Elo **indicative** tirée des exercices (« pas un classement officiel »), parties et pourcentages V/N/D, temps d'apprentissage **estimé** par séances, exercices réussis/manqués, leçons, ouvertures (« solides » = 3 révisions réussies d'affilée), finales, faiblesses (thèmes tactiques et habitudes récurrentes), cotes officielles Chess.com si liées.
- **Graphiques** (une série chacun, une teinte, trait de 2 px, infobulle au survol, tableau de données accessible) : cote d'exercices et précision dans les parties analysées.
- **Défis** : défi du jour (même exercice toute la journée, à ta cote, un essai), série de jours d'entraînement, objectifs de la semaine (dont un sur ton point faible).
- **Examens** : règles (10 questions, 80 %), tactique (10 exercices, 7/10), ouvertures (10 « coup suivant », distracteurs légaux, 80 %), finales (mat dame, Lucena, Philidor, du premier coup).
- **Badges de maîtrise** (25) : examens réussis, stratégie maîtrisée, répertoire solide, 10 parties analysées, +200 de cote, 7 jours d'affilée, maîtrise de chaque thème tactique (80 % sans indice sur 20 exercices). Un badge prévu, « Habitude corrigée », a été **retiré** faute de mesure fiable.
- **Historique** jour par jour : exercices, leçons, révisions, parties, examens.

## Tests

| Suite | Résultat |
|---|---|
| Unitaires (Vitest), dont la vérification du contenu par Stockfish | **420 / 420** |
| Bout en bout (Playwright) | **30 / 30**, stables sur 2 répétitions, aucune erreur de console |
| Typage strict, compilation | OK |
| Audit des dépendances | 0 vulnérabilité |

## Problèmes trouvés à la vérification et corrigés

1. Changement d'onglet par lien (« ?onglet=examens ») ignoré : l'onglet suit maintenant l'adresse.
2. Graphique vide sans titre ; date affichée deux fois avec un seul point.
3. Numéro de version écrit en dur (« 0.3 ») : lu désormais dans `package.json`.
4. La série de jours ignorait les parties jouées et analysées.
5. Un test d'arbitrage mal construit (position impossible).

## Limites

- Le temps d'apprentissage et la fourchette Elo sont des **estimations** (étiquetées).
- Le fichier principal atteint 223 Ko compressé : découpage par écran prévu en Phase 7.
- Pas de mat fou + cavalier ni de finales de tours avancées (Vancura, etc.) : extensions possibles.

## Vérification avant la Phase 7

1. Phase 6 terminée : ✅
2. Fonctionnalités testées : ✅
3. Erreurs connues corrigées : ✅
4. Données sauvegardées : ✅ (aucun changement de schéma ; Git à jour)
5. Architecture prête pour la livraison : ✅
6. Solution de repli : ✅ sans moteur, les leçons (hors positions à jouer), exercices et examens de règles/ouvertures restent disponibles.
