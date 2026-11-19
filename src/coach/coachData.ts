/** Rassemble tout ce que l'entraîneur sait du joueur (données réelles uniquement). */
import { db } from '../storage/db';
import { themeStats } from '../storage/learning';
import { getLessonProgress, getProfile } from '../storage/repo';
import { detectHabits } from './habits';

export async function loadCoachData(now = Date.now()) {
  const [profile, lessons, openings, attempts, games, drills] = await Promise.all([
    getProfile(),
    getLessonProgress(),
    db.openings.toArray(),
    db.attempts.toArray(),
    db.games.orderBy('createdAt').reverse().toArray(),
    db.drills.toArray(),
  ]);
  const puzzleAttempts = attempts.filter((a) => a.kind === 'puzzle');
  const analysed = games.filter((g) => g.analyzedAt && g.userColor && g.tags);
  const habits = detectHabits(analysed.map((g) => ({ gameId: g.id!, date: g.analyzedAt!, tags: g.tags! })));
  const drillsDue = drills.filter((d) => d.due <= now).sort((a, b) => a.due - b.due);
  return { profile, lessons, openings, attempts, puzzleAttempts, stats: themeStats(puzzleAttempts), games, analysed, habits, drills, drillsDue };
}

export type CoachData = Awaited<ReturnType<typeof loadCoachData>>;
