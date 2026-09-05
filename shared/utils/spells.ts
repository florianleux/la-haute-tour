/**
 * Le catalogue des Sorts. Partagé parce que les deux côtés en ont besoin : le
 * schéma le grave dans ses contraintes, le serveur y tire ce qu'un coffre donne,
 * et l'écran s'y réfère pour nommer. Deux copies dériveraient.
 *
 * Les identifiants seuls : les libellés vivent dans `utils/spells.ts`, côté
 * écran, parce qu'eux sont provisoires et n'ont pas à traverser la frontière.
 * Voir specs/bonus.md#catalogue.
 */
export const SPELL_IDS = ['VITALITY', 'RESPITE'] as const

export type SpellId = typeof SPELL_IDS[number]

/**
 * Ce qu'un coffre devient, de sa pose à son ouverture : `closed` tant que le dé
 * n'est pas jeté, puis `mimic` ou le sort trouvé. Un seul champ pour tout le
 * cycle — deux ne pourraient que se contredire.
 */
export const CHEST_STATES = ['closed', 'mimic', ...SPELL_IDS] as const

export type ChestState = typeof CHEST_STATES[number]
