/**
 * Les leçons de Michel. Partagé pour la même raison que le catalogue des
 * Objets : le serveur date celles que le joueur a vues, l'écran les joue.
 *
 * Le camp, la chute (`fall`), le rattrapage (`recovery`), le Grimoire
 * (`spellbook`), la Plume de copiste (`quill`), la Boule de cristal
 * (`crystalBall`), le Filet à sangsues (`leechNet`), la question loot (`loot`), et le Champignon appétissant : la mise
 * en garde (`mushroom`) puis le commentaire d'après le repas (`mushroomEaten`).
 * Voir specs/spec.md (glossaire, « Leçon ») et
 * specs/ecrans.md#leçons-de-michel.
 */
export const LESSON_IDS = ['camp', 'fall', 'recovery', 'spellbook', 'quill', 'crystalBall', 'leechNet', 'loot', 'mushroom', 'mushroomEaten'] as const

export type LessonId = typeof LESSON_IDS[number]
