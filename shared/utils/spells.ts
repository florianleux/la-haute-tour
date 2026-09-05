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
 * Les sorts dont l'effet existe, et qui se lancent donc pour de bon. Un coffre
 * peut déjà donner les autres — ils rejoignent l'inventaire et attendent leur
 * ticket. Lancer un sort qui ne fait rien coûterait un exemplaire pour rien,
 * alors que « consommé qu'il produise un effet ou non » parle d'un sort dont
 * l'effet existe mais tombe à vide. Voir specs/bonus.md#livraison.
 */
export const CASTABLE_SPELL_IDS = ['VITALITY'] as const

export type CastableSpellId = typeof CASTABLE_SPELL_IDS[number]

export function isCastable(spell: SpellId): spell is CastableSpellId {
  return (CASTABLE_SPELL_IDS as readonly SpellId[]).includes(spell)
}

/**
 * Les deux faces d'un sort, et les deux seules : Soi et Allié reçoivent toujours
 * la magie blanche, Ennemi systématiquement le miroir noir. La face se grave sur
 * l'effet plutôt que d'être redéduite de la cible, qui aura changé d'équipe bien
 * avant que l'effet n'agisse. Voir specs/bonus.md#catégories-de-cible.
 */
export const SPELL_FACES = ['boon', 'curse'] as const

export type SpellFace = typeof SPELL_FACES[number]

/**
 * Un effet réduit à ce dont les règles ont besoin pour se moduler : quel sort,
 * quelle face. Ni qui l'a lancé, ni quand — un effet posé module de la même
 * façon, quelle qu'en soit l'histoire.
 */
export interface SpellEffect {
  spell: SpellId
  face: SpellFace
}

/**
 * Ce qu'un coffre devient, de sa pose à son ouverture : `closed` tant que le dé
 * n'est pas jeté, puis `mimic` ou le sort trouvé. Un seul champ pour tout le
 * cycle — deux ne pourraient que se contredire.
 */
export const CHEST_STATES = ['closed', 'mimic', ...SPELL_IDS] as const

export type ChestState = typeof CHEST_STATES[number]
