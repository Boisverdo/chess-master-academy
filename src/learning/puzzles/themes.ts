/** Thèmes tactiques : explication pédagogique et question socratique (contenu original). */
export interface ThemeInfo {
  key: string;
  label: string;
  /** Ce qu'est le motif, en une ou deux phrases. */
  idea: string;
  /** Question posée avant tout indice, pour faire réfléchir. */
  question: string;
}

export const THEMES: ThemeInfo[] = [
  { key: 'piece-en-prise', label: 'Pièce en prise', idea: 'Une pièce adverse n’est pas assez défendue : on peut la gagner simplement.', question: 'Quelles pièces adverses ne sont protégées par rien ? Lesquelles sont attaquées plus de fois qu’elles ne sont défendues ?' },
  { key: 'fourchette', label: 'Fourchette', idea: 'Un cavalier ou un pion attaque deux pièces à la fois ; l’adversaire ne peut en sauver qu’une.', question: 'Existe-t-il une case d’où un de tes cavaliers ou pions attaquerait deux pièces adverses en même temps ?' },
  { key: 'attaque-double', label: 'Attaque double', idea: 'Une même pièce (dame, tour, fou ou roi) crée deux menaces en un seul coup.', question: 'Quel coup créerait deux menaces à la fois, par exemple un échec et une attaque sur une pièce ?' },
  { key: 'clouage', label: 'Clouage', idea: 'Une pièce ne peut pas bouger sans exposer une pièce plus précieuse placée derrière elle, sur la même ligne.', question: 'Une pièce adverse est-elle alignée avec son roi ou sa dame ? Peux-tu exploiter cet alignement ?' },
  { key: 'enfilade', label: 'Enfilade', idea: 'On attaque une pièce précieuse ; quand elle s’écarte, la pièce située derrière elle sur la même ligne tombe.', question: 'Deux pièces adverses sont-elles alignées, la plus précieuse devant ?' },
  { key: 'attaque-decouverte', label: 'Attaque à la découverte', idea: 'En déplaçant une pièce, on ouvre la ligne d’une autre pièce qui attaque à son tour : deux menaces d’un coup.', question: 'Une de tes pièces masque-t-elle la ligne d’attaque d’une tour, d’un fou ou de ta dame ?' },
  { key: 'echec-decouverte', label: 'Échec à la découverte', idea: 'La pièce qui s’écarte démasque un échec ; elle est libre de faire ce qu’elle veut, car l’adversaire doit d’abord parer l’échec.', question: 'Si une de tes pièces s’écartait, ton autre pièce donnerait-elle échec au roi adverse ?' },
  { key: 'deviation', label: 'Déviation', idea: 'On force une pièce défensive à quitter son poste ; ce qu’elle protégeait devient vulnérable.', question: 'Quelle pièce adverse a une tâche de défense essentielle ? Comment l’en détourner ?' },
  { key: 'attraction', label: 'Attraction', idea: 'Souvent par un sacrifice, on attire une pièce (fréquemment le roi) sur une case où elle subira une tactique.', question: 'Sur quelle case aimerais-tu attirer le roi ou une pièce adverse ? Un sacrifice peut-il l’y forcer ?' },
  { key: 'sacrifice', label: 'Sacrifice', idea: 'On donne du matériel pour obtenir davantage : un mat, du matériel en retour ou une attaque décisive.', question: 'Si tu ignorais la valeur de tes pièces un instant, quel coup serait le plus dangereux pour l’adversaire ?' },
  { key: 'interference', label: 'Interférence', idea: 'On place une pièce entre une pièce adverse et ce qu’elle défend, pour couper la défense.', question: 'Deux pièces adverses se protègent-elles le long d’une ligne ? Peux-tu couper cette ligne ?' },
  { key: 'elimination-defenseur', label: 'Élimination du défenseur', idea: 'On prend ou on échange la pièce qui défendait une case ou une pièce importante.', question: 'Quelle pièce adverse tient toute la défense ? Peux-tu l’éliminer ?' },
  { key: 'combinaison', label: 'Combinaisons', idea: 'Plusieurs coups forcés s’enchaînent, souvent avec un sacrifice, pour atteindre un but précis.', question: 'Cherche les coups forcés : échecs, prises, menaces. Où mène la suite la plus forcée ?' },
  { key: 'mat-en-1', label: 'Mat en 1', idea: 'Un seul coup suffit pour mater.', question: 'Quels échecs as-tu ? Pour chacun, le roi adverse peut-il s’échapper, s’interposer ou prendre ?' },
  { key: 'mat-en-2', label: 'Mat en 2', idea: 'Un premier coup forcé prépare le mat au coup suivant.', question: 'Quelles cases de fuite a le roi adverse ? Quel premier coup les supprime ou force sa réponse ?' },
  { key: 'mat-en-3', label: 'Mat en 3', idea: 'Une suite de trois coups forcés aboutit au mat.', question: 'Commence par les échecs. Lequel ne laisse que des réponses forcées ?' },
  { key: 'mat-en-4', label: 'Mat en 4 ou plus', idea: 'Une longue suite forcée aboutit au mat : il faut calculer loin et précisément.', question: 'Quelles pièces participent à l’attaque ? Quelle suite d’échecs enferme le roi pas à pas ?' },
];

export const THEME_BY_KEY = new Map(THEMES.map((t) => [t.key, t]));

export const themeLabel = (key: string) => THEME_BY_KEY.get(key)?.label ?? key;
