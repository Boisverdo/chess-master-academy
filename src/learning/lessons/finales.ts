/** Module 7 — Les finales. Contenu original de Chess Master Academy. */
import type { Lesson } from './types';

export const FINALES: Lesson[] = [
  {
    id: 'finales-mats',
    course: 'finales',
    title: 'Les mats élémentaires',
    summary: 'Mater avec roi et dame, puis avec roi et tour.',
    minutes: 10,
    skills: ['finales', 'mat-elementaire'],
    steps: [
      {
        kind: 'explain',
        title: 'Rétrécir la boîte',
        text: 'Avec roi et dame (ou roi et tour) contre roi seul, la victoire est certaine… à condition de connaître la technique :\n1. la pièce lourde **enferme** le roi adverse dans une « boîte » qu’elle rétrécit ;\n2. ton **roi s’approche** pour aider : seul, la dame ou la tour ne peut pas mater ;\n3. le mat se donne sur le **bord** de l’échiquier.\n\nAttention au **pat** : laisse toujours au moins une case au roi adverse tant que tu ne donnes pas mat.',
        board: { fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', shapes: [{ orig: 'h1', dest: 'h4', brush: 'green' }] },
      },
      { kind: 'play', prompt: 'Mate le roi noir avec roi et dame (l’ordinateur défend au mieux).', fen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', goal: 'mate', maxMoves: 20, hint: 'Place ta dame à un saut de cavalier du roi adverse pour le repousser, puis amène ton roi.', success: 'Mat ! Technique maîtrisée.' },
      { kind: 'play', prompt: 'Même exercice avec roi et tour : c’est plus long, la tour a besoin de l’aide du roi.', fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1', goal: 'mate', maxMoves: 30, hint: 'Mets les rois face à face (opposition), puis donne échec avec la tour : le roi adverse recule d’une rangée.', success: 'Mat avec la tour : une technique indispensable.' },
    ],
  },
  {
    id: 'finales-roi-pion',
    course: 'finales',
    title: 'Roi et pion contre roi : cases clés et opposition',
    summary: 'Savoir d’un coup d’œil si le pion va à dame.',
    minutes: 10,
    skills: ['finales', 'opposition', 'cases-cles'],
    steps: [
      {
        kind: 'explain',
        title: 'Les cases clés',
        text: 'Chaque pion a des **cases clés** : si le roi qui l’accompagne en atteint une, le pion va à dame, quoi que fasse l’adversaire (sauf pour les pions de bord).\n\nPour un pion non avancé (2e à 4e rangée), les cases clés sont les trois cases **deux rangées devant lui**. Ici, pour le pion e2 : **d4, e4 et f4**.',
        board: { fen: '8/8/2k5/8/3K4/8/4P3/8 w - - 0 1', shapes: [{ orig: 'd4', brush: 'green' }, { orig: 'e4', brush: 'green' }, { orig: 'f4', brush: 'green' }] },
      },
      {
        kind: 'choice',
        prompt: 'Le roi blanc occupe déjà une case clé. Les Blancs jouent : quel est le résultat ?',
        board: { fen: '8/8/2k5/8/3K4/8/4P3/8 w - - 0 1' },
        verify: { result: 'win' },
        options: [
          { label: 'Les Blancs gagnent', correct: true, feedback: 'Exact : roi sur une case clé = pion promu.' },
          { label: 'Nulle', correct: false, feedback: 'Le roi blanc contrôle déjà la route du pion.' },
        ],
      },
      { kind: 'play', prompt: 'Prouve-le : mène ton pion à dame contre l’ordinateur.', fen: '8/8/2k5/8/3K4/8/4P3/8 w - - 0 1', goal: 'promote', maxMoves: 15, hint: 'Avance d’abord ton roi devant le pion ; le pion suivra.', success: 'Promotion ! Le roi devant le pion, c’est la clé.' },
      {
        kind: 'explain',
        title: 'L’opposition',
        text: 'Quand les deux rois se font face avec **une case entre eux**, celui qui **n’a pas le trait** « a l’opposition » : l’autre doit céder du terrain.\n\nEn défense, prendre l’opposition au bon moment empêche le roi adverse d’atteindre une case clé.',
        board: { fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1', shapes: [{ orig: 'e3', dest: 'e5', brush: 'yellow' }] },
      },
      {
        kind: 'choice',
        prompt: 'Les Blancs ont le trait, les rois sont en opposition. Quel est le résultat ?',
        board: { fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1' },
        verify: { result: 'draw' },
        options: [
          { label: 'Nulle', correct: true, feedback: 'Exact : les Noirs ont l’opposition et gardent les cases clés d4, e4, f4.' },
          { label: 'Les Blancs gagnent', correct: false, feedback: 'Le roi noir garde toutes les cases clés ; le roi blanc ne peut pas passer.' },
        ],
      },
      { kind: 'play', prompt: 'À toi de défendre avec les Noirs : empêche le pion blanc de passer.', fen: '8/8/4k3/8/8/4K3/4P3/8 b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 20, hint: 'Prends l’opposition : place ton roi face au roi blanc, une case entre eux.', success: 'Nulle tenue : l’opposition au bon moment.' },
    ],
  },
  {
    id: 'finales-carre',
    course: 'finales',
    title: 'La règle du carré',
    summary: 'Le roi peut-il rattraper le pion ?',
    minutes: 5,
    skills: ['finales', 'regle-du-carre'],
    steps: [
      {
        kind: 'explain',
        title: 'Un calcul sans calcul',
        text: 'Trace un carré depuis le pion jusqu’à sa case de promotion. Si le roi adverse peut **entrer dans ce carré** au coup suivant, il rattrape le pion ; sinon, le pion va à dame.\n\nPour le pion a4, le carré va de a4 à e8.',
        board: { fen: '8/8/8/8/P3k3/8/8/7K b - - 0 1', shapes: [{ orig: 'a4', dest: 'a8', brush: 'blue' }, { orig: 'a8', dest: 'e8', brush: 'blue' }, { orig: 'e8', dest: 'e4', brush: 'blue' }, { orig: 'e4', dest: 'a4', brush: 'blue' }] },
      },
      {
        kind: 'choice',
        prompt: 'Les Noirs ont le trait. Leur roi rattrape-t-il le pion ?',
        board: { fen: '8/8/8/8/P6k/8/8/7K b - - 0 1' },
        verify: { result: 'loss' },
        options: [
          { label: 'Non : le pion va à dame', correct: true, feedback: 'Exact : le roi h4 est trop loin du carré a4-e8.' },
          { label: 'Oui', correct: false, feedback: 'Compte : le pion a besoin de 4 coups, le roi noir de bien plus.' },
        ],
      },
      { kind: 'play', prompt: 'Avec les Noirs, rattrape le pion blanc.', fen: '8/8/8/8/P3k3/8/8/7K b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 8, hint: 'Va vers la case de promotion en diagonale : d5, puis c6…', success: 'Pion rattrapé : il ne reste que deux rois, nulle.' },
    ],
  },
  {
    id: 'finales-tours',
    course: 'finales',
    title: 'Finales de tours : Lucena et Philidor',
    summary: 'Les deux positions que tout joueur doit connaître.',
    minutes: 12,
    skills: ['finales', 'finales-de-tours'],
    steps: [
      {
        kind: 'explain',
        title: 'Gagner : la position de Lucena',
        text: 'Le pion est sur la 7e rangée, ton roi devant lui, coupé par la tour adverse. La méthode : chasser le roi adverse d’un échec, puis **construire un pont** — ta tour vient sur la 4e rangée pour s’interposer quand les échecs commenceront.\n\nRègle générale : **la tour se place derrière les pions passés**, les siens comme ceux de l’adversaire.',
        board: { fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', shapes: [{ orig: 'c1', dest: 'd1', brush: 'green' }, { orig: 'd1', dest: 'd4', brush: 'green' }] },
      },
      { kind: 'play', prompt: 'Position de Lucena : promeus ton pion contre l’ordinateur.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promote', maxMoves: 15, hint: 'Td1+ chasse le roi noir ; ensuite Td4 prépare le pont.', success: 'Pont construit, pion promu : Lucena maîtrisée.' },
      {
        kind: 'explain',
        title: 'Défendre : la position de Philidor',
        text: 'En défense, garde ta tour sur la **6e rangée** (la 3e en partant de ton camp) : le roi adverse ne peut pas avancer. Quand le pion arrive sur cette rangée, ta tour passe **derrière** et donne des échecs : le roi adverse n’a plus d’abri.',
        board: { fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', shapes: [{ orig: 'b6', dest: 'h6', brush: 'green' }] },
      },
      { kind: 'play', prompt: 'Position de Philidor : avec les Noirs, tiens la nulle.', fen: '4k3/R7/1r6/3KP3/8/8/8/8 b - - 0 1', orientation: 'black', goal: 'draw', maxMoves: 15, hint: 'Ta tour reste sur la 6e rangée tant que le pion n’y est pas arrivé.', success: 'Nulle tenue : la défense de Philidor.' },
    ],
  },
  {
    id: 'finales-mineures',
    course: 'finales',
    title: 'Fous et cavaliers en finale',
    summary: 'Le « mauvais fou » du pion de bord, et ce qu’un cavalier ne sait pas faire.',
    minutes: 7,
    skills: ['finales', 'pieces-mineures'],
    steps: [
      {
        kind: 'explain',
        title: 'Le fou de la mauvaise couleur',
        text: 'Avec un **pion de bord** (colonne a ou h) et un fou qui **ne contrôle pas la case de promotion**, la partie est souvent nulle : le roi adverse se réfugie dans le coin et ne peut plus en être chassé.\n\nUn **cavalier** ne peut pas « perdre un temps » (rester sur la même couleur de case en deux coups) : il est souvent maladroit contre un pion passé éloigné.',
        board: { fen: '7k/8/7P/6K1/8/8/8/3B4 w - - 0 1', shapes: [{ orig: 'h8', brush: 'red' }] },
      },
      {
        kind: 'choice',
        prompt: 'Le fou blanc contrôle-t-il la case de promotion h8 ?',
        board: { fen: '7k/8/7P/6K1/8/8/8/3B4 w - - 0 1', shapes: [{ orig: 'h8', brush: 'red' }] },
        options: [
          { label: 'Non : h8 est une case foncée, le fou est de cases claires', correct: true, feedback: 'Exact : c’est le « fou de la mauvaise couleur ». Avec un pion de tour, la théorie donne nulle si le roi noir tient le coin.' },
          { label: 'Oui', correct: false, feedback: 'Regarde la couleur de h8 (foncée) et celle du fou d1 (claire).' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Même structure, mais avec un fou de cases foncées. Les Blancs jouent : résultat ?',
        board: { fen: '7k/8/7P/6K1/8/8/8/4B3 w - - 0 1' },
        verify: { result: 'win' },
        options: [
          { label: 'Les Blancs gagnent', correct: true, feedback: 'Exact : ce fou contrôle h8 ; le roi noir sera chassé du coin (le moteur trouve un mat en 5).' },
          { label: 'Nulle', correct: false, feedback: 'Cette fois, le fou contrôle la case de promotion.' },
        ],
      },
    ],
  },
  {
    id: 'finales-dames',
    course: 'finales',
    title: 'Finales de dames : dame contre pion',
    summary: 'Quand la dame gagne, et le piège du pat.',
    minutes: 6,
    skills: ['finales', 'finales-de-dames'],
    steps: [
      {
        kind: 'explain',
        title: 'Dame contre pion sur la 7e rangée',
        text: 'Contre un pion **central** ou **de cavalier** sur la 7e rangée, la dame gagne : elle force le roi adverse à se placer **devant** son pion, ce qui donne un temps à son propre roi pour approcher.\n\nContre un pion **de fou** ou **de tour**, le défenseur a une ressource de **pat** : si son roi file dans le coin, prendre le pion ou s’approcher peut être impossible. C’est souvent nulle quand le roi attaquant est loin.',
      },
      {
        kind: 'choice',
        prompt: 'Pion central sur la 7e rangée, roi blanc loin. Les Blancs jouent : résultat ?',
        board: { fen: '7K/8/8/8/8/8/3pk3/7Q w - - 0 1' },
        verify: { result: 'win' },
        options: [
          { label: 'Les Blancs gagnent', correct: true, feedback: 'Exact : la dame force le roi devant le pion et gagne du temps à chaque fois.' },
          { label: 'Nulle', correct: false, feedback: 'Avec un pion central, il n’y a pas de ressource de pat.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Pion de fou sur la 7e rangée, roi blanc loin. Les Blancs jouent : résultat ?',
        board: { fen: '7K/8/8/8/8/8/2pk4/7Q w - - 0 1' },
        verify: { result: 'draw' },
        options: [
          { label: 'Nulle', correct: true, feedback: 'Exact : grâce au pat, le roi noir peut abandonner son pion momentanément.' },
          { label: 'Les Blancs gagnent', correct: false, feedback: 'Le pion de fou offre une défense de pat au roi noir.' },
        ],
      },
    ],
  },
  {
    id: 'finales-conversion',
    course: 'finales',
    title: 'Convertir un avantage et défendre',
    summary: 'Gagner une position gagnée, sauver une position difficile.',
    minutes: 6,
    skills: ['finales', 'conversion', 'defense'],
    steps: [
      {
        kind: 'explain',
        title: 'Deux arts complémentaires',
        text: 'Pour **convertir** un avantage matériel : échange les **pièces**, pas les pions ; active ton **roi** ; crée un pion passé ; ne te presse pas.\n\nPour **défendre** : cherche les **fous de couleurs opposées** (souvent nulle même avec un pion de moins), les **forteresses**, les ressources de **pat**, et échange les **pions** de l’adversaire.',
      },
      {
        kind: 'choice',
        prompt: 'Tu as une pièce de plus. Que faut-il échanger en priorité ?',
        options: [
          { label: 'Les pièces', correct: true, feedback: 'Exact : moins il reste de pièces, plus la pièce de plus est décisive.' },
          { label: 'Les pions', correct: false, feedback: 'Sans pions, une pièce mineure de plus ne suffit souvent pas pour mater.' },
        ],
      },
      {
        kind: 'choice',
        prompt: 'Fous de couleurs opposées, les Blancs ont un pion de plus. Les Blancs jouent : résultat ?',
        board: { fen: '8/2b5/4k3/8/3PK3/8/8/5B2 w - - 0 1' },
        verify: { result: 'draw' },
        options: [
          { label: 'Nulle', correct: true, feedback: 'Exact : le fou noir contrôle les cases foncées devant le pion ; il ne peut pas passer.' },
          { label: 'Les Blancs gagnent', correct: false, feedback: 'Le fou blanc ne peut jamais contester les cases foncées du fou noir.' },
        ],
      },
    ],
  },
];
