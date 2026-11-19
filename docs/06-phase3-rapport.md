# 06 — Rapport de la Phase 3 : apprentissage

> 19 novembre 2026 · Version 0.3.0

## Résultat

L'application devient une académie : évaluation initiale, leçons interactives, exercices tactiques, bibliothèque d'ouvertures et premier parcours personnalisé. Tout fonctionne hors ligne, sans moteur ni service externe.

| Exigence | État | Preuve |
|---|---|---|
| **Module 1** — Évaluation initiale (questionnaire, règles, exercices, positions, partie commentée) | ✅ | e2e « évaluation complète », 10 tests de calcul du niveau |
| Niveau de départ (4 niveaux) et estimation clairement étiquetée | ✅ | « Fourchette indicative… pas un classement Elo officiel » |
| Profil personnel de référence | ✅ | Base IndexedDB, profil conservé |
| **Module 2** — Les 11 notions de règles, démonstrations + exercices | ✅ | 12 leçons (pièces réparties en 2 leçons + valeur + prises) |
| **Module 3** — Premiers principes (« pourquoi », pas seulement « quoi ») | ✅ partiel | 4 leçons : routine échecs-prises-menaces, centre, développement, sécurité du roi. Les 10 autres notions → Phase 6 |
| **Module 4** — 14 ouvertures : coups, idées, plans, pièges, variantes, erreurs, mémorisation | ✅ | 14 fiches, chaque coup de la ligne principale expliqué, entraînement avec répétition espacée |
| Pratiquer les ouvertures contre l'IA | ⏳ | Phase 4 (moteur) |
| **Module 5** — Thèmes tactiques, indices progressifs, solution expliquée, résultat enregistré | ✅ | 3 365 exercices, 17 thèmes, 3 niveaux d'indice |

## Contenu livré

- **16 leçons** (12 règles + 4 principes), 108 étapes dont 51 exercices.
- **3 365 exercices tactiques** extraits de la base Lichess (domaine public CC0), de 400 à 2 400 de difficulté, 150 à 600 par thème : pièce en prise, fourchette, attaque double, clouage, enfilade, attaque et échec à la découverte, déviation, attraction, sacrifice, interférence, élimination du défenseur, combinaisons, mats en 1, 2, 3 et 4+.
- **14 ouvertures** : Italienne, Espagnole, Gambit du roi, Écossaise, Anglaise, Gambit dame, Londres ; Sicilienne, Française, Caro-Kann, Slave, Nimzo-indienne, Est-indienne, Scandinave.

## Garanties de qualité (aucun contenu non vérifié)

Chaque élément pédagogique est contrôlé automatiquement par le noyau de règles :

- toutes les positions sont valides, tous les coups de démonstration sont légaux ;
- chaque exercice de leçon a au moins une solution, chaque réponse « acceptée » atteint réellement l'objectif (mat, échec, roque, parade du mat…) et chaque réponse « refusée » échoue ;
- chaque solution des 3 365 exercices est rejouée ; les exercices de mat se terminent réellement par un mat, et un « mat en N » demande bien N coups ;
- chaque ligne, variante et piège des 14 ouvertures est légal ; les 3 pièges annoncés comme « mat » aboutissent au mat, les autres non ;
- les réponses de l'évaluation (pat, roque interdit, prise en passant, matériel insuffisant, mat) sont vérifiées par calcul.

Les retours aux erreurs sont **calculés**, jamais inventés : « Pat ! », « Échec, mais pas mat : l'adversaire peut répondre Rxg8 », « Après ce coup, l'adversaire fait mat avec Dxf7# », bilan matériel d'une combinaison, pièces attaquées par le coup clé.

## Entraîneur : ce qui est déjà personnalisé

- **Méthode socratique** : avant tout indice, une question propre au motif (« Existe-t-il une case d'où un cavalier attaquerait deux pièces ? »), puis indices progressifs (motif → pièce → coup).
- **Cote d'exercices** (estimation interne, de type Elo) mise à jour après chaque exercice ; un exercice réussi avec indices rapporte moins.
- **Faiblesses** : un thème n'est déclaré faible qu'après au moins 5 essais avec moins de 60 % de réussite sans indice — une erreur isolée n'est pas une habitude.
- **Séance du jour** : révisions d'ouvertures arrivées à échéance, prochaine leçon selon le niveau, leçons à revoir, thème tactique le plus faible.
- **Répétition espacée** (SM-2 simplifié) pour les ouvertures.

## Données

- IndexedDB (Dexie, Apache-2.0), schéma versionné : profil, progression des leçons, essais, révisions.
- **Sauvegarde / restauration / effacement** dans les Paramètres ; une sauvegarde invalide est refusée sans rien effacer (testé).

## Tests

| Suite | Résultat |
|---|---|
| Unitaires (Vitest) | **269 / 269** (dont la validation de tout le contenu) |
| Bout en bout (Playwright, ordinateur + téléphone) | **20 / 20**, stables sur 3 répétitions, aucune erreur de console |
| Typage strict | 0 erreur |
| Audit des dépendances | 0 vulnérabilité |

## Problèmes rencontrés et corrigés

1. Deux échiquiers d'illustration vides étaient refusés par le noyau de règles (pas de roi) : autorisés pour l'affichage seulement.
2. Course de minuterie possible entre deux exercices tactiques (mode développement de React) : garde ajoutée.
3. Double enregistrement possible d'une révision d'ouverture : garde ajoutée.
4. Explication maladroite (« fait échec et mat, attaque le roi ») : corrigée.
5. Échiquier des exercices trop grand sur un écran de portable : taille adaptée.
6. Plusieurs défauts de mes propres tests (lecture trop rapide, texte en majuscules) : corrigés.

## Limites connues

- La « surcharge » n'existe pas comme thème dans la base Lichess : elle sera traitée dans une leçon de tactique (Phase 6), pas comme série d'exercices.
- Sans évaluation initiale, la cote d'exercices n'est pas suivie (l'application invite à faire l'évaluation).
- Le fichier principal pèse 185 Ko compressé ; la base d'exercices (162 Ko compressé) n'est chargée qu'à l'ouverture des exercices. Un découpage plus fin est prévu en Phase 7.
- Explication d'un **mauvais** coup tactique : encore générique (question socratique). L'analyse précise arrive avec Stockfish en Phase 4.

## Vérification avant la Phase 4

1. Phase 3 terminée : ✅ (sauf points explicitement reportés ci-dessus).
2. Fonctionnalités testées : ✅
3. Erreurs connues corrigées : ✅
4. Données sauvegardées : ✅ IndexedDB + export ; dépôt Git à jour.
5. Architecture prête pour le moteur : ✅ `PlayableBoard`, `PuzzleRun` et le profil acceptent des évaluations Stockfish sans refonte.
6. Solution de repli : ✅ aucune dépendance réseau.
