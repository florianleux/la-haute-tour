import { SPELL_FACES, SPELL_IDS, isCooldownBound } from '~~/shared/utils/spells'
import type { SpellFace, SpellId } from '~~/shared/utils/spells'
import type { EffectStake, EffectView } from '~~/server/utils/effects'
import type { SpellLifetime } from '~~/server/utils/spellbook'
import type { ChestView, GameState } from '~~/server/utils/game'

// Les faux états des pages de test (pages/test/*), écrits une fois. `demoState`
// sert aussi de partie de base aux tests de l'écran (tests/app/phase.test.ts).

const CASTER_NAMES = ['Gandalf', 'Bilbo', 'Frodo', 'Aragorn', 'Éowyn', 'Legolas']

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * Ce que le serveur chiffrerait d'un effet en jeu, pour que l'infobulle d'un
 * sort ait un changement à montrer. Purge ne module rien.
 */
const DEMO_STAKES: Partial<Record<SpellId, Record<SpellFace, EffectStake>>> = {
  VITALITY: {
    boon: { rule: 'lives', before: 3, after: 4 },
    curse: { rule: 'lives', before: 3, after: 2 },
  },
  RESPITE: {
    boon: { rule: 'cooldownMs', before: 12 * 3_600_000, after: 6 * 3_600_000 },
    curse: { rule: 'cooldownMs', before: 12 * 3_600_000, after: 24 * 3_600_000 },
  },
  CHRONOMANCY: {
    boon: { rule: 'ascentTimerMs', before: 60_000, after: 120_000 },
    curse: { rule: 'ascentTimerMs', before: 60_000, after: 30_000 },
  },
  INDULGENCE: {
    boon: { rule: 'recoveryQuestions', before: 3, after: 6 },
    curse: { rule: 'recoverySuccessesToResume', before: 1, after: 3 },
  },
}

/**
 * Ce que le grimoire dit de la durée des sorts qui ne tiennent pas toute la
 * tentative — le grimoire vit côté serveur, la page de test ne le lit pas. Un
 * sort absent tient la tentative. Voir server/utils/spellbook.ts.
 */
const DEMO_LIFETIMES: Partial<Record<SpellId, SpellLifetime>> = {
  RESPITE: 'cooldown',
  INDULGENCE: 'recovery',
  PURGE: 'instant',
}

/** Un effet tiré au hasard ; la face aussi, sauf si la page la fixe. */
export function randomEffect(state: EffectView['state'], face: SpellFace = pick(SPELL_FACES)): EffectView {
  // Un sort lié à l'attente ne s'ancre jamais : « active », il n'existe pas.
  const spell = pick(state === 'active' ? SPELL_IDS.filter(id => !isCooldownBound(id)) : SPELL_IDS)

  return {
    spell,
    face,
    casterName: pick(CASTER_NAMES),
    state,
    lifetime: DEMO_LIFETIMES[spell] ?? 'attempt',
    // Comme le serveur : rien à chiffrer pour un effet qui n'agit pas encore —
    // un sort lié à l'attente agit dès le lancer. Voir server/utils/game.ts#stakeOf.
    stake: state === 'active' || isCooldownBound(spell) ? DEMO_STAKES[spell]?.[face] ?? null : null,
  }
}

/** Un coffre tiré au hasard : absent, fermé, ouvert sur un sort ou sur un mimic. */
export function randomChest(): ChestView | null {
  if (Math.random() < 0.5) {
    return null
  }

  const opened = Math.random() < 0.6
  const mimic = opened && Math.random() < 0.2

  return { opened, mimic, spell: opened && !mimic ? pick(SPELL_IDS) : null }
}

/** Une partie au repos — étage 1, vies pleines, rien en cours — que chaque page
 *  de test complète de ce qu'elle veut montrer. */
export function demoState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'ascent',
    floor: 1,
    lives: 3,
    maxLives: 3,
    question: null,
    verdict: null,
    cooldownUntil: null,
    recovery: null,
    floorSeen: 0,
    floorTotal: 0,
    attemptSeen: 0,
    seenTotal: 0,
    spellDiscovered: false,
    lessonsDone: ['camp'],
    chest: null,
    maintenance: false,
    effects: [],
    unlocked: [],
    ...overrides,
  }
}
