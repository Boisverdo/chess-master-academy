/** Modules 3 (suite) et 6 — Stratégie et jeu positionnel. Contenu original de Chess Master Academy. */
import { ChessGame } from '../../core/game';
import type { Lesson } from './types';

/** Position atteinte après une suite de coups (garantit des positions légales et réalistes). */
const after = (moves: string) => ChessGame.fromSan(moves.trim().split(/\s+/)).fen;

const SCANDI = after('e4 d5 exd5 Qxd5');
const ITALIAN = after('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O');
const FRENCH_ADV = after('e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6');
const CARLSBAD = after('d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 Rab1');

export const STRATEGIE: Lesson[] = [
  {
    id: 'strategie-tempo',
    course: 'strategie',
    title: 'Coordination, tempo et initiative',
    summary: 'Gagner du temps avec des menaces et faire travailler ses pièces ensemble.',
    minutes: 7,
    skills: ['tempo', 'coordination', 'initiative'],
    steps: [
      {
        kind: 'explain',
        title: 'Chaque coup compte',
        text: 'Un **tempo**, c’est un coup. Gagner un tempo, c’est développer une pièce **en créant une menace** : l’adversaire doit y répondre au lieu de progresser.\n\nLes pièces sont **coordonnées** quand elles se protègent et visent les mêmes objectifs. Le camp qui crée les menaces a **l’initiative** : l’autre réagit.',
        board: { fen: SCANDI, shapes: [{ orig: 'b1', dest: 'c3', brush: 'green' }, { orig: 'c3', dest: 'd5', brush: 'red' }] },
      },
      {
        kind: 'move',
        prompt: 'La dame noire est sortie très tôt. Développe une pièce **en l’attaquant**.',
        fen: SCANDI,
        goal: 'exact',
        accept: ['b1c3'],
        wrong: { g1f3: 'Bon développement, mais il n’attaque pas la dame : aucun tempo gagné.' },
        hint: 'Un cavalier peut venir attaquer la case d5.',
        success: 'Cc3 développe ET chasse la dame : les Noirs perdent un temps à la déplacer.',
      },
      {
        kind: 'choice',
        prompt: 'Que signifie « avoir l’initiative » ?',
        options: [
          { label: 'Être le camp qui crée les menaces, l’autre devant y répondre', correct: true, feedback: 'Exact : l’initiative est un avantage dynamique, qui peut disparaître si on ne l’entretient pas.' },
          { label: 'Avoir joué le premier coup', correct: false, feedback: 'Les Blancs commencent, mais l’initiative se gagne et se perd pendant la partie.' },
          { label: 'Avoir plus de matériel', correct: false, feedback: 'Le matériel est un avantage statique ; l’initiative est dynamique.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-echanges',
    course: 'strategie',
    title: 'Les échanges avantageux',
    summary: 'Quand échanger, et quand l’éviter.',
    minutes: 6,
    skills: ['echanges'],
    steps: [
      {
        kind: 'explain',
        title: 'Échanger avec un but',
        text: 'Un échange n’est jamais neutre. Il est favorable si :\n1. tu as **plus de matériel** : chaque échange rapproche d’une finale gagnante ;\n2. il **élimine une pièce adverse active** ou un défenseur important ;\n3. il te débarrasse de **ta pièce la moins utile**.\n\nÉvite d’échanger quand l’adversaire **manque d’espace** (échanger le soulagerait) ou quand **tu attaques** (tu perdrais des attaquants).',
      },
      {
        kind: 'move',
        prompt: 'Tu as une tour de plus. Simplifie la position en **échangeant les tours**.',
        fen: '3r4/4kppp/8/8/8/8/5PPP/3R1RK1 w - - 0 1',
        goal: 'exact',
        accept: ['d1d8'],
        hint: 'Les deux tours se font face sur la colonne d.',
        success: 'Txd8+ Rxd8 : il te reste une tour contre aucune. La victoire devient simple.',
      },
      {
        kind: 'choice',
        prompt: 'Ton adversaire est à l’étroit, ses pièces se gênent. Faut-il échanger des pièces ?',
        options: [
          { label: 'Plutôt non : les échanges libéreraient sa position', correct: true, feedback: 'Exact : quand l’adversaire manque de place, garde les pièces sur l’échiquier.' },
          { label: 'Oui, toujours échanger le plus possible', correct: false, feedback: 'Chaque échange lui redonne de l’espace pour ses pièces restantes.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-prophylaxie',
    course: 'strategie',
    title: 'L’espace et la prophylaxie',
    summary: 'Prendre de la place et empêcher les projets adverses.',
    minutes: 6,
    skills: ['espace', 'prophylaxie'],
    steps: [
      {
        kind: 'explain',
        title: 'Penser aux plans de l’adversaire',
        text: 'Le camp qui a plus d’**espace** déplace ses pièces facilement ; l’autre se gêne.\n\nLa **prophylaxie**, c’est demander à chaque coup : **« Que veut faire mon adversaire ? »**, puis l’en empêcher avant même qu’il ne le menace. C’est la marque des joueurs expérimentés.',
        board: { fen: ITALIAN, shapes: [{ orig: 'c8', dest: 'g4', brush: 'red' }] },
      },
      {
        kind: 'move',
        prompt: 'Les Noirs aimeraient jouer …Fg4 pour clouer ton cavalier f3 sur ta dame. Joue un coup qui **empêche** cette idée.',
        fen: ITALIAN,
        goal: 'exact',
        accept: ['h2h3'],
        hint: 'Un pion peut contrôler la case g4.',
        success: 'h3 enlève la case g4 au fou noir : c’est un coup prophylactique typique.',
      },
      {
        kind: 'choice',
        prompt: 'Quelle question pose-t-on avant un coup prophylactique ?',
        options: [
          { label: 'Que veut faire mon adversaire ?', correct: true, feedback: 'Exact. Ensuite seulement, on choisit le coup qui gêne ce projet.' },
          { label: 'Quelle pièce puis-je prendre ?', correct: false, feedback: 'C’est une question tactique utile, mais la prophylaxie part des plans adverses.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-colonnes',
    course: 'strategie',
    title: 'Colonnes ouvertes et semi-ouvertes',
    summary: 'Où placer ses tours.',
    minutes: 5,
    skills: ['colonnes'],
    steps: [
      {
        kind: 'explain',
        title: 'Les autoroutes des tours',
        text: 'Une colonne est **ouverte** quand il n’y a plus aucun pion dessus, **semi-ouverte** quand seuls les pions adverses y restent.\n\nUne tour sur une colonne ouverte peut pénétrer jusqu’au camp adverse (souvent sur la 7e rangée). Le premier à occuper la colonne en prend le contrôle.',
        board: { fen: 'r4rk1/pp2pppp/2n2n2/2p5/2P5/2N2N2/PP2PPPP/R4RK1 w - - 0 10', shapes: [{ orig: 'd1', dest: 'd8', brush: 'green' }] },
      },
      {
        kind: 'move',
        prompt: 'La colonne d est ouverte. Prends-en le contrôle avec une tour.',
        fen: 'r4rk1/pp2pppp/2n2n2/2p5/2P5/2N2N2/PP2PPPP/R4RK1 w - - 0 10',
        goal: 'exact',
        accept: ['f1d1', 'a1d1'],
        hint: 'L’une ou l’autre de tes tours peut aller en d1.',
        success: 'La tour occupe la colonne ouverte avant les tours noires.',
      },
    ],
  },
  {
    id: 'strategie-cases-faibles',
    course: 'strategie',
    title: 'Cases faibles et avant-postes',
    summary: 'Installer une pièce sur une case que l’adversaire ne peut plus contrôler.',
    minutes: 7,
    skills: ['cases-faibles', 'avant-postes', 'domination'],
    steps: [
      {
        kind: 'explain',
        title: 'Une case pour toujours',
        text: 'Une **case faible** est une case que l’adversaire ne peut plus défendre avec un pion. Si l’une de tes pièces s’y installe, protégée par un pion, c’est un **avant-poste** : elle ne pourra jamais en être chassée par un pion.\n\nUn cavalier sur un avant-poste central **domine** souvent un fou adverse gêné par ses propres pions.',
        board: { fen: 'r2q1rk1/pp2bppp/3p1n2/4p3/4P3/2N2P2/PPP1B1PP/R2Q1RK1 w - - 0 12', shapes: [{ orig: 'd5', brush: 'green' }, { orig: 'e4', dest: 'd5', brush: 'blue' }] },
      },
      {
        kind: 'move',
        prompt: 'Les Noirs n’ont plus de pion c : la case d5 ne pourra jamais être attaquée par un pion. Occupe cet avant-poste.',
        fen: 'r2q1rk1/pp2bppp/3p1n2/4p3/4P3/2N2P2/PPP1B1PP/R2Q1RK1 w - - 0 12',
        goal: 'exact',
        accept: ['c3d5'],
        hint: 'Ton cavalier c3 atteint d5 en un saut, et le pion e4 le protégera (lui-même solidement défendu par f3).',
        success: 'Le cavalier en d5 est protégé par le pion e4 et aucun pion noir ne peut le chasser. Remarque : avant de quitter c3, il fallait s’assurer que e4 restait défendu — c’est le rôle du pion f3.',
      },
    ],
  },
  {
    id: 'strategie-pions-faibles',
    course: 'strategie',
    title: 'Pions isolés et pions doublés',
    summary: 'Reconnaître les faiblesses de pions et en profiter.',
    minutes: 7,
    skills: ['structures-de-pions', 'pions-isoles'],
    steps: [
      {
        kind: 'explain',
        title: 'Des pions sans voisins',
        text: 'Un **pion isolé** n’a plus de pion ami sur les colonnes voisines : aucun pion ne peut le protéger. La case **devant lui** est une case faible idéale pour **bloquer** le pion avec une pièce, de préférence un cavalier.\n\nDes **pions doublés** sont deux pions sur la même colonne : ils se protègent mal et le pion arrière est gêné.\n\nCes pions ont aussi des atouts (espace, colonnes ouvertes) : ce sont des faiblesses à long terme.',
        board: { fen: 'r2q1rk1/pp2bppp/2n1bn2/3p4/8/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 10', shapes: [{ orig: 'd5', brush: 'red' }, { orig: 'd4', brush: 'green' }] },
      },
      {
        kind: 'move',
        prompt: 'Le pion noir d5 est isolé. Place un cavalier sur la case de blocage, juste devant lui.',
        fen: 'r2q1rk1/pp2bppp/2n1bn2/3p4/8/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 10',
        goal: 'exact',
        accept: ['f3d4'],
        hint: 'La case d4 est devant le pion d5 ; ton cavalier f3 l’atteint.',
        success: 'Cd4 bloque le pion isolé : il ne peut plus avancer, et le cavalier est très bien placé.',
      },
      {
        kind: 'choice',
        prompt: 'Combien de pions isolés les Noirs ont-ils ici ?',
        board: { fen: 'r2q1rk1/pp2bppp/2n1bn2/3p4/8/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 10' },
        options: [
          { label: 'Un : le pion d5', correct: true, feedback: 'Exact : les pions c et e noirs ont disparu, le pion d5 n’a plus de voisin.' },
          { label: 'Aucun', correct: false, feedback: 'Regarde les colonnes c et e : aucun pion noir.' },
          { label: 'Deux', correct: false, feedback: 'Les pions a/b et f/g/h ont des voisins ; seul d5 est isolé.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-pions-passes',
    course: 'strategie',
    title: 'Pions passés, chaînes et majorités',
    summary: 'Créer un pion passé et attaquer une chaîne de pions.',
    minutes: 7,
    skills: ['pions-passes', 'majorite', 'chaines'],
    steps: [
      {
        kind: 'explain',
        title: 'Le pion qui ne peut plus être arrêté par un pion',
        text: 'Un **pion passé** n’a plus aucun pion adverse devant lui ni sur les colonnes voisines : seules les pièces peuvent l’arrêter. Plus il avance, plus il est fort.\n\nUne **majorité** (plus de pions que l’adversaire sur une aile) permet d’en créer un. On avance d’abord le **pion candidat** : celui qui n’a pas de pion adverse en face.\n\nUne **chaîne de pions** s’attaque à sa **base**, le pion qui n’est protégé par aucun autre.',
        board: { fen: '6k1/pp3ppp/8/8/8/8/PPP2PPP/6K1 w - - 0 1', shapes: [{ orig: 'c2', dest: 'c4', brush: 'green' }] },
      },
      {
        kind: 'move',
        prompt: 'Tu as trois pions contre deux à l’aile dame. Avance le pion candidat.',
        fen: '6k1/pp3ppp/8/8/8/8/PPP2PPP/6K1 w - - 0 1',
        goal: 'exact',
        accept: ['c2c4'],
        wrong: { a2a4: 'Le pion a a un pion adverse en face (a7) : ce n’est pas le candidat.', b2b4: 'Le pion b a un pion adverse en face (b7) : ce n’est pas le candidat.' },
        hint: 'Quel pion de l’aile dame n’a aucun pion noir sur sa colonne ?',
        success: 'Le pion c est le candidat : soutenu par ses voisins, il deviendra un pion passé.',
      },
      {
        kind: 'choice',
        prompt: 'Où faut-il attaquer une chaîne de pions adverse ?',
        board: { fen: FRENCH_ADV, shapes: [{ orig: 'd4', brush: 'red' }] },
        options: [
          { label: 'À sa base (ici d4)', correct: true, feedback: 'Exact : c’est pourquoi les Noirs jouent …c5 et attaquent d4 de toutes leurs forces.' },
          { label: 'À sa tête (ici e5)', correct: false, feedback: 'La tête est protégée par le reste de la chaîne ; la base ne l’est pas.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-fous',
    course: 'strategie',
    title: 'La paire de fous et le mauvais fou',
    summary: 'Évaluer ses fous selon la structure de pions.',
    minutes: 5,
    skills: ['paire-de-fous', 'mauvais-fou'],
    steps: [
      {
        kind: 'explain',
        title: 'Les fous et les pions',
        text: 'Un **mauvais fou** est gêné par ses propres pions placés sur des cases de **sa couleur** : il a peu d’avenir.\n\nLa **paire de fous** (garder ses deux fous contre fou et cavalier ou deux cavaliers) est un avantage durable, surtout quand la **position est ouverte** : ensemble, les deux fous contrôlent les cases des deux couleurs.',
        board: { fen: FRENCH_ADV, shapes: [{ orig: 'c8', brush: 'red' }, { orig: 'e6', brush: 'yellow' }, { orig: 'd5', brush: 'yellow' }] },
      },
      {
        kind: 'choice',
        prompt: 'Dans cette structure française, quel fou noir est le « mauvais fou » ?',
        board: { fen: FRENCH_ADV },
        options: [
          { label: 'Le fou c8 (cases claires)', correct: true, feedback: 'Exact : les pions noirs e6 et d5 sont sur des cases claires et bloquent ce fou.' },
          { label: 'Le fou f8 (cases foncées)', correct: false, feedback: 'Le fou f8 a de l’avenir : les pions noirs ne bloquent pas ses diagonales foncées.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Quand la paire de fous est-elle la plus forte ?',
        options: [
          { label: 'Dans les positions ouvertes', correct: true, feedback: 'Exact : les fous ont besoin de diagonales libres.' },
          { label: 'Dans les positions bloquées', correct: false, feedback: 'Les positions fermées favorisent plutôt les cavaliers, qui sautent par-dessus les pions.' },
        ],
      },
    ],
  },
  {
    id: 'strategie-plans',
    course: 'strategie',
    title: 'Construire un plan',
    summary: 'Évaluer la position, repérer les faiblesses, choisir un plan.',
    minutes: 8,
    skills: ['plans', 'faiblesses', 'avantages-statiques'],
    steps: [
      {
        kind: 'explain',
        title: 'Une méthode en trois temps',
        text: '1. **Évaluer** : matériel, sécurité des rois, structure de pions, activité des pièces, espace.\n2. **Repérer les faiblesses** : pions isolés ou arriérés, cases faibles, roi exposé, pièce mal placée — chez l’adversaire et chez soi.\n3. **Choisir un plan** qui exploite une faiblesse adverse ou en crée une, puis placer ses pièces pour le réaliser.\n\nLes avantages **statiques** (meilleure structure, matériel) durent ; les avantages **dynamiques** (initiative, avance de développement) disparaissent si on ne les utilise pas vite.',
      },
      {
        kind: 'choice',
        prompt: 'Dans cette structure (dite « Carlsbad »), quel est le plan typique des Blancs ?',
        board: { fen: CARLSBAD },
        options: [
          { label: 'L’attaque des minorités : b4-b5 pour créer une faiblesse en c6', correct: true, feedback: 'Exact : deux pions blancs contre trois noirs avancent pour affaiblir la structure noire à l’aile dame.' },
          { label: 'Échanger toutes les pièces au plus vite', correct: false, feedback: 'Sans plan, les échanges ne créent aucune faiblesse chez l’adversaire.' },
          { label: 'Pousser e4 immédiatement, sans préparation', correct: false, feedback: 'e4 se prépare (f3, Te1) ; joué trop tôt, il laisse un pion isolé.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Lequel de ces avantages est statique ?',
        options: [
          { label: 'Un pion isolé chez l’adversaire', correct: true, feedback: 'Exact : il restera une faiblesse longtemps.' },
          { label: 'Une avance de développement', correct: false, feedback: 'C’est dynamique : l’adversaire finira par se développer.' },
          { label: 'Une attaque en cours contre le roi', correct: false, feedback: 'C’est dynamique : elle s’éteint si elle n’aboutit pas.' },
        ],
      },
    ],
  },
];
