# Synchronisation entre appareils (Google Drive)

> Facultative. Sans elle, tout fonctionne ; la sauvegarde manuelle (*Paramètres › Mes données*) reste disponible.

## Comment ça marche

- Chaque appareil dépose ta progression dans **un dossier privé et caché de ton Google Drive**, réservé à l’application (« appDataFolder »), et récupère celle des autres.
- La seule permission demandée est `drive.appdata` (classée « non sensible » par Google) : l’application **ne voit aucun autre fichier** de ton Drive.
- La connexion se fait dans la **fenêtre officielle de Google** : l’application ne voit jamais ton mot de passe. Il n’y a **aucun serveur** intermédiaire : l’appareil parle directement à Google.
- **Quand ?** À l’ouverture de l’application, puis quelques secondes après chaque changement, et sur « Synchroniser maintenant ».
- **Autorisation d’environ une heure** : c’est la règle de Google pour une application sans serveur. Ensuite un bandeau « Synchronisation en pause — Reprendre » apparaît ; un toucher suffit (pas de nouvel accord, pas de mot de passe si tu es déjà connecté à Google).
- **Hors ligne** : rien n’est perdu, les changements partent à la synchronisation suivante.

### Fusion : rien ne se perd

| Donnée | Règle de fusion |
|---|---|
| Exercices, essais de leçons, révisions, examens | **Union** : chaque essai est gardé une seule fois (même s’il a été fait hors ligne sur les deux appareils). |
| Leçons | Une leçon terminée sur un appareil reste terminée ; sinon la plus récente. |
| Ouvertures et positions à retravailler | La révision la plus récente / la plus avancée. |
| Parties | Union ; la version analysée l’emporte. Une partie **supprimée** ne réapparaît pas (sauf si elle a été analysée après la suppression sur l’autre appareil). |
| Profil | L’évaluation la plus récente fait foi ; la cote d’exercices reprend celle du dernier exercice résolu ; le nombre d’exercices compte ceux des deux appareils. |
| Chess.com | Le pseudo lié suit ; un « Délier » sur un appareil s’applique aux autres. |
| Préférences d’affichage | **Non synchronisées** (propres à chaque appareil). |

Un fichier sur Drive illisible ou venant d’une version plus récente de l’application n’est **jamais écrasé** : un message demande de mettre l’application à jour.

### Arrêter

- *Délier cet appareil* : il ne se synchronise plus ; la copie sur Drive reste pour les autres appareils.
- *Supprimer la copie sur Drive* : supprime le fichier et délie l’appareil (un autre appareil encore lié la recréera).
- *Tout effacer* délie aussi l’appareil (sans toucher à Drive ni aux autres appareils).
- Retrait de l’accès côté Google : [myaccount.google.com/connections](https://myaccount.google.com/connections).

## Mise en place (une seule fois, par le propriétaire du compte)

L’application a besoin d’un **identifiant client OAuth** Google. Il est public par nature (il identifie l’application et n’ouvre aucun accès sans ton accord dans la fenêtre de Google). **Le « code secret du client » n’est pas nécessaire : ne le communique à personne.**

1. Ouvre [console.cloud.google.com](https://console.cloud.google.com) avec ton compte Google et **crée un projet** (ex. « Chess Master Academy »).
2. **APIs et services › Bibliothèque** : cherche **Google Drive API** › **Activer**.
3. **Google Auth Platform** (ou *APIs et services › Écran de consentement OAuth*) › **Commencer** :
   - Nom de l’application : `Chess Master Academy` ; adresse e-mail d’assistance : la tienne ;
   - Audience : **Externe** ;
   - Coordonnées : ton adresse ; accepte les conditions › **Créer**.
4. **Audience** : laisse le statut **« En test »** et ajoute ton adresse Gmail dans **Utilisateurs test**. (Usage personnel : pas de validation par Google nécessaire ; jusqu’à 100 utilisateurs test.)
5. **Accès aux données** › *Ajouter ou supprimer des champs d’application* : coche `.../auth/drive.appdata` › **Mettre à jour** › **Enregistrer**.
6. **Clients** › **Créer un client** :
   - Type : **Application Web** ; nom : `Chess Master Academy` ;
   - **Origines JavaScript autorisées** : `https://boisverdo.github.io`, `http://localhost:5173`, `http://localhost:4173` ;
   - **URI de redirection** : aucune › **Créer**.
7. Copie l’**ID client** (il se termine par `.apps.googleusercontent.com`) et place-le dans `src/integrations/google/config.ts` (`CLIENT_ID`), puis publie.

À la première connexion, Google affiche « Google n’a pas validé cette application » : c’est normal pour une application personnelle en test. Clique sur **Continuer**, puis coche l’accès au dossier de l’application.

## Tests

- `src/sync/sync.test.ts` : fusion (union, commutativité, idempotence, suppressions, profil), base locale (identifiants stables, numéros conservés), deux appareils avec un Drive simulé (hors ligne, autorisation expirée, jeton refusé, fichier plus récent jamais écrasé, fichier supprimé recréé, refus, déliaison, « Tout effacer »).
- `tests/e2e/sync.spec.ts` : deux navigateurs isolés avec la connexion Google et l’API Drive simulées (aussi sous la politique de sécurité de la version de production).
- Le vrai service Google se vérifie avec ton compte, une fois l’identifiant configuré.
