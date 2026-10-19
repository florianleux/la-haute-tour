/**
 * Les leçons de Michel. Partagé pour la même raison que le catalogue des
 * Objets : le serveur date celles que le joueur a vues, l'écran les joue.
 *
 * Seule la leçon du camp existe ; la chute (`fall`), le rattrapage
 * (`recovery`) et le Grimoire (`spellbook`) s'ajouteront ici avec leur
 * colonne. Voir specs/spec.md (glossaire, « Leçon ») et
 * specs/ecrans.md#leçons-de-michel.
 */
export const LESSON_IDS = ['camp'] as const

export type LessonId = typeof LESSON_IDS[number]
