/**
 * « Séance du jour » : recommandations déterministes, fondées uniquement sur les données réelles
 * du joueur (niveau, leçons, révisions dues, résultats par thème).
 */
import type { Habit } from '../coach/habits';
import type { LessonProgress, Level, OpeningProgress } from '../storage/db';
import type { ThemeStat } from '../storage/learning';
import { COURSES } from './lessons';
import { findOpening } from './openings';
import { themeLabel } from './puzzles/themes';

export interface Recommendation {
  kind: 'lesson' | 'opening' | 'tactics' | 'assessment' | 'drill' | 'habit';
  title: string;
  reason: string;
  link: string;
}

export interface RecommendInput {
  level: Level;
  lessons: ReadonlyMap<string, LessonProgress>;
  openings: readonly OpeningProgress[];
  themeStats: readonly ThemeStat[];
  now: number;
  /** Habitudes détectées dans les parties analysées (Phase 4). */
  habits?: readonly Habit[];
  /** Positions de tes parties à retravailler, arrivées à échéance. */
  drillsDue?: number;
}

/** Action d'entraînement associée à chaque habitude récurrente. */
export const HABIT_ACTIONS: Record<string, { title: string; link: string }> = {
  'piece-en-prise': { title: 'Exercices : pièces en prise', link: '/tactiques?theme=piece-en-prise' },
  'mat-subi': { title: 'Leçon : avant chaque coup, échecs-prises-menaces', link: '/lecons/principes-verification' },
  'fourchette-subie': { title: 'Exercices : fourchettes', link: '/tactiques?theme=fourchette' },
  'attaque-double-subie': { title: 'Exercices : attaques doubles', link: '/tactiques?theme=attaque-double' },
  'echange-defavorable': { title: 'Leçon : la valeur des pièces', link: '/lecons/regles-valeur' },
  'occasion-manquee': { title: 'Exercices : combinaisons', link: '/tactiques?theme=combinaison' },
  'gain-manque': { title: 'Exercices : pièces en prise', link: '/tactiques?theme=piece-en-prise' },
  'erreur-de-calcul': { title: 'Exercices : combinaisons', link: '/tactiques?theme=combinaison' },
  ouverture: { title: 'Réviser tes ouvertures', link: '/ouvertures' },
  'dame-precoce': { title: 'Leçon : le développement des pièces', link: '/lecons/principes-developpement' },
  'developpement-lent': { title: 'Leçon : le développement des pièces', link: '/lecons/principes-developpement' },
  finale: { title: 'Finales : module prévu en Phase 6', link: '/apprentissage' },
};

export function recommend(input: RecommendInput): Recommendation[] {
  const out: Recommendation[] = [];

  // 0. Positions de tes propres parties à retravailler, puis habitude récurrente principale.
  if (input.drillsDue) out.push({ kind: 'drill', title: `Retravailler ${input.drillsDue} position${input.drillsDue > 1 ? 's' : ''} de tes parties`, reason: 'Tes propres erreurs sont les meilleurs exercices.', link: '/entraineur' });
  const habit = input.habits?.find((h) => h.recurrent && HABIT_ACTIONS[h.tag]);
  if (habit) out.push({ kind: 'habit', title: HABIT_ACTIONS[habit.tag]!.title, reason: `Habitude repérée : ${habit.label.toLowerCase()} (${habit.games} de tes ${habit.window} dernières parties analysées).`, link: HABIT_ACTIONS[habit.tag]!.link });

  // 1. Révisions d'ouvertures arrivées à échéance (la mémoire s'entretient au bon moment).
  const due = input.openings.filter((o) => o.due <= input.now).sort((a, b) => a.due - b.due);
  for (const o of due.slice(0, 2)) {
    const op = findOpening(o.openingId);
    if (op) out.push({ kind: 'opening', title: `Réviser : ${op.name}`, reason: o.lastSuccess ? 'La révision espacée arrive à échéance.' : 'Dernier essai difficile : on consolide.', link: `/ouvertures/${op.id}` });
  }

  // 2. Prochaine leçon, dans l'ordre adapté au niveau.
  const order = input.level === 'debutant-absolu' || input.level === 'debutant' ? ['regles', 'principes'] : ['principes', 'regles'];
  const lessons = order.flatMap((c) => COURSES.find((x) => x.id === c)!.lessons);
  const inProgress = lessons.find((l) => input.lessons.get(l.id)?.status === 'in-progress');
  const nextLesson = inProgress ?? lessons.find((l) => input.lessons.get(l.id)?.status !== 'done');
  if (nextLesson) {
    out.push({ kind: 'lesson', title: `Leçon : ${nextLesson.title}`, reason: inProgress ? 'Tu l’as commencée : termine-la.' : 'Prochaine étape de ton parcours.', link: `/lecons/${nextLesson.id}` });
  }

  // 3. Leçons terminées avec des erreurs : à refaire.
  const shaky = lessons.find((l) => {
    const p = input.lessons.get(l.id);
    return p?.status === 'done' && p.total > 0 && p.correct / p.total < 0.7;
  });
  if (shaky) out.push({ kind: 'lesson', title: `Revoir : ${shaky.title}`, reason: 'Plusieurs exercices manqués lors de ton premier passage.', link: `/lecons/${shaky.id}` });

  // 4. Tactique : le thème le plus faible (≥ 5 essais, < 60 % sans indice), sinon entraînement adapté.
  const weak = input.themeStats.find((s) => s.attempts >= 5 && s.rate < 0.6);
  if (weak) {
    out.push({ kind: 'tactics', title: `Exercices : ${themeLabel(weak.theme)}`, reason: `${Math.round(weak.rate * 100)} % de réussite sans indice sur tes ${weak.attempts} derniers essais.`, link: `/tactiques?theme=${weak.theme}` });
  } else {
    out.push({ kind: 'tactics', title: 'Exercices tactiques adaptés', reason: 'Quelques exercices à ton niveau entretiennent la vision tactique.', link: '/tactiques' });
  }

  // 5. Découvrir une ouverture si aucune n'a encore été pratiquée (pas pour les débutants absolus).
  if (input.openings.length === 0 && input.level !== 'debutant-absolu') {
    out.push({ kind: 'opening', title: 'Découvrir : Partie italienne', reason: 'Une ouverture idéale pour appliquer les principes.', link: '/ouvertures/italienne' });
  }
  return out;
}
