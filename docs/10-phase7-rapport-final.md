# 10 — Rapport de la Phase 7 et bilan de livraison

> 19 novembre 2026 · **Version 1.0.0**

## Ce que la Phase 7 a apporté

| Objectif | Résultat |
|---|---|
| Tester chaque fonctionnalité | 421 tests unitaires (dont Stockfish réel et la vérification de tout le contenu) ; 56 scénarios navigateur sur le serveur de développement ; toute la suite rejouée sur la **version de production** (59 tests : CSP, hors ligne, accessibilité, performances) |
| Corriger les erreurs | 5 défauts trouvés et corrigés (ci-dessous) |
| Vérifier la sécurité | Revue complète ; 1 faille corrigée ; politique CSP ; licences vérifiées |
| Tester les performances | Mesures enregistrées dans `docs/mesures-performances.json` |
| Produire la documentation | [Guide d’utilisation](guide-utilisation.md), [documentation technique](documentation-technique.md) |
| Livrer une version stable et utilisable | Application **installable sur Windows** (Edge/Chrome), **hors ligne**, version 1.0.0 |

### Application Windows : choix retenu

Rust (nécessaire à Tauri) n’étant pas installé, tu as choisi l’**application installable** (PWA) : icône, fenêtre propre, fonctionnement hors ligne, sans rien installer sur le PC. L’option Tauri (installateur `.exe`, Stockfish complet) reste possible plus tard.

## Défauts trouvés et corrigés pendant la Phase 7

1. **Faille de sécurité** : le lien « voir sur Chess.com » utilisait une adresse reçue de l’API sans vérification (une adresse `javascript:` aurait pu exécuter du code). Désormais seules les adresses `https://www.chess.com/…` deviennent des liens (testé).
2. **Hors ligne cassé pour les écrans chargés à la demande** : le cache refusait les modules à cause de l’en-tête `Vary: Origin`. Trouvé en arrêtant réellement le serveur ; corrigé (`ignoreVary`) et couvert par un test.
3. **Mises à jour du service hors ligne non détectées** si seul son script changeait : la version du cache inclut maintenant ce script.
4. **Contrastes insuffisants** (petits titres dorés, badges verts en mode clair) et **liste déroulante sans nom accessible** : corrigés ; audit axe-core propre sur 13 écrans, en clair et en sombre.
5. Un test instable sous forte charge (clic avant changement d’étape) : corrigé.

## Performances (version de production, machine de développement)

| Mesure | Résultat |
|---|---|
| Premier écran (échiquier) prêt | 0,45 à 0,7 s |
| Fichier principal (compressé) | 122 Ko (au lieu de 223 Ko grâce au chargement des écrans à la demande) |
| Analyse Stockfish d’une partie de 40 demi-coups | 3,9 à 5,7 s (≈ 95 à 140 ms par position, profondeur ≤ 14) |
| Hors ligne | Application, leçons, exercices, moteur : fonctionnels sans serveur (vérifié en réel et par test) |

## Sécurité — synthèse

CSP stricte en production (connexions limitées à l’application et à `api.chess.com`) ; aucun HTML injecté ; entrées bornées et validées (PGN, sauvegarde, pseudo, URL externes) ; aucune donnée personnelle envoyée ; aucun mot de passe ; `npm audit` : 0 vulnérabilité ; licences des composants livrés : MIT, BSD-2, Apache-2.0, GPL-3.0 — toutes compatibles avec la licence GPL-3.0 du projet. Détails : [documentation technique](documentation-technique.md#sécurité).

## Bilan des 15 critères de réussite

| # | Critère | État |
|---|---|---|
| 1 | Application complète, interface professionnelle | ✅ 12 sections, thème clair/sombre, responsive |
| 2 | Échiquier respectant toutes les règles | ✅ perft de référence, 45+ tests de règles, positions impossibles refusées |
| 3 | Leçons progressives | ✅ 32 leçons, 4 cours (Modules 2, 3, 6, 7) |
| 4 | Bibliothèque d’ouvertures | ✅ 14 ouvertures expliquées coup par coup |
| 5 | Exercices tactiques | ✅ 3 365 exercices, 17 thèmes, indices progressifs |
| 6 | Adversaire IA | ✅ 6 niveaux, ordre de force mesuré |
| 7 | Moteur d’analyse intégré | ✅ Stockfish 19 (WebAssembly) |
| 8 | Entraîneur IA qui explique les coups | ✅ explications fondées sur des faits calculés, « Comprendre mon erreur » |
| 9 | Progression personnalisée | ✅ évaluation, séance du jour, habitudes, positions à retravailler |
| 10 | Tableau de bord statistique | ✅ graphiques, estimations étiquetées |
| 11 | Import et analyse PGN | ✅ |
| 12 | Intégration Chess.com | ✅ API publique, consentement, lecture seule (Google : impossible et inutile, expliqué) |
| 13 | Sauvegarde fiable | ✅ IndexedDB versionnée, sauvegarde/restauration validées |
| 14 | Interface responsive | ✅ testée ordinateur et téléphone |
| 15 | Documentation et guide | ✅ |

## Limites connues (honnêtes)

- **Entraîneur à question libre** (modèle de langage) : non intégré ; il demanderait ton accord (coût, envoi de positions à un service externe). L’entraîneur actuel s’appuie sur des faits calculés.
- **Stockfish « lite »** : très fort, mais il ne démontre pas certaines nulles de forteresse ; une version complète serait possible avec Tauri.
- **Tes données sont liées à l’adresse** : l’application installée (port 4173) et la version de développement (port 5173) ont des données séparées — utilise *Sauvegarde / Restauration* pour les transférer.
- **Pas de tournois ni de multijoueur** : hors du périmètre demandé ; l’architecture modulaire le permet.
- Le test avec **ton propre pseudo Chess.com** reste à faire par toi.
- La simulation « hors ligne » de Playwright ne reproduit pas un vrai hors-ligne : le test automatique bloque plutôt toutes les requêtes réseau (le vrai hors-ligne a été vérifié en arrêtant le serveur).
