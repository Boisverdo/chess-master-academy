/** Module 3 — Premiers principes stratégiques. Contenu original de Chess Master Academy. */
import type { Lesson } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

export const PRINCIPES: Lesson[] = [
  {
    id: 'principes-verification',
    course: 'principes',
    title: 'Avant chaque coup : échecs, prises, menaces',
    summary: 'La routine de réflexion qui évite la plupart des gaffes.',
    minutes: 8,
    skills: ['vigilance', 'pieces-en-prise'],
    steps: [
      {
        kind: 'explain',
        title: 'La question la plus importante',
        text: 'La majorité des parties entre débutants se décident sur une pièce laissée en prise ou une menace non vue. Les joueurs forts ont une **routine** avant chaque coup :\n\n1. **Que veut faire mon adversaire ?** Qu’attaque son dernier coup ?\n2. **Mes coups forcés d’abord** : les **échecs**, les **prises**, les **menaces**.\n3. **Vérification finale** : après mon coup, quelle pièce laisserais-je sans défense ?\n\nCette routine prend quelques secondes et change tout.',
      },
      {
        kind: 'move',
        prompt: 'Les Blancs viennent de jouer leur dame en g4. Que permet ce coup ?',
        fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P1Q1/8/PPPP1PPP/RNB1KBNR b KQkq - 2 3',
        orientation: 'black',
        goal: 'exact',
        accept: ['f6g4'],
        hint: 'Regarde les prises possibles. Une de tes pièces atteint g4.',
        success: 'Exact : la dame blanche est venue se placer sur une case contrôlée par ton cavalier. Toujours regarder les prises !',
      },
      {
        kind: 'move',
        prompt: 'Les Blancs menacent Dxf7 mat. Pare la menace.',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        orientation: 'black',
        goal: 'prevent-mate',
        reject: { e8e7: 'Le mat est évité, mais le roi s’expose au centre et ne pourra plus roquer. Cherche une défense plus saine.' },
        hint: 'La dame et le fou visent ensemble la case f7. Défends-la, ou chasse la dame.',
        success: 'Bien vu : le mat est paré. g6 a l’avantage de chasser la dame avec gain de temps ; De7 et Df6 défendent f7 directement.',
      },
      {
        kind: 'choice',
        prompt: 'Avant de jouer ton coup, quelle vérification évite le plus d’erreurs ?',
        options: [
          { label: 'Regarder ce que menace le dernier coup adverse', correct: true, feedback: 'Exact : comprendre l’intention adverse est la première étape.' },
          { label: 'Chercher le coup le plus agressif', correct: false, feedback: 'Attaquer sans regarder la menace adverse mène souvent à la défaite.' },
          { label: 'Jouer vite pour garder du temps', correct: false, feedback: 'Gagner quelques secondes ne compense pas une pièce perdue.' },
        ],
      },
    ],
  },
  {
    id: 'principes-centre',
    course: 'principes',
    title: 'Le contrôle du centre',
    summary: 'Pourquoi les cases d4, e4, d5 et e5 comptent plus que les autres.',
    minutes: 7,
    skills: ['centre'],
    steps: [
      {
        kind: 'explain',
        title: 'Les quatre cases centrales',
        text: 'Les cases **d4, e4, d5 et e5** forment le centre. Une pièce au centre contrôle davantage de cases et peut rejoindre rapidement les deux ailes.\n\nComparer : un cavalier en d4 atteint **8 cases** ; dans le coin en a1, seulement **2**.\n\nLe camp qui contrôle le centre a plus d’espace pour manœuvrer ; l’autre est à l’étroit.',
        board: { fen: '4k3/8/8/8/3N4/8/8/N3K3 w - - 0 1', shapes: [{ orig: 'd4', brush: 'green' }, { orig: 'e4', brush: 'green' }, { orig: 'd5', brush: 'green' }, { orig: 'e5', brush: 'green' }, { orig: 'a1', dest: 'b3', brush: 'red' }, { orig: 'a1', dest: 'c2', brush: 'red' }] },
      },
      {
        kind: 'move',
        prompt: 'Premier coup de la partie : place un pion au centre.',
        fen: START,
        goal: 'exact',
        accept: ['e2e4', 'd2d4'],
        wrong: { a2a4: 'Un pion de bord ne contrôle aucune case centrale.', h2h4: 'Un pion de bord ne contrôle aucune case centrale et affaiblit le roque futur.' },
        hint: 'Les pions d et e peuvent avancer de deux cases jusqu’au centre.',
        success: 'Exact : e4 et d4 occupent le centre et ouvrent des lignes à la dame et à un fou.',
      },
      {
        kind: 'demo',
        title: 'Le centre en action',
        text: 'Une ouverture classique où chaque camp se dispute le centre.',
        fen: START,
        moves: [
          { san: 'e4', comment: 'Les Blancs occupent e4 et visent d5 et f5.' },
          { san: 'e5', comment: 'Les Noirs répondent symétriquement.' },
          { san: 'Nf3', comment: 'Le cavalier se développe vers le centre et attaque le pion e5.' },
          { san: 'Nc6', comment: 'Les Noirs défendent e5 en développant aussi une pièce.' },
          { san: 'd4', comment: 'Les Blancs défient le centre une seconde fois.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Pourquoi 1.e4 est-il un bon premier coup ?',
        options: [
          { label: 'Il occupe le centre et libère la dame et le fou f1', correct: true, feedback: 'Exact : un pion central, deux pièces libérées.' },
          { label: 'Il prépare une attaque immédiate du roi', correct: false, feedback: 'L’objectif de l’ouverture n’est pas d’attaquer tout de suite, mais de prendre le centre et de se développer.' },
        ],
      },
    ],
  },
  {
    id: 'principes-developpement',
    course: 'principes',
    title: 'Le développement des pièces',
    summary: 'Sortir ses pièces vite et bien, sans perdre de temps.',
    minutes: 8,
    skills: ['developpement', 'tempo'],
    steps: [
      {
        kind: 'explain',
        title: 'Mettre toutes ses pièces au travail',
        text: 'Une pièce qui n’a pas bougé ne participe pas à la partie. Dans l’ouverture, les priorités sont :\n\n1. **Sortir les cavaliers et les fous** vers le centre ;\n2. **Ne pas bouger deux fois la même pièce** sans bonne raison : chaque coup compte (on parle de **temps**, ou de **tempo**) ;\n3. **Ne pas sortir la dame trop tôt** : elle se ferait chasser par des pièces de moindre valeur, avec gain de temps pour l’adversaire ;\n4. **Roquer** rapidement.',
      },
      {
        kind: 'move',
        prompt: 'Après 1.e4 e5, développe une pièce mineure (cavalier ou fou) vers le centre.',
        fen: AFTER_E4_E5,
        goal: 'exact',
        accept: ['g1f3', 'b1c3', 'f1c4', 'f1b5'],
        wrong: {
          d1h5: 'La dame sort trop tôt : les Noirs pourront la chasser en développant leurs pièces (…Cc6, …Cf6, …g6) avec gain de temps.',
          d1f3: 'La dame sort trop tôt et prend la meilleure case du cavalier g1.',
          g1h3: 'Le cavalier se développe, mais vers le bord : en h3 il contrôle peu de cases centrales.',
          b1a3: 'Le cavalier se développe, mais vers le bord : en a3 il contrôle peu de cases centrales.',
        },
        hint: 'Cf3 attaque même le pion e5.',
        success: 'Très bien : une pièce de plus en jeu, dirigée vers le centre.',
      },
      {
        kind: 'demo',
        title: 'Le prix d’un développement négligé',
        text: 'Le « mat de Légal » : les Noirs jouent des coups de pions et prennent la dame… pendant que les pièces blanches, développées, attaquent.',
        fen: START,
        moves: [
          { san: 'e4', comment: 'Un pion au centre.' },
          { san: 'e5', comment: 'Réponse symétrique.' },
          { san: 'Nf3', comment: 'Développement avec attaque de e5.' },
          { san: 'd6', comment: 'Défense solide, mais passive.' },
          { san: 'Bc4', comment: 'Le fou vise f7, point faible des Noirs.' },
          { san: 'Bg4', comment: 'Le fou cloue le cavalier f3 sur la dame.' },
          { san: 'Nc3', comment: 'Encore une pièce développée.' },
          { san: 'g6', comment: 'Un coup de pion inutile : les Noirs prennent du retard.' },
          { san: 'Nxe5', comment: 'Les Blancs ignorent le clouage et offrent leur dame !' },
          { san: 'Bxd1', comment: 'Les Noirs acceptent… c’est une erreur.' },
          { san: 'Bxf7+', comment: 'Échec : le roi doit avancer.' },
          { san: 'Ke7', comment: 'Seule case.' },
          { san: 'Nd5#', comment: 'Mat ! Trois pièces mineures développées ont battu une dame. Les Noirs n’avaient développé qu’un fou.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Dans l’ouverture, tu as déjà bougé ton cavalier deux fois et rien d’autre. Que penser ?',
        options: [
          { label: 'Je perds du temps : mes autres pièces dorment', correct: true, feedback: 'Exact : sauf nécessité tactique, développe une nouvelle pièce à chaque coup.' },
          { label: 'C’est bien, le cavalier est très actif', correct: false, feedback: 'Une seule pièce active ne suffit pas : l’adversaire va se développer plus vite.' },
        ],
      },
    ],
  },
  {
    id: 'principes-roi',
    course: 'principes',
    title: 'La sécurité du roi',
    summary: 'Roquer tôt et garder un abri solide.',
    minutes: 6,
    skills: ['securite-roi', 'roque'],
    steps: [
      {
        kind: 'explain',
        title: 'Le roi au centre est en danger',
        text: 'Quand le centre s’ouvre, un roi resté en e1 ou e8 devient une cible : les tours et les fous adverses s’y engouffrent.\n\nD’où la règle : **roque tôt**, en général dans les dix premiers coups. Ensuite, **évite d’avancer les pions devant ton roi roqué** sans raison : chaque pion avancé crée une faiblesse.',
        board: { fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 4 6', shapes: [{ orig: 'g1', brush: 'green' }, { orig: 'g8', brush: 'green' }] },
      },
      {
        kind: 'choice',
        prompt: 'Quel est le coup le plus sûr pour le roi blanc ?',
        board: { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
        options: [
          { label: 'Le petit roque (O-O)', correct: true, feedback: 'Exact : le roi part à l’abri derrière ses pions et la tour entre en jeu.' },
          { label: 'Re2', correct: false, feedback: 'Le roi reste au centre, bloque le fou f1… et perd le droit de roquer.' },
          { label: 'Rf1', correct: false, feedback: 'Le roi perd le droit de roquer et la tour h1 reste enfermée.' },
        ],
      },
      { kind: 'move', prompt: 'Mets ton roi à l’abri.', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', goal: 'castle', hint: 'Les cases f1 et g1 sont libres et non attaquées.', success: 'Roque ! Le roi est protégé et la tour f1 est prête à rejoindre le centre.' },
    ],
  },
];
