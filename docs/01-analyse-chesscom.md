# 01 — Analyse fonctionnelle de Chess.com (référence d'inspiration)

> Phase 1 — Recherche et planification · 19 novembre 2026
> Chess.com sert de **référence fonctionnelle et pédagogique**, jamais de source de code, de contenu, de graphisme ou d'identité visuelle.
> Les descriptions ci-dessous viennent de la connaissance publique du produit ; elles décrivent des *concepts*, pas des implémentations.

## Ce qui ne sera jamais repris

| Élément | Raison |
|---|---|
| Code, contenus de leçons, vidéos, textes, puzzles maison | Droit d'auteur |
| Pièces, palettes d'échiquier, sons, **glyphes de classification des coups** (icônes « Brillant », « Gaffe »…) | Chess.com les désigne explicitement comme éléments de marque à respecter (doc PubAPI) |
| Noms des bots, personnages, mascottes, nom « Game Review », « Puzzle Rush » | Marques / identité |
| Formule propriétaire de « précision » (CAPS) | Non publiée → nous utilisons une formule ouverte et documentée |

---

## Grille d'analyse

Pour chaque fonctionnalité : **(1)** fonctionnement chez Chess.com · **(2)** intérêt pour l'apprenant · **(3)** intégration dans CHESS MASTER ACADEMY (CMA) · **(4)** améliorations · **(5)** apport de l'IA.

### 1. Interface et navigation
1. Barre latérale (Jouer, Puzzles, Apprendre, Regarder, Communauté…), accueil orienté « jouer maintenant ».
2. Accès rapide à tout, mais l'accueil pousse surtout à jouer, pas à progresser.
3. Barre latérale à 12 sections (Module 15) ; accueil = **« Ma séance du jour »** proposée par l'entraîneur.
4. Accueil pédagogique : ce que je dois travailler aujourd'hui et pourquoi.
5. L'entraîneur compose la séance (révision + nouveauté + partie) à partir du profil.

### 2. Échiquier interactif
1. Glisser-déposer / clic-clic, cases surlignées, derniers coups, flèches (clic droit), coups légaux, prémoves, thèmes.
2. Standard du marché : toute friction ici ruine l'expérience.
3. **Chessground** (moteur d'échiquier de Lichess) : glisser, toucher, flèches, cercles, animation, coups légaux — voir 03-architecture.
4. Mode « réflexion » : l'entraîneur peut dessiner ses propres flèches pour illustrer une menace ; bouton « Que menace l'adversaire ? » qui affiche les menaces calculées.
5. Annotations générées depuis l'analyse réelle (cases faibles, pièces non défendues).

### 3. Leçons et parcours d'apprentissage
1. Leçons vidéo + positions interactives, classées par niveau ; parcours guidés.
2. Structure claire, mais parcours peu adaptatifs : tout le monde suit le même chemin.
3. Leçons maison (texte + démonstrations animées + exercices) stockées dans l'application, format de données versionné.
4. **Maîtrise obligatoire** : une notion n'est validée qu'après réussite d'exercices ; révision espacée des notions fragiles.
5. Le parcours se réordonne selon les faiblesses détectées dans les parties.

### 4. Puzzles / exercices tactiques
1. Puzzles classés avec cote, mode chronométré, mode combat, puzzle du jour, filtres par thème (abonnement).
2. Excellent pour la reconnaissance de motifs ; mais réponse binaire, peu d'explication.
3. Base **Lichess Puzzles (CC0, plusieurs millions de positions étiquetées par thème)** + cote d'exercices interne.
4. **Indices progressifs** (zone → pièce → idée → coup), explication du motif, montrer la suite et la réfutation de la mauvaise réponse.
5. Sélection pondérée par les erreurs du joueur ; dialogue socratique avant la solution.

### 5. Ouvertures
1. Explorateur (base maîtres / base joueurs), leçons d'ouvertures, entraînements de lignes.
2. Utile mais pousse à la mémorisation.
3. Bibliothèque des 14 ouvertures du cahier des charges, arborescence de coups + **idées, plans, pièges, erreurs typiques** rédigées.
4. Pour chaque coup : « pourquoi ce coup ? » ; répétition espacée des lignes ; détection des ouvertures réellement jouées dans les parties du joueur.
5. L'entraîneur signale : « dans tes 5 dernières Italiennes, tu sors la dame trop tôt au coup 4 ».

### 6. Adversaires IA (bots)
1. Nombreux bots à personnalités et niveaux, indices et annulation possibles.
2. Rendre le jeu non intimidant.
3. Stockfish avec niveaux calibrés (6 niveaux du Module 8), sans personnages de marque.
4. **Mode entraînement** : annulation, indice, « vérification de sécurité » avant validation (le coup laisse-t-il une pièce en prise ?).
5. Commentaire après chaque coup ou en fin de partie, au choix.

### 7. Analyse de partie
1. Revue de partie : classification de chaque coup, précision, moments clés, rejouer la meilleure ligne, explications courtes.
2. La fonctionnalité la plus formatrice ; mais explications génériques.
3. Stockfish local, classification par **perte de probabilité de gain** (formule ouverte), import PGN.
4. **« Comprendre mon erreur »** : question libre sur n'importe quel coup ; mode « retente ta chance » sur les moments critiques avant de voir la réponse.
5. Explications en français fondées uniquement sur les chiffres réels du moteur et sur des faits calculés (pièce en prise, fourchette possible…).

### 8. Statistiques et suivi
1. Courbes de cote, statistiques par cadence, « Insights » (abonnement) : précision par phase, ouvertures, etc.
2. Motivant mais descriptif, rarement prescriptif.
3. Tableau de bord du Module 13, Elo **estimé et étiqueté comme tel**.
4. Chaque statistique débouche sur une action (« faiblesse en finales de tours → programme de 5 jours »).
5. Distinction **erreur ponctuelle vs habitude récurrente** (fréquence sur N parties).

### 9. Classements, défis, motivation
1. Cotes Elo/Glicko, séries, badges, trophées, puzzle du jour.
2. Motivation et régularité.
3. Défis quotidiens, objectifs hebdomadaires, badges de maîtrise (Module 14).
4. Récompenses liées à la **maîtrise** (exactitude, compréhension), jamais au seul volume.
5. Objectifs hebdomadaires générés selon les faiblesses.

### 10. Tournois, multijoueur, contenus vidéo, communauté
Hors périmètre initial (pas demandé comme priorité). L'architecture prévoit un module « multijoueur / tournois » ajoutable plus tard.

---

## Synthèse : notre avantage concurrentiel

| Chess.com | CHESS MASTER ACADEMY |
|---|---|
| Donne la réponse et la classe | **Fait réfléchir d'abord** (questions socratiques, indices progressifs) |
| Parcours communs | **Parcours qui se réécrit** selon les faiblesses mesurées |
| Statistiques descriptives | **Statistiques prescriptives** (chaque faiblesse → plan d'entraînement) |
| Explications courtes et génériques | Explications contextualisées, fondées sur des faits calculés |
| Pas de mémoire pédagogique explicite | **Carnet de l'entraîneur** : historique des notions, erreurs, objectifs |
| Plusieurs fonctions avancées sous abonnement | Tout fonctionne en local, gratuitement, hors ligne |
