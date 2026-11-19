# 02 — Connexion à Chess.com et à Google : possibilités réelles

> Vérifié le 19 novembre 2026 à partir des sources officielles listées en bas.
> **Statut (mise à jour Phase 5, 19/11/2026) : intégration codée et testée** — voir [08-phase5-rapport.md](08-phase5-rapport.md).

## Conclusions principales

1. **« Se connecter à Chess.com avec Google » depuis notre application n'existe pas.**
   Google est un moyen de se connecter *sur le site de Chess.com*. Chess.com ne fournit aucun mécanisme permettant à une application tierce d'utiliser ton compte Google pour accéder à ton compte Chess.com. Notre application ne verra donc **jamais** ton mot de passe Google et n'en a pas besoin.

2. **Chess.com propose un OAuth 2.0 / OpenID Connect, mais seulement sur candidature.**
   - Chess.com invite les développeurs à demander l'accès (« Chess.com login » ou échiquier connecté) via un formulaire, après avoir étudié l'API publique.
   - Les critères d'approbation, la liste des données accessibles (scopes) et l'admissibilité d'un projet personnel **ne sont pas publiés**.
   - La documentation technique (points de terminaison sous `oauth.chess.com`) se trouve sur une page Notion, pas sur un site développeur officiel : à reconfirmer si l'accès est accordé.
   - Si tu obtiens cet accès, tu pourrais te connecter via Chess.com, et Chess.com te laisserait choisir Google *sur sa propre page*. C'est la seule forme légitime de « connexion avec Google ».

3. **L'API publique (PubAPI) suffit pour tous les objectifs du Module 12, sans aucune connexion.**

| Besoin du Module 12 | PubAPI | Point de terminaison |
|---|---|---|
| Retrouver mon profil | ✅ | `GET https://api.chess.com/pub/player/{pseudo}` |
| Consulter mes statistiques | ✅ (données publiques) | `GET …/player/{pseudo}/stats` |
| Lister mes archives | ✅ | `GET …/player/{pseudo}/games/archives` |
| Récupérer mes parties d'un mois | ✅ JSON ou PGN | `GET …/games/{AAAA}/{MM}` · `…/games/{AAAA}/{MM}/pgn` |
| Importer, analyser, détecter mes erreurs | ✅ côté CMA | traitement local après import |
| Agir sur mon compte (jouer, écrire) | ❌ volontairement impossible | l'API est en lecture seule |

## Règles imposées par Chess.com (PubAPI)

- **Lecture seule**, données publiques uniquement (ce qu'un visiteur non connecté peut voir).
- **En-tête User-Agent obligatoire avec un contact** (courriel ou pseudo Chess.com) depuis le 20 juin 2023. Sinon : `403 Forbidden`.
  → Le contact sera **saisi par toi dans les Paramètres**, jamais ajouté automatiquement.
- **Requêtes en série** : illimitées. Requêtes parallèles : risque de `429 Too Many Requests` ; activité anormale : blocage.
  → Notre client fera une seule requête à la fois, avec reprise progressive après une erreur 429.
- **Cache** : utiliser `ETag` / `If-None-Match` et `Last-Modified` (`304 Not Modified`). Données rafraîchies au plus toutes les 12 à 24 h.
- **Éléments de marque** (pièces, couleurs, sons, glyphes de classification) : interdits de réutilisation.
- Questions juridiques : legal@chess.com.

## Conception retenue (Phase 5)

```
Paramètres → « Lier mon pseudo Chess.com »
  1. Écran de consentement : quelles données, pourquoi, stockées où (local), comment les supprimer.
  2. Saisie du pseudo et du contact User-Agent.
  3. Vérification : GET /player/{pseudo} → affichage du profil trouvé → « C'est bien moi ».
  4. Import : un mois à la fois, séquentiel, avec cache ETag, barre de progression, annulable.
  5. Les parties importées deviennent des parties CMA ordinaires (PGN) → analyse Stockfish locale.
```

- **Module isolé** (`integrations/chesscom`) derrière une interface `GameSource`. Les autres sources ont la même interface : fichier PGN, PGN collé, export Lichess.
- **Désactivable** : si l'API ne répond pas, seul l'import automatique est indisponible ; tout le reste fonctionne.
- **Solution de repli toujours disponible** : téléchargement du PGN depuis l'historique de Chess.com (fonction officielle d'exportation), puis import du fichier dans CMA.
- **OAuth** : candidature facultative, plus tard. Aucune ligne de code OAuth ne sera écrite sans documentation officielle reçue.

## Ce qui doit encore être testé (Phase 5)

- [x] Requêtes réelles depuis le navigateur (compte public de référence) : profil, statistiques, archives, un mois complet (44 parties lues sans erreur).
- [ ] Requête avec **ton** pseudo : à faire par toi dans l'application (l'écran demande ton consentement).
- [x] 404 (pseudo inconnu), 429 (reprise avec Retry-After), service injoignable : testés (API simulée).
- [x] Chess960 et autres variantes : ignorées et comptées.
- [x] **User-Agent** : un navigateur n'autorise pas à le modifier. L'API accepte les requêtes du navigateur (vérifié). Les coordonnées de contact ne peuvent donc pas y figurer ; aucune donnée personnelle n'est ajoutée aux requêtes.
- [x] **ETag** : l'en-tête n'est pas lisible depuis une page web (règles CORS). Le navigateur gère son propre cache HTTP, et les mois terminés sont conservés localement : ils ne sont jamais redemandés.

## Sources

- [Chess.com — Published-Data API](https://www.chess.com/news/view/published-data-api)
- [Chess.com — Breaking Change: User-Agent Contact Info Required](https://www.chess.com/news/view/breaking-change-user-agent-contact-info-required)
- [Chess.com — OAuth / Login / Connected Board Application](https://www.chess.com/blog/CHESScom/chess-com-oauth-login-connected-board-application)
- [Getting started with Chess.com OAuth 2.0 Server (Notion)](https://chesscom.notion.site/Getting-started-with-Chess-com-OAuth-2-0-Server-5958e57c8c934a3aa7abda2d670969e8)
