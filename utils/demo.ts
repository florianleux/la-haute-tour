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
    nextRecovery: null,
    floorSeen: 0,
    floorTotal: 0,
    streak: 0,
    seenTotal: 0,
    spellDiscovered: false,
    firstCastPending: false,
    lessonsDone: ['camp'],
    chest: null,
    maintenance: false,
    effects: [],
    unlocked: [],
    boss: null,
    ...overrides,
  }
}

/** Une question des bancs de l'écran de jeu, avec de quoi la juger et la rater. */
export interface BenchQuestion {
  statement: string
  answerLabel: string
  acceptedAnswers: string[]
  /** La saisie fausse que montre le banc du verdict. */
  wrongAnswer: string
}

/**
 * Les extrêmes du deck release, pour les bancs de l'écran de jeu
 * (pages/test/play.vue, pages/test/verdict.vue) : les trois énoncés les plus
 * courts, les trois plus longs, les trois bonnes réponses les plus longues, et
 * le plus long énoncé encore rappelé à sa taille normale sous le verdict (juste
 * sous le seuil de l'énoncé, `LONG_CHARS` dans utils/typography.ts). Si ceux-là
 * tiennent dans le cadre, tout le deck tient.
 *
 * Les saisies fausses varient pour que le verdict montre ses cas : vide (« (rien) »),
 * courte, ou à la longueur maximale (ANSWER_MAX_LENGTH) sur les énoncés les plus
 * serrés — le pire cas du verdict.
 */
export const BENCH_QUESTIONS: readonly BenchQuestion[] = [
  { statement: 'Que signifie TNT ?', answerLabel: 'TRINITROTOLUÈNE', acceptedAnswers: ['Trinitrotoluène'], wrongAnswer: 'Dynamite' },
  { statement: 'Qui a écrit "Kim" ?', answerLabel: 'KIPLING (Rudyard)', acceptedAnswers: ['Kipling', 'Rudyard Kipling', 'Kipling Rudyard'], wrongAnswer: 'Stevenson' },
  { statement: 'Qui a écrit "Jumanji" ?', answerLabel: 'VAN ALLSBURG (Chris)', acceptedAnswers: ['Van Allsburg', 'Chris Van Allsburg', 'Van Allsburg Chris'], wrongAnswer: '' },
  {
    statement: 'Quelle grande harpiste française d\'origine russe a enregistré avec Jean-Pierre Rampal une version "Concerto pour flûte et harpe de Mozart" qui est le disque classique le plus vendu de l\'histoire phonographique française ?',
    answerLabel: 'LASKINE (Lily)',
    acceptedAnswers: ['Laskine', 'Lily Laskine', 'Laskine Lily'],
    wrongAnswer: 'Marie-Claire Jamet, ou peut-être Nadia Boulanger, ou Ravel ?',
  },
  {
    statement: 'Durant quelle bataille de la deuxième guerre punique, ayant eu lieu en 216 av. J.-C., l\'armée d\'Hannibal a-t-elle vaincu l\'armée romaine en utilisant une des manœuvres tactiques les plus réussies de l\'histoire militaire ?',
    answerLabel: 'BATAILLE DE CANNES',
    acceptedAnswers: ['Cannes', 'Bataille de Cannes'],
    wrongAnswer: 'Bataille de Zama',
  },
  {
    statement: 'Quel officier français est principalement resté dans l’histoire pour avoir tenu une unité de 3700 militaires lors de la bataille de Bir-Hakeim face aux attaques répétées d’une Afrika Korps dirigée par Erwin Rommel ?',
    answerLabel: 'KŒNIG (Pierre)',
    acceptedAnswers: ['Kœnig', 'Koenig', 'Pierre Kœnig', 'Kœnig Pierre'],
    wrongAnswer: 'Leclerc',
  },
  {
    statement: 'Quelle femme de lettres suisse née à Vevey fut la protectrice et maîtresse de Jean-Jacques Rousseau ?',
    answerLabel: 'MADAME DE WARENS (Louise-Françoise-Éléonore de la Tour du Pil)',
    acceptedAnswers: ['Warens', 'Madame de Warens'],
    wrongAnswer: 'Madame de Staël',
  },
  {
    statement: 'Dans "Les Trois Mousquetaires", comment se nomme le capitaine des Mousquetaires du Roi ?',
    answerLabel: 'TRÉVILLE (Jean Armand du Peyrer, comte de Trois-Villes, dit)',
    acceptedAnswers: ['Tréville'],
    wrongAnswer: 'Athos',
  },
  {
    statement: 'Quel livre de 1997 de Philippe DELERM raconte les petits bonheurs quotidiens fut un immense succès commercial ?',
    answerLabel: 'La Première Gorgée de bière et autres plaisirs minuscules',
    acceptedAnswers: ['La Première Gorgée de bière et autres plaisirs minuscules', 'La Première Gorgée de bière'],
    wrongAnswer: 'Les Petits Bonheurs',
  },
  {
    statement: 'Quel prince français, petit-fils de Charles X et dernier prétendant légitime au trône de France, jura serment au drapeau blanc au lieu du tricolore ?',
    answerLabel: 'COMTE DE CHAMBORD (Henri d\'Artois)',
    acceptedAnswers: ['Chambord', 'Comte de Chambord', 'Henri d\'Artois', 'Henri d\'Artois Chambord', 'Chambord Henri d\'Artois'],
    wrongAnswer: 'Le duc d\'Orléans, ou peut-être Louis-Philippe, ou Napoléon ?',
  },
]

/** Une question des bancs au hasard. */
export function randomBenchQuestion(): BenchQuestion {
  return pick(BENCH_QUESTIONS)
}
