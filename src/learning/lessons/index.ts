import { PRINCIPES } from './principes';
import { REGLES } from './regles';
import type { Course, Lesson } from './types';

export const COURSES: Course[] = [
  { id: 'regles', module: 'Module 2', title: 'Les règles du jeu', description: 'Tout ce qu’il faut pour jouer une partie complète, de l’échiquier au pat.', lessons: REGLES },
  { id: 'principes', module: 'Module 3', title: 'Premiers principes', description: 'Penser avant de jouer, prendre le centre, développer, protéger son roi.', lessons: PRINCIPES },
];

export const ALL_LESSONS: Lesson[] = COURSES.flatMap((c) => c.lessons);

export function findLesson(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}
