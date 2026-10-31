/**
 * Le catalogue des Objets : ce que le sac contient et qui n'est pas un sort.
 * Partagé pour la même raison que celui des sorts : le schéma le grave dans
 * ses contraintes, le serveur le donne, l'écran le nomme.
 *
 * Les identifiants seuls : les libellés vivent dans `utils/items.ts`, côté
 * écran. Voir specs/spec.md (glossaire, « Objet »).
 */
export const ITEM_IDS = ['CHEESE', 'JULIEN_CARD'] as const

export type ItemId = typeof ITEM_IDS[number]

/**
 * La relique que chaque boss laisse, par étage : un Objet du sac, sans effet.
 * Un étage sans entrée ne laisse rien tant que son boss n'existe pas.
 * Voir specs/boss.md#récompense.
 */
export const BOSS_RELICS: Readonly<Partial<Record<number, ItemId>>> = {
  1: 'JULIEN_CARD',
}
