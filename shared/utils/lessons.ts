/**
 * Les leçons de Michel. Partagé pour la même raison que le catalogue des
 * Objets : le serveur date celles que le joueur a vues, l'écran les joue.
 *
 * Le camp, la chute (`fall`), le rattrapage (`recovery`) et le Grimoire
 * (`spellbook`). Voir specs/spec.md (glossaire, « Leçon ») et
 * specs/ecrans.md#leçons-de-michel.
 */
export const LESSON_IDS = ['camp', 'fall', 'recovery', 'spellbook'] as const

export type LessonId = typeof LESSON_IDS[number]
