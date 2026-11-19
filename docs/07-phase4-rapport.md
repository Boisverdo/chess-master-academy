# 07 — Rapport de la Phase 4 : moteur, adversaire, analyse et entraîneur

> 19 novembre 2026 · Version 0.4.0

## Résultat

Stockfish 19 est intégré dans l'application (WebAssembly, hors ligne). Il sert d'adversaire à 6 niveaux, analyse les parties coup par coup, et alimente un entraîneur qui explique les erreurs à partir de faits calculés, détecte les habitudes et transforme les erreurs du joueur en exercices personnels.

| Exigence | État | Preuve |
|---|---|---|
| **Module 8** — Partie complète contre l'IA, 6 niveaux, Blancs/Noirs, avec ou sans pendule | ✅ | e2e « partie contre l'ordinateur » |
| Annulation et indice en partie d'entraînement, coups joués, notation, revue après la partie | ✅ | e2e (annulation, abandon, analyse) |
| Coups légaux et cohérents avec le niveau | ✅ | Coup du moteur revérifié par le noyau de règles ; tournoi de mesure (ci-dessous) |
| Commentaire après chaque coup ou en fin de partie | ✅ | Commentaire calculé (moteur) en direct ; analyse complète en fin de partie |
| Pratiquer une ouverture contre l'IA (reporté de la Phase 3) | ✅ | e2e « pratiquer une ouverture » |
| **Module 9** — Import PGN (fichier ou texte), revue sur l'échiquier, analyse de chaque coup | ✅ | e2e « analyse d'une partie importée » |
| Imprécisions, erreurs, gaffes, occasions manquées, courbe d'évaluation | ✅ | Classification par perte de probabilité de gain |
| Explication pédagogique fondée sur le moteur | ✅ | Ex. réel : « Ce coup permet à l'adversaire de forcer le mat en 2 : ♗xf7+ ♚e7 ♘d5#. Le coup recommandé était dxe5, qui prend le cavalier. » |
| « Comprendre mon erreur » | ✅ | Menace adverse (calculée), suite après le coup, meilleure suite, leçon, « Retente ta chance » |
| **Module 10** A — Entraînement socratique | ✅ | Questions avant la réponse (menace, coups forcés), en analyse et sur les positions à retravailler |
| B — Détection des mauvaises habitudes | ✅ (partiel) | 12 types mesurables ; voir limites |
| C — Programme personnalisé | ✅ | Habitude récurrente → exercices ou leçon ciblés ; positions à retravailler en priorité |
| D — Moments critiques | ✅ | 3 au plus par partie : joué / possible / pourquoi / leçon |
| E — Suivi pédagogique | ✅ | Carnet de l'entraîneur, habitudes datées, révisions espacées des positions |

## Choix techniques

- **Moteur** : `stockfish` 19.0.1 (GPL-3.0), version « lite » mono-thread (1,8 Mo), recommandée par son auteur : fonctionne partout sans en-têtes serveur particuliers. Copié de `node_modules` vers `public/engine` à chaque `dev`, `build` et test e2e (`scripts/copy-engine.mjs`).
- **Service UCI** indépendant du transport (Web Worker dans le navigateur, module Node pour les tests) : les tests unitaires font calculer le **vrai** Stockfish.
- **Classification** : perte de probabilité de gain du joueur (formule publiée par Lichess) ; imprécision ≥ 5, erreur ≥ 10, gaffe ≥ 15 points — équivalents des seuils de Lichess. « Théorie » si la position appartient à la bibliothèque d'ouvertures.
- **Précision** : formule ouverte de Lichess, moyenne par coup, affichée comme « précision », jamais comme un classement.
- **Positions finales** (mat, pat, répétition…) : décidées par les règles, pas par le moteur.
- **Analyse** : profondeur 14, plafonnée à 1,5 s par position. Une partie courte s'analyse en quelques secondes.

## Mesure des niveaux (tournoi automatique, `docs/mesures-niveaux.json`)

| Rencontre | Score du niveau supérieur |
|---|---|
| Débutant contre coups aléatoires | 9,5 / 10 |
| Facile contre Débutant | 12 / 12 |
| Intermédiaire contre Facile | 12 / 12 |
| Difficile contre Intermédiaire | 11 / 12 |
| Expert contre Difficile | 5,5 / 8 |
| Très avancé contre Expert | 7 / 8 |

L'ordre de force est **vérifié**. Aucune cote Elo n'est attribuée aux niveaux : sans parties contre des humains, ce serait une invention. Les écarts entre les niveaux 1 à 3 sont importants ; ils pourront être affinés avec ton retour.

## L'entraîneur : comment il explique (sans rien inventer)

Pour chaque coup, l'explication est assemblée à partir de faits calculés :
1. **Ce que permet le coup** : mat forcé (variante du moteur), pièce prise par la réponse adverse, fourchette/attaque double (pièces réellement attaquées), pièce laissée sans protection, gain de matériel le long de la variante, ou dégradation de la position sans perte immédiate.
2. **Pourquoi le coup recommandé est meilleur** : mat, prise, échec, double attaque, gain de matériel le long de la meilleure variante.
3. **Leçon à retenir** : liée au motif (routine échecs-prises-menaces, exercices de fourchettes, valeur des pièces…).

Les coups de l'adversaire sont décrits à la troisième personne (« la dame des Noirs »), ceux du joueur à la deuxième (« ta dame »).

**Habitudes** (12 types) : pièces laissées sans protection, menaces de mat non vues, fourchettes et attaques doubles subies, échanges défavorables, erreurs adverses non exploitées, gains manqués, suites forcées mal calculées, erreurs d'ouverture, difficultés en finale, sortie prématurée de la dame, développement lent. **Habitude** = vue dans au moins 3 des 10 dernières parties analysées ; sinon « ponctuel ».

## Tests

| Suite | Résultat |
|---|---|
| Unitaires (Vitest), dont 20 tests avec le vrai Stockfish | **301 / 301** |
| Bout en bout (Playwright) | **24 / 24**, stables sur 2 répétitions, aucune erreur de console |
| Tournoi de mesure des niveaux (`MEASURE=1`) | Réussi (ordre vérifié) |
| Typage strict | 0 erreur |
| Audit des dépendances | 0 vulnérabilité |

## Problèmes rencontrés et corrigés

1. Explication trompeuse quand un coup perd un seul pion (« le matériel ne change pas ») : corrigée.
2. « Ta probabilité de gain » employé pour les coups de l'adversaire : point de vue corrigé.
3. Barre d'évaluation de hauteur fixe, débordant sur téléphone : elle suit maintenant l'échiquier.
4. Échiquier de la partie trop grand avec les pendules : taille adaptée.
5. « Annuler mon coup » actif avant tout coup du joueur (partie après une ouverture) : logique réécrite.
6. Course possible entre la chute du drapeau et un coup de l'ordinateur en calcul : protégée.
7. Résultat d'une position à retravailler masqué par l'actualisation des données : il reste affiché jusqu'à « Position suivante ».
8. Précision affichée avec un point décimal : format français.
9. Un test e2e fragile (exercice à plusieurs thèmes) : corrigé.

## Limites connues (honnêtes)

- **Pas encore de grand modèle de langage** : l'entraîneur s'exprime avec des phrases construites à partir des calculs. C'est fiable et gratuit, mais on ne peut pas encore lui poser une question **libre**. Ce mode facultatif (API Claude, ta propre clé, réponses limitées aux faits calculés) demande ton accord, car il implique un coût et un envoi de positions à un service externe.
- **Habitudes non mesurées** : « attaques prématurées » et « mauvais échanges positionnels » demandent un jugement stratégique qu'on ne sait pas encore calculer de façon fiable ; elles ne sont pas affichées plutôt que devinées.
- La partie en cours contre l'ordinateur n'est pas conservée si l'on quitte la page (elle l'est dès qu'elle est terminée).
- Exercices tactiques : un mauvais coup n'est pas encore analysé par le moteur (question socratique seulement).
- Le moteur « lite » est plus faible que Stockfish complet (largement plus fort que tout humain, mais l'analyse est un peu moins précise). Stockfish natif est prévu dans l'application Windows (Phase 7).
- Le fichier principal pèse 202 Ko compressé ; découpage prévu en Phase 7.

## Vérification avant la Phase 5

1. Phase 4 terminée : ✅ (hors limites listées).
2. Fonctionnalités testées : ✅
3. Erreurs connues corrigées : ✅
4. Données sauvegardées : ✅ base v2 (parties, positions à retravailler), sauvegarde/restauration incluses ; Git à jour.
5. Architecture prête pour Chess.com : ✅ les parties importées passent par le même enregistrement (`source: 'chesscom'` prévu) et la même analyse.
6. Solution de repli : ✅ si le moteur ne démarre pas, un message clair s'affiche ; leçons, exercices et ouvertures restent disponibles.
