import { formatDuration, formatTime } from './date'
import type { SpellFace, SpellId } from '~~/shared/utils/spells'
import type { EffectStake, EffectView } from '~~/server/utils/effects'
import type { StakeRule } from '~~/server/utils/spellbook'
import type { GameState } from '~~/server/utils/game'

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

export type SpellImageVariant = SpellFace | 'mixed'

const SPELL_IMAGE_SUFFIXES: Record<SpellImageVariant, string> = {
  boon: 'good',
  curse: 'bad',
  mixed: 'mixed',
}

export function spellImage(spell: SpellId, variant: SpellImageVariant = 'mixed'): string | null {
  const slug = SPELL_IMAGE_SLUGS[spell]
  return slug ? `/images/spell-${slug}-${SPELL_IMAGE_SUFFIXES[variant]}.webp` : null
}

/** Le nom de chaque face, celui du glossaire. Voir specs/spec.md. */
const FACE_LABELS: Record<SpellFace, string> = {
  boon: 'Magie blanche',
  curse: 'Magie noire',
}

export function spellFaceLabel(face: SpellFace): string {
  return FACE_LABELS[face]
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
    boon: 'Une vie de plus sur la tentative.',
    curse: 'Une vie de moins sur la tentative.',
  },
  RESPITE: {
    boon: 'Divise par deux l\'attente en cours, tout de suite.',
    curse: 'Double l\'attente en cours.',
  },
  CHRONOMANCY: {
    boon: 'Double le temps de réponse sur toute la tentative.',
    curse: 'Divise par deux le temps de réponse sur toute la tentative.',
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

/**
 * Ce dont une infobulle ou une mention parle : un effet posé sur le joueur, ou
 * un sort en poche — le résultat d'un coffre, qui n'a pas encore de face. Un
 * seul champ pour que le sort et l'effet ne puissent pas se contredire.
 */
export type SpellSubject = EffectView | SpellId

export function splitSubject(subject: SpellSubject): { spell: SpellId, effect: EffectView | null } {
  return typeof subject === 'string'
    ? { spell: subject, effect: null }
    : { spell: subject.spell, effect: subject }
}

/** Ce qu'un sort a changé, en chiffres : l'avant de l'étage, l'après joué. */
export interface SpellStake {
  label: string
  before: string
  after: string
}

/** Le nom de chaque règle qu'un sort peut changer, dit au joueur. */
const STAKE_LABELS: Record<StakeRule, string> = {
  lives: 'Vies',
  ascentTimerMs: 'Temps de réponse',
  cooldownMs: 'Attente',
  recoveryQuestions: 'Questions au rattrapage',
  recoverySuccessesToResume: 'Bonnes réponses exigées',
}

/** Les règles qui se comptent en millisecondes ; les autres sont des nombres. */
const DURATION_RULES: ReadonlySet<StakeRule> = new Set(['ascentTimerMs', 'cooldownMs'])

/**
 * Ce que le serveur a chiffré d'un effet, mis en mots. Deux Chronomancies
 * montrent le même 60 s → 240 s : c'est le timer que le joueur a vraiment.
 * Voir server/utils/game.ts#stakeOf.
 */
export function spellStake(stake: EffectStake): SpellStake {
  const format = (value: number): string => DURATION_RULES.has(stake.rule) ? formatDuration(value) : String(value)
  return { label: STAKE_LABELS[stake.rule], before: format(stake.before), after: format(stake.after) }
}

/**
 * Jusqu'à quand l'effet agit, ancré sur ce que le joueur peut compter : ses
 * vies, l'heure de fin de son attente. Une tentative n'a pas de date de fin —
 * elle finit à la dernière vie perdue, alors on dit combien il en reste ; à
 * zéro vie elle court encore, jusqu'au bout du rattrapage.
 *
 * Seul un effet qui tient la tentative attend celle-ci : les autres agissent dès
 * le lancer, sur l'attente où le joueur se tient, et ne sont jamais « à venir ».
 * Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
export function spellLifetime(effect: EffectView, state: GameState): string {
  switch (effect.lifetime) {
    case 'attempt':
      if (effect.state === 'pending') {
        return 'S\'active à ta prochaine tentative'
      }
      return state.lives > 0
        ? `Jusqu'à ta dernière vie perdue (encore ${state.lives} ♥)`
        : 'Jusqu\'à la fin de ton rattrapage'
    case 'wait':
      // Porté jusqu'au bout du rattrapage qui suit, alors que l'attente est
      // échue : une heure de fin au futur serait déjà passée.
      if (!state.cooldownUntil) {
        return 'Jusqu\'à la fin de ton attente'
      }
      return state.phase === 'cooldown'
        ? `Jusqu'à la fin de ton attente (${formatTime(state.cooldownUntil)})`
        : `Sur ton attente, terminée à ${formatTime(state.cooldownUntil)}`
    case 'recovery':
      return 'Jusqu\'à la fin de ton prochain rattrapage'
    case 'instant':
      return 'Effet immédiat, déjà appliqué'
  }
}
