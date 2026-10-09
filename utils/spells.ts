import type { SpellFace, SpellId } from '~~/shared/utils/spells'

/**
 * Le nom d'un sort, montré au joueur. Provisoire, contrairement à l'identifiant
 * que le serveur et le schéma partagent : renommer un sort ne doit coûter ni
 * migration ni refactor. Voir specs/bonus.md#catalogue.
 */
const SPELL_LABELS: Record<SpellId, string> = {
  VITALITY: 'Vitalité',
  RESPITE: 'Répit',
  CHRONOMANCY: 'Chronomancie',
  INDULGENCE: 'Indulgence',
  PURGE: 'Purge',
}

export function spellLabel(spell: SpellId): string {
  return SPELL_LABELS[spell]
}

/**
 * Le médaillon d'un sort, en trois variantes : blanche pour la magie blanche,
 * noire pour son miroir, et mixte — moitié blanche à gauche, moitié noire à
 * droite — pour montrer un sort sans présumer de la face qu'on lui donnera.
 * Chronomancie n'a pas encore le sien.
 */
const SPELL_IMAGE_SLUGS: Partial<Record<SpellId, string>> = {
  VITALITY: 'vitality',
  RESPITE: 'respite',
  INDULGENCE: 'indulgence',
  PURGE: 'purge',
}

type SpellImageVariant = SpellFace | 'mixed'

const SPELL_IMAGE_SUFFIXES: Record<SpellImageVariant, string> = {
  boon: 'good',
  curse: 'bad',
  mixed: 'mixed',
}

export function spellImage(spell: SpellId, variant: SpellImageVariant = 'mixed'): string | null {
  const slug = SPELL_IMAGE_SLUGS[spell]
  return slug ? `/images/spell-${slug}-${SPELL_IMAGE_SUFFIXES[variant]}.webp` : null
}

/** Ce qu'un sort fait, face par face. */
export interface SpellEffectLabels {
  /** Magie blanche : sur soi ou sur un allié. */
  boon: string
  /** Magie noire : sur un ennemi, systématiquement le miroir. */
  curse: string
}

/**
 * Ce que chaque sort fait, dit au joueur. Les deux faces sont montrées ensemble
 * même si une seule le concerne aujourd'hui : c'est ce qui fait comprendre que
 * le catalogue a un envers, avant que les équipes ne le rendent atteignable.
 *
 * Provisoire comme les libellés, et pour la même raison : ce sont des mots
 * d'écran. La règle chiffrée, elle, vit dans le jeu de règles — on dit « double »
 * ici parce que le facteur vaut deux, et une divergence d'étage se lirait dans
 * `rulesForFloor()`. Voir specs/bonus.md#catalogue.
 */
const SPELL_EFFECTS: Record<SpellId, SpellEffectLabels> = {
  VITALITY: {
    boon: 'Une vie de plus pour la prochaine tentative.',
    curse: 'Une vie de moins pour la prochaine tentative.',
  },
  RESPITE: {
    boon: 'Divise par deux l\'attente en cours, tout de suite.',
    curse: 'Double l\'attente en cours.',
  },
  CHRONOMANCY: {
    boon: 'Double le temps de réponse sur toute la prochaine tentative.',
    curse: 'Divise par deux le temps de réponse sur toute la prochaine tentative.',
  },
  INDULGENCE: {
    boon: 'Deux fois plus de questions tirées au prochain rattrapage.',
    curse: 'Le prochain rattrapage exige un sans-faute.',
  },
  PURGE: {
    boon: 'Sort une question au hasard du Pool Échecs, sans la rejouer.',
    curse: 'Remet à zéro les réussites d\'une question du Pool Échecs.',
  },
}

export function spellEffects(spell: SpellId): SpellEffectLabels {
  return SPELL_EFFECTS[spell]
}
