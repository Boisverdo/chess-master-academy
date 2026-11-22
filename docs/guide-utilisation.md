# Guide d’utilisation — Chess Master Academy

> Version 1.0 · Ce guide s’adresse au joueur. La documentation technique est dans [documentation-technique.md](documentation-technique.md).

## 1. Installer l’application sur Windows

Prérequis : Node.js 20 ou plus récent (une seule fois).

1. Ouvre PowerShell dans le dossier du projet, puis lance :
   ```powershell
   npm install
   ```
2. Démarre l’application :
   ```powershell
   npm run app
   ```
3. Ouvre **http://localhost:4173** dans **Microsoft Edge** (ou Chrome).
4. Dans la barre d’adresse, clique sur l’icône **« Installer l’application »** (ou menu ⋯ › Applications › Installer Chess Master Academy).

L’application apparaît alors dans le menu Démarrer et sur le bureau, dans sa propre fenêtre. **Elle fonctionne ensuite hors ligne**, même quand `npm run app` n’est pas lancé. Pour recevoir une nouvelle version, relance `npm run app` une fois et rouvre l’application.

> **Important — tes données sont liées à l’adresse.** L’application installée (port 4173) et la version de développement (port 5173) ont des données séparées. Pour transférer ta progression : *Paramètres › Télécharger une sauvegarde* d’un côté, *Restaurer une sauvegarde* de l’autre.

## 2. Installer l’application sur un cellulaire

L’application est publiée en HTTPS à l’adresse **https://boisverdo.github.io/chess-master-academy/** (elle peut aussi être installée ainsi sur un ordinateur, sans `npm`).

- **Android (Chrome)** : ouvre l’adresse, puis menu **⋮** › **Installer l’application** (ou **Ajouter à l’écran d’accueil**).
- **iPhone / iPad (Safari obligatoirement)** : ouvre l’adresse, bouton **Partager** › **Sur l’écran d’accueil**.

Ouvre-la une première fois avec une connexion : ensuite elle fonctionne **hors ligne** (moteur et exercices compris). Les mises à jour arrivent automatiquement à la prochaine ouverture avec connexion.

> **Chaque appareil a ses propres données.** Pour les partager automatiquement : *Paramètres › Synchronisation entre appareils* (par ton Google Drive, voir le [guide de synchronisation](guide-synchronisation.md)). Sinon : *Télécharger une sauvegarde* sur un appareil, puis *Restaurer une sauvegarde* sur l’autre.

## 3. Premiers pas

1. **Mon apprentissage → Commencer l’évaluation** (≈ 10 min) : questionnaire, règles, 6 exercices, positions, partie commentée. Tu obtiens un niveau de départ et, si possible, une **fourchette indicative** (jamais un classement officiel).
2. Suis la **séance du jour** : elle combine tes révisions, ta prochaine leçon et ton point faible.

## 4. Les sections

| Section | Ce que tu y fais |
|---|---|
| **Accueil** | Ton tableau de bord : *Reprendre* (leçon commencée ou partie en cours sur l’échiquier), la séance du jour, le défi du jour, ta série de jours et les objectifs de la semaine. Au premier lancement : les premiers pas. |
| **Mon apprentissage** | Ton niveau, ta séance du jour, tes points à travailler. |
| **Leçons** | 32 leçons en 4 cours : règles, premiers principes, stratégie, finales. Chaque leçon explique, démontre, puis te fait pratiquer. Certaines finales se jouent contre l’ordinateur. |
| **Échiquier interactif** | Partie à deux sur le même appareil, import/export PGN, « Analyser cette partie ». |
| **Exercices tactiques** | 3 365 exercices sur 17 thèmes. Avant les indices, une question pour te faire réfléchir ; puis 3 indices (motif, pièce, coup). Ta cote d’exercices évolue. Après l’exercice, la **solution expliquée** se rejoue coup par coup : flèches et cercles sur l’échiquier, une phrase de l’entraîneur par coup, lue à voix haute par la voix française de ton appareil (bouton « Voix »). |
| **Ouvertures** | 14 ouvertures : idées, plans, ligne principale expliquée coup par coup, variantes, pièges, erreurs typiques, entraînement espacé, et partie contre l’ordinateur à partir de l’ouverture. |
| **Jouer contre l’IA** | 6 niveaux, Blancs ou Noirs, avec ou sans pendule, commentaires de l’entraîneur, annulation et indice en partie d’entraînement. |
| **Entraînement ciblé** | Trois onglets. *Course contre la montre* : des exercices de plus en plus difficiles en 3 minutes, 5 minutes ou en *Survie* ; 3 erreurs arrêtent la série ; ton record est conservé (la cote d’exercices n’est pas modifiée). *Finales essentielles* : 12 finales à jouer contre l’ordinateur (mats de base, roi et pions, Lucena, Philidor, dame contre pion) ; une finale est « maîtrisée » quand tu la réussis sans coup conseillé. *Revue de mes erreurs* : reprends sans pendule les exercices manqués (ils quittent la liste dès que tu les résous du premier coup) et revois toutes les positions ratées dans tes parties analysées, filtrées par type d’erreur. |
| **Analyse des parties** | Chaque coup classé (théorie, meilleur, bon, imprécision, erreur, gaffe), précision, courbe, moments critiques, « Comprendre mon erreur », « Retente ta chance », PGN annoté. |
| **Chess.com et mes parties** | Facultatif : lie ton pseudo (avec ton accord), importe tes parties publiques, analyse-les en série. Option *Import automatique* (désactivée par défaut) : à l’ouverture de l’application, tes nouvelles parties sont importées (au plus toutes les 6 heures, seulement les mois récents) ; un bandeau t’indique combien, et l’analyse reste à lancer toi-même. |
| **Lichess et mes parties** | Facultatif : lie ton pseudo Lichess (avec ton accord, sans mot de passe ni connexion à ton compte), consulte tes cotes, importe tes 20 à 200 dernières parties publiques et analyse-les en série. Même option *Import automatique* que pour Chess.com (désactivée par défaut, 100 parties au plus par vérification). |
| **Mon entraîneur IA** | Tes habitudes (vues dans au moins 3 de tes 10 dernières parties), ton programme, tes positions à retravailler, le carnet de l’entraîneur. |
| **Ma progression** | Tableau de bord et graphiques, défi du jour, objectifs de la semaine, examens, badges de maîtrise, historique. |
| **Paramètres** | Notation (figurines, française, anglaise), coups légaux, coordonnées, thème clair/sombre, couleurs de l’échiquier (Ardoise, Bois, Vert, Contraste élevé), sons des coups (désactivés par défaut), vibration à chaque coup (sur les téléphones qui la proposent : Android, pas l’iPhone), sauvegarde et restauration. Sur téléphone tenu à l’horizontale, l’échiquier occupe la hauteur de l’écran et les coups s’affichent à côté. |

## 5. L’échiquier

- Déplace les pièces **à la souris** (glisser ou clic-clic) ou **au toucher**.
- **Clic droit** sur une case : cercle ; **clic droit glissé** : flèche.
- Clavier : **← →** pour naviguer dans la partie, **F** pour retourner l’échiquier.

## 6. Comprendre une analyse

- **Probabilité de gain** : traduction de l’évaluation de Stockfish en pourcentage (formule ouverte).
- Seuils : **imprécision** si tu perds au moins 5 points de probabilité de gain, **erreur** ≥ 10, **gaffe** ≥ 15.
- **Précision** : moyenne coup par coup ; ce n’est pas un classement.
- Toutes les explications viennent de **calculs réels** (variantes du moteur, pièces attaquées, matériel). L’application n’invente jamais une évaluation.

## 7. Tes données

- Tout est enregistré **sur ton appareil** (aucun serveur, aucun compte). Si tu actives la synchronisation, une copie va aussi dans un dossier privé de **ton** Google Drive.
- **Sauvegarde régulièrement** : *Paramètres › Télécharger une sauvegarde*. Vider les données du navigateur effacerait ta progression.
- *Tout effacer* supprime définitivement les données de cet appareil.

## 8. Questions fréquentes

**Le moteur ne démarre pas.** Un message s’affiche ; les leçons, exercices et ouvertures restent disponibles. Recharge la page ; si le problème persiste, relance `npm run app`.

**Chess.com ne répond pas.** L’application continue de fonctionner ; tu peux aussi télécharger tes parties en PGN depuis Chess.com et les importer dans *Analyse des parties*.

**Les niveaux de l’ordinateur ont-ils un Elo ?** Non : leur ordre de force est vérifié par tournoi automatique, mais aucun Elo ne leur est attribué (ce serait une invention sans parties contre des humains).
