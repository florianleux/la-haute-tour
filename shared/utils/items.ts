/**
 * Le catalogue des Objets : ce que le sac contient et qui n'est pas un sort.
 * Partagé pour la même raison que celui des sorts : le schéma le grave dans
 * ses contraintes, le serveur le donne, l'écran le nomme.
 *
 * Les identifiants seuls : les libellés vivent dans `utils/items.ts`, côté
 * écran. Voir specs/spec.md (glossaire, « Objet »).
 */
export const ITEM_IDS = ['CHEESE'] as const

export type ItemId = typeof ITEM_IDS[number]
