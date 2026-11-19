# 08 — Rapport de la Phase 5 : Chess.com

> 19 novembre 2026 · Version 0.5.0

## Résultat

Tu peux lier ton pseudo Chess.com (avec ton consentement explicite), consulter tes cotes publiques, importer tes parties mois par mois, puis les faire analyser en série pour que l'entraîneur détecte tes erreurs récurrentes. La liaison est facultative, isolée et supprimable.

| Objectif du Module 12 | État | Comment |
|---|---|---|
| Retrouver mon profil | ✅ | Recherche par pseudo, confirmation « C'est bien moi » |
| Consulter mes statistiques accessibles | ✅ | Cotes actuelle et meilleure, bilan V/N/D par cadence (données publiques Chess.com) |
| Récupérer et importer mes parties | ✅ | Choix des mois, filtres de cadence, parties classées seulement ; doublons et variantes écartés |
| Analyser mes performances / détecter mes erreurs récurrentes | ✅ | Analyse groupée (5 à 50 parties) → habitudes, positions à retravailler, programme |
| Personnaliser l'entraînement à partir de l'historique | ✅ | Les parties importées alimentent « Mon entraîneur IA » et « Mon apprentissage » |
| Connexion via Google | ❌ volontairement | Chess.com ne la propose pas aux applications tierces (voir 02) ; inutile pour des données publiques |

## Exigences de sécurité — vérifiées

| Exigence | Mise en œuvre | Preuve |
|---|---|---|
| Jamais de mot de passe (Google ou Chess.com) | Aucun champ de mot de passe ; seul le pseudo public est demandé | Code de l'écran |
| Ne jamais contourner l'authentification | Seule l'API publique en lecture seule est utilisée | `client.ts` |
| Pas d'OAuth non documenté | Aucun code OAuth | — |
| Respect des limites de l'API | Une requête à la fois, pause de 300 ms, reprise après 429 (Retry-After), mois terminés jamais redemandés | Tests unitaires « en série », « 429 », « cache » |
| Consentement avant toute requête | Bouton désactivé tant que la case n'est pas cochée | e2e : 0 requête avant consentement |
| Aucune action sur le compte | L'API ne le permet pas | — |
| Seules des adresses de l'API sont suivies | Les URL d'archives reçues sont filtrées | Test « n'accepte que des adresses de l'API » |
| Données personnelles protégées | Stockage local uniquement ; déliaison avec suppression facultative des parties | e2e « déliaison » |
| Indépendance | Si Chess.com est injoignable : message clair, reste de l'application intact | e2e « hors ligne » |

## Ce qui a été réellement testé

- **Avec l'API réelle** (compte public de référence « hikaru », depuis le navigateur, sans rien enregistrer) : profil, statistiques, 155 mois d'archives, un mois complet : **44 parties lues sans erreur**, camp du joueur reconnu dans 44 cas sur 44, **4 requêtes** en série (4 s).
- **Avec une API simulée** (tests automatiques, aucune requête réelle) : consentement, liaison, import, doublons, variantes, cache, analyse groupée, déliaison, pseudo inconnu, pseudo invalide, service injoignable.
- **Pas encore testé avec ton propre pseudo** : c'est à toi de le faire dans l'écran « Chess.com et mes parties » (l'application demande ton accord). Je ne l'ai pas fait à ta place, car c'est ton compte.

## Découvertes techniques

- Un navigateur **interdit de modifier l'en-tête User-Agent** : on ne peut donc pas y mettre des coordonnées de contact comme Chess.com le recommande pour les scripts. L'API accepte les requêtes du navigateur (vérifié). Aucune donnée personnelle n'est ajoutée aux requêtes. Pour l'application Windows (Phase 7), un User-Agent avec contact pourra être envoyé — **seulement si tu fournis toi-même un contact**.
- L'en-tête **ETag** n'est pas lisible depuis une page web (règles CORS). Solution : cache HTTP du navigateur + conservation locale des mois terminés.
- Le champ « accuracies » renvoyé par Chess.com (leur propre indicateur) **n'est pas importé**, pour ne pas le confondre avec la précision calculée par cette application.

## Tests

| Suite | Résultat |
|---|---|
| Unitaires (Vitest) | **311 / 311** (dont 10 pour Chess.com) |
| Bout en bout (Playwright) | **27 / 27**, aucune erreur de console |
| Typage strict, compilation | OK |
| Audit des dépendances | 0 vulnérabilité |

## Fichiers créés ou modifiés

```
src/integrations/chesscom/client.ts      client PubAPI (série, 429, cache, validation)
src/integrations/chesscom/importer.ts    conversion, filtres, doublons, camp du joueur
src/integrations/chesscom/service.ts     client de l'application + cache IndexedDB
src/integrations/chesscom/chesscom.test.ts
src/analysis/batch.ts                    analyse groupée
src/sections/chesscom/ChessComPage.tsx   écran (consentement, profil, import, analyse, déliaison)
src/storage/db.ts, repo.ts               base v3 (intégration, cache des mois, identifiant externe), sauvegarde v3
tests/e2e/chesscom.spec.ts
docs/02-integration-chesscom.md          statut mis à jour
```

## Limites

- Données **publiques** seulement (pas les parties privées ni les conversations), comme le prévoit l'API.
- L'analyse groupée tourne dans l'onglet : la fermer interrompt l'analyse (les parties déjà analysées restent enregistrées).
- Pas de synchronisation automatique : l'import se lance à la demande.

## Vérification avant la Phase 6

1. Phase 5 terminée : ✅ (test avec ton pseudo à faire par toi).
2. Fonctionnalités testées : ✅
3. Erreurs connues corrigées : ✅
4. Données sauvegardées : ✅ base v3, sauvegarde/restauration incluant la liaison ; Git à jour.
5. Architecture prête : ✅ la Phase 6 (tableau de bord) peut s'appuyer sur les parties de toutes les sources.
6. Solution de repli : ✅ import PGN manuel toujours disponible ; l'application fonctionne sans Chess.com.
