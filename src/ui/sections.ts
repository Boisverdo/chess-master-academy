/** Les 12 sections de l'application (Module 15) et leur phase de livraison prévue. */
export const CURRENT_PHASE = 5;

export interface SectionDef {
  path: string;
  label: string;
  icon: string;
  phase: number;
  summary: string;
  planned: string[];
}

export const SECTIONS: SectionDef[] = [
  { path: '/', label: 'Accueil', icon: '⌂', phase: 2, summary: 'Votre point de départ.', planned: [] },
  {
    path: '/apprentissage', label: 'Mon apprentissage', icon: '◎', phase: 3,
    summary: 'Votre parcours personnalisé et la séance du jour.',
    planned: ['Évaluation initiale du niveau', 'Parcours adapté à vos faiblesses', 'Révision espacée des notions fragiles'],
  },
  {
    path: '/lecons', label: 'Leçons', icon: '❒', phase: 3,
    summary: 'Règles, principes, stratégie et finales, pas à pas.',
    planned: ['Règles fondamentales avec démonstrations', 'Principes stratégiques', 'Stratégie positionnelle', 'Finales'],
  },
  { path: '/echiquier', label: 'Échiquier interactif', icon: '♞', phase: 2, summary: 'Jouez une partie complète à deux, importez ou exportez un PGN.', planned: [] },
  {
    path: '/tactiques', label: 'Exercices tactiques', icon: '⚡', phase: 3,
    summary: 'Fourchettes, clouages, enfilades, mats en plusieurs coups…',
    planned: ['Exercices classés par thème et difficulté', 'Indices progressifs', 'Solution expliquée et enregistrée dans votre profil'],
  },
  {
    path: '/ouvertures', label: 'Ouvertures', icon: '⌥', phase: 3,
    summary: 'Les idées et les plans derrière chaque ouverture.',
    planned: ['7 ouvertures pour les Blancs, 7 défenses pour les Noirs', 'Pièges et erreurs typiques', 'Entraînement par répétition espacée'],
  },
  {
    path: '/jouer', label: "Jouer contre l'IA", icon: '♚', phase: 4,
    summary: 'Six niveaux, du débutant au très avancé.',
    planned: ['Moteur Stockfish intégré', 'Niveaux mesurés', 'Pendule facultative', 'Commentaires de l’entraîneur'],
  },
  {
    path: '/analyse', label: 'Analyse des parties', icon: '⌕', phase: 4,
    summary: 'Chaque coup évalué par le moteur et expliqué simplement.',
    planned: ['Imprécisions, erreurs, gaffes, occasions manquées', 'Moments critiques', '« Comprendre mon erreur »'],
  },
  {
    path: '/chesscom', label: 'Chess.com et mes parties', icon: '⇄', phase: 5,
    summary: 'Importez vos parties publiques Chess.com (facultatif).',
    planned: ['Recherche par pseudo, avec votre consentement', 'Import mois par mois', 'Analyse de votre historique'],
  },
  {
    path: '/entraineur', label: 'Mon entraîneur IA', icon: '✦', phase: 4,
    summary: 'Un entraîneur qui pose des questions avant de donner les réponses.',
    planned: ['Méthode socratique', 'Détection des mauvaises habitudes', 'Programme personnalisé'],
  },
  {
    path: '/progression', label: 'Ma progression', icon: '↗', phase: 6,
    summary: 'Statistiques, graphiques, objectifs et défis.',
    planned: ['Elo estimé (clairement indiqué comme estimation)', 'Progression par thème', 'Défis quotidiens et badges de maîtrise'],
  },
  { path: '/parametres', label: 'Paramètres', icon: '⚙', phase: 2, summary: 'Affichage et préférences.', planned: [] },
];
