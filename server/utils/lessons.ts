import { LESSON_IDS } from '../../shared/utils/lessons'
import type { User } from '../db/schema'
import type { LessonId } from '../../shared/utils/lessons'

/**
 * La colonne qui date chaque leçon sur le compte du joueur. Une leçon de plus
 * ajoute sa colonne ici. Voir specs/spec.md (glossaire, « Leçon »).
 */
export const LESSON_COLUMNS = {
  camp: 'campLessonAt',
  fall: 'fallLessonAt',
  recovery: 'recoveryLessonAt',
  spellbook: 'spellbookLessonAt',
} as const satisfies Record<LessonId, keyof User>

/** Les leçons que le joueur a déjà vues. */
export function lessonsDone(user: User): LessonId[] {
  return LESSON_IDS.filter(lesson => user[LESSON_COLUMNS[lesson]] !== null)
}
