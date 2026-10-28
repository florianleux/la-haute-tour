import { isAnswerAccepted } from '../../shared/utils/answers'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { FIRST_SPELL, isCooldownBound, SPELL_IDS } from '../../shared/utils/spells'
import { rulesForFloor } from './rules'
import type { FloorRules } from './rules'
import type { SpellId } from '../../shared/utils/spells'
import type { DrawnTargetKind } from '../../shared/utils/teams'
import type { MissedPoolEntry, Reservation, User } from '../db/schema'

/**
 * La mécanique du jeu, sans base de données : ce que devient le joueur, dit une
 * fois, au même endroit que la spec le dit. Les fonctions d'ici ne lisent ni
 * n'écrivent — elles décident. Voir specs/mecanique.md.
 */

/**
 * Qui a envoyé la réponse : le joueur, ou son départ de la page. Nommé plutôt
 * que booléen — un `true` en dernier argument ne dit pas ce qu'il affirme.
 * Voir specs/anti-triche.md#perte-de-focus.
 */
export type AnswerSource = 'player' | 'focusLoss'

/** Voir specs/mecanique.md#machine-à-états — la seule définition de « où en est le joueur ». */
export type Phase = 'ascent' | 'cooldown' | 'recovery' | 'floorEnd' | 'deckEnd' | 'bossDoor' | 'bossFight' | 'gameOver'

export interface PhaseInput {
  user: Pick<User, 'lives' | 'currentFloor' | 'cooldownUntil' | 'bossHp'>
  /**
   * Une question encore en jeu, c'est-à-dire une réservation non résolue. Un
   * verdict, lui, n'en est plus une : il se lit sur l'écran de la phase suivante.
   */
  hasLiveReservation: boolean
  /**
   * Un verdict encore à lire : la réservation résolue, pas encore quittée. Au
   * palier, il sépare le verdict de la dernière question de la porte du boss.
   */
  holdsVerdict: boolean
  /** Questions vues à l'étage courant. */
  seen: number
  /** Questions que l'étage courant contient. */
  floorTotal: number
  /** Questions que l'étage d'au-dessus contient : zéro, il n'y a rien vers où monter. */
  nextFloorTotal: number
}

/**
 * Dérivée à chaque lecture, jamais stockée : elle se déduit des vies, de la
 * réservation, de la fin d'attente et du décompte des questions vues.
 */
export function phaseOf(input: PhaseInput, now: Date): Phase {
  const { user, hasLiveReservation, holdsVerdict, seen, floorTotal, nextFloorTotal } = input
  const floorDone = !hasLiveReservation && seen >= floorTotal

  // Un deck réduit, importé sur un seul étage : il s'arrête là, avant le boss —
  // le palier mènerait à un étage vide. Le dernier étage n'a jamais d'étage
  // au-dessus : son boss passe quand même. Voir specs/spec.md#glossaire (Fin du deck).
  if (floorDone && nextFloorTotal === 0 && user.currentFloor < FLOOR_COUNT) {
    return 'deckEnd'
  }

  // Le combat : en cours, ou battu et dont le terme reste à lire. Battu au
  // dernier étage, la partie s'arrête là. La défaite n'y retient pas : le joueur
  // sans vie retombe sur l'attente, d'où les épreuves tues — défaite et aucun
  // combat s'y lisent pareil. Voir specs/boss.md.
  const fight = bossFightState(user, false)

  if (floorDone && fight !== 'none') {
    return fight !== 'running' && user.currentFloor >= FLOOR_COUNT ? 'gameOver' : 'bossFight'
  }

  // Sans vie, l'attente puis le rattrapage — en fin d'étage aussi : ils passent
  // avant le combat, sur le Pool Échecs de l'étage. Voir specs/boss.md#cas-à-0-vie.
  if (user.lives <= 0) {
    const inCooldown = user.cooldownUntil !== null && now < user.cooldownUntil
    return inCooldown ? 'cooldown' : 'recovery'
  }

  if (!floorDone) {
    return 'ascent'
  }

  // Le palier : l'étage vu en entier, le boss pas encore affronté. Son verdict
  // quitté, le joueur est devant la porte. Voir specs/boss.md#arriver-devant-la-porte.
  return holdsVerdict ? 'floorEnd' : 'bossDoor'
}

/**
 * Le terme d'un combat : le boss à 0 PV, le joueur à 0 vie, ou le joueur à 0
 * vie au dernier combat, que le boss laisse passer.
 */
export type BossOutcome = 'victory' | 'defeat' | 'passed'

/**
 * L'état du combat de boss (`bossFightState`) : aucun, en cours, ou son terme.
 * Voir specs/spec.md#glossaire.
 */
export type BossFightState = 'none' | 'running' | BossOutcome

/** Les combats d'un boss, au plus : le dernier perdu, il laisse passer. */
export const BOSS_FIGHT_COUNT = 6

/**
 * Le boss d'un étage neuf : ni PV, ni combat compté, porte fermée. Ce que le
 * franchissement du palier, la remise à zéro d'un joueur et le recul d'un joueur
 * test sous son palier écrivent pareil.
 */
export const FRESH_BOSS = { bossHp: null, bossAttemptNumber: 0, doorOpened: false, doorSpot: 'door' } satisfies Partial<User>

/**
 * Où en est le combat. Seule lecture des PV stockés, qui portent le code :
 * null hors combat, positifs en cours, zéro boss battu — et les vies disent
 * alors s'il a été battu ou s'il a laissé passer. Une défaite efface les PV,
 * mais garde les épreuves du combat jusqu'au suivant : ce sont elles qui la
 * distinguent d'un boss jamais affronté. Voir specs/boss.md.
 */
export function bossFightState(user: Pick<User, 'bossHp' | 'lives'>, holdsTrials: boolean): BossFightState {
  if (user.bossHp === null) {
    return holdsTrials ? 'defeat' : 'none'
  }
  if (user.bossHp > 0) {
    return 'running'
  }
  return user.lives > 0 ? 'victory' : 'passed'
}

/** Le terme du combat, null tant qu'il n'en a pas. */
export function bossOutcome(state: BossFightState): BossOutcome | null {
  return state === 'none' || state === 'running' ? null : state
}

/**
 * Ouvrir un combat : le boss à ses PV pleins, un combat de plus au compte, et
 * le joueur entre avec ses vies, trois au plus — une vie de Vitalité ne passe
 * pas la porte. Voir specs/boss.md#tentatives-et-difficulté.
 */
export function bossFightOpening(
  user: Pick<User, 'lives' | 'bossAttemptNumber'>,
  rules: FloorRules,
): Pick<User, 'bossHp' | 'bossAttemptNumber' | 'lives'> {
  return { bossHp: rules.bossHp, bossAttemptNumber: user.bossAttemptNumber + 1, lives: Math.min(user.lives, rules.lives) }
}

/**
 * La défaite : les PV s'effacent et l'attente démarre, comme une chute en
 * ascension. Hors combat, les PV restent ce qu'ils étaient : aucun.
 */
export function bossDefeat(rules: FloorRules, now: Date): Pick<User, 'bossHp' | 'cooldownUntil' | 'cooldownStartedAt' | 'cooldownBaseMs'> {
  return { bossHp: null, ...cooldownFields(cooldownFrom(rules, now), now) }
}

/**
 * Ce qu'une épreuve jugée change au combat en cours. Juste, le boss perd un PV ;
 * fausse ou expirée, le joueur perd une vie. À zéro vie, la défaite — sauf au
 * dernier combat, où le boss laisse passer : ses PV tombent à zéro, sans
 * attente, et « Continuer » franchit le palier comme après une victoire.
 */
export function judgeTrial(
  user: Pick<User, 'bossHp' | 'lives' | 'bossAttemptNumber'>,
  correct: boolean,
  rules: FloorRules,
  now: Date,
): Partial<Pick<User, 'bossHp' | 'lives' | 'cooldownUntil' | 'cooldownStartedAt' | 'cooldownBaseMs'>> {
  if (correct) {
    // Une épreuve ne se juge qu'en combat : les PV y sont comptés.
    return { bossHp: (user.bossHp ?? 0) - 1 }
  }

  const lives = user.lives - 1

  if (lives > 0) {
    return { lives }
  }

  return user.bossAttemptNumber >= BOSS_FIGHT_COUNT
    ? { lives, bossHp: 0 }
    : { lives, ...bossDefeat(rules, now) }
}

/** Ce qu'il faut d'un effet pour dire s'il est encore porté. */
export interface BorneEffect {
  spell: SpellId
  anchoredAt: Date | null
  targetCooldownStartedAt: Date | null
}

/**
 * Cet effet est-il encore porté par ce joueur-là ? Un effet ancré ne vit que le
 * temps de la tentative qui l'a réveillé, et un sort lié à l'attente que le
 * temps de l'attente qu'il vise.
 *
 * Écrit une fois : l'écran montre ce que le joueur porte, et le tirage écarte
 * qui en porte déjà deux de négatifs — deux lectures de la même question, qui
 * doivent répondre pareil. Voir specs/bonus.md#limite-deffets-négatifs.
 */
export function isBorneBy(effect: BorneEffect, user: User): boolean {
  return actsOnCurrentCooldown(effect, user)
    && (effect.anchoredAt === null || stillRunning(effect.anchoredAt, user))
}

/**
 * Cette magie blanche retient-elle une place du plafond d'effets positifs ?
 * Oui tant qu'elle n'a pas encore agi — elle attend la prochaine tentative —
 * ou qu'elle agit sur l'attente où le joueur se tient : Répit, Indulgence et
 * Purge l'occupent pour cette attente-là, et c'est ce qui empêche d'effacer
 * l'attente ou de vider le Pool Échecs d'un coup.
 *
 * Plus étroit qu'`isBorneBy` : une magie blanche ancrée a donné à sa tentative
 * ce qu'elle avait à donner. Elle court encore — une Chronomancie tient sur le
 * rattrapage —, mais compter sa place jusqu'à la tentative suivante bloquerait
 * toute l'attente d'après. Pour les négatives, la lecture large protège la
 * cible ; pour les positives, elle la pénaliserait.
 * Voir specs/bonus.md#limite-deffets-positifs.
 */
export function countsTowardMaxBoons(effect: BorneEffect, user: User): boolean {
  return effect.anchoredAt === null && actsOnCurrentCooldown(effect, user)
}

/**
 * Un sort lié à l'attente a agi sur celle pendant laquelle il est parti, et
 * meurt avec elle : il n'attend aucune tentative, contrairement aux autres. Le
 * garder visible ensuite ferait annoncer une attente écourtée qu'il n'a pas
 * touchée, ou rallongerait un rattrapage qu'il n'a pas ouvert — c'est là ce que
 * « ponctuel » veut dire. Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
function actsOnCurrentCooldown(effect: BorneEffect, user: User): boolean {
  if (!isCooldownBound(effect.spell)) {
    return true
  }

  return user.cooldownStartedAt !== null
    && effect.targetCooldownStartedAt !== null
    && effect.targetCooldownStartedAt.getTime() === user.cooldownStartedAt.getTime()
}

/**
 * L'effet est ancré sur la tentative que le joueur joue *encore*.
 *
 * L'ancre seule en décide, et non les vies : une tentative ne se clôt qu'au
 * moment où la suivante s'ouvre — l'attente et le rattrapage qui la suivent en
 * font partie, et c'est ce que `closeAttempt()` inscrit. Une Chronomancie doit
 * donc tenir jusque sur les questions de rattrapage, jouées à zéro vie.
 * Voir server/utils/journey.ts et specs/bonus.md#ancrage-et-durée-de-vie.
 */
function stillRunning(anchoredAt: Date, user: User): boolean {
  return anchoredAt.getTime() === user.attemptStartedAt.getTime()
}

/**
 * Passé l'échéance, plus la marge que les règles laissent au trajet retour. Le
 * décompte que le joueur voyait est tombé à zéro un instant plus tôt.
 */
export function isExpired(expiresAt: Date, rules: FloorRules, now: Date): boolean {
  return now.getTime() > expiresAt.getTime() + rules.latencyGraceMs
}

/**
 * L'échéance de l'attente qui s'ouvre quand la dernière vie tombe. Un Mimic la
 * prend par le même chemin qu'une mauvaise réponse : « traité comme une perte de
 * dernière vie ordinaire » ne tient que si la durée vient d'un seul endroit.
 * Voir specs/bonus.md#coffre-et-mimic.
 */
export function cooldownFrom(rules: FloorRules, now: Date): Date {
  return new Date(now.getTime() + rules.cooldownMs)
}

export interface AnswerJudgement {
  correct: boolean
  /** Vraie quand l'échéance est passée, marge de latence comprise. */
  expired: boolean
  lifeLost: boolean
  livesAfter: number
  /** Échéance de l'attente qui démarre, null s'il reste des vies. */
  cooldownUntil: Date | null
  /** 1 quand la question entre dans les questions vues — jamais en rattrapage. */
  seenDelta: number
  /** Vraie quand la question rejoint le Pool Échecs de l'étage. */
  entersPool: boolean
}

export interface AnswerInput {
  user: Pick<User, 'lives' | 'currentFloor'>
  reservation: Pick<Reservation, 'mode' | 'expiresAt'>
  /** Toutes les formulations qui valident la question. */
  acceptedAnswers: string[]
  answer: string
  source: AnswerSource
  rules: FloorRules
}

/**
 * Une attente qui s'ouvre — ou qui se ferme : son échéance, son début, et ce
 * qu'elle dure.
 *
 * Les trois s'écrivent ensemble parce qu'ils se décrivent l'un l'autre. Une
 * échéance sans début serait une attente que Répit ne saurait plus recalculer ;
 * sans sa durée propre, il la recalculerait sur celle d'une autre — et une
 * attente de rattrapage manqué, plus courte, en ressortirait rallongée.
 *
 * `skipCooldown` fait exception et déplace l'échéance seule : il fait échoir une
 * attente, il n'en ouvre pas. Voir server/utils/lives.ts.
 */
export function cooldownFields(
  cooldownUntil: Date | null,
  now: Date,
): Pick<User, 'cooldownUntil' | 'cooldownStartedAt' | 'cooldownBaseMs'> {
  if (cooldownUntil === null) {
    return { cooldownUntil: null, cooldownStartedAt: null, cooldownBaseMs: null }
  }

  return {
    cooldownUntil,
    cooldownStartedAt: now,
    cooldownBaseMs: cooldownUntil.getTime() - now.getTime(),
  }
}

/**
 * Ce que coûte une réponse. Le timeout est une erreur ordinaire : vie perdue,
 * réponse affichée, question versée au Pool Échecs. En rattrapage, aucune vie
 * n'est en jeu et la progression ne bouge pas — la question était déjà vue.
 */
export function judgeAnswer(input: AnswerInput, now: Date): AnswerJudgement {
  const { user, reservation, acceptedAnswers, answer, source, rules } = input

  const expired = isExpired(reservation.expiresAt, rules, now)
  // En rattrapage, il n'y a pas de vie à prendre : quitter la page y compte faux
  // quoi qu'il y ait eu dans le champ, et le compteur de la question repart de
  // zéro. En ascension, la sanction est de perdre la main sur la question, pas
  // la bonne réponse déjà saisie. Voir specs/anti-triche.md#perte-de-focus.
  const leftRecovery = source === 'focusLoss' && reservation.mode === 'recovery'
  const correct = !expired && !leftRecovery && isAnswerAccepted(answer, acceptedAnswers)

  if (reservation.mode === 'recovery') {
    return {
      correct,
      expired,
      lifeLost: false,
      livesAfter: user.lives,
      cooldownUntil: null,
      seenDelta: 0,
      entersPool: false,
    }
  }

  if (correct) {
    return {
      correct,
      expired,
      lifeLost: false,
      livesAfter: user.lives,
      cooldownUntil: null,
      seenDelta: 1,
      entersPool: false,
    }
  }

  const livesAfter = user.lives - 1

  return {
    correct,
    expired,
    lifeLost: true,
    livesAfter,
    cooldownUntil: livesAfter <= 0 ? cooldownFrom(rules, now) : null,
    seenDelta: 1,
    entersPool: true,
  }
}

export interface LootQuestionInput {
  /** Le rang de la question dans les questions résolues de l'étage, à partir de 1. */
  position: number
  /** Questions que l'étage courant contient. */
  floorTotal: number
  mode: Reservation['mode']
}

/**
 * Une question loot ne se stocke pas : elle se déduit du rang qu'occupera la
 * question dans les questions résolues de l'étage. Le statut est donc attaché au
 * passage, pas à la question — repêchée plus tard, elle ne redonne rien.
 * Voir specs/bonus.md#question-loot.
 */
export function isLootQuestion(input: LootQuestionInput, rules: FloorRules): boolean {
  const { position, floorTotal, mode } = input

  // Le rattrapage ne fait pas avancer la progression : ses questions sont déjà
  // vues, elles ne comptent dans aucun rang.
  if (mode === 'recovery') {
    return false
  }

  // Jamais la dernière question restante de l'étage : un Mimic y opposerait le
  // palier à l'attente, alors que l'étage épuisé prime déjà sur les vies. Le
  // coffre est perdu quand le seuil tombe pile dessus, et c'est assumé.
  // Voir specs/mecanique.md#fin-détage.
  if (position >= floorTotal) {
    return false
  }

  return position % rules.questionsPerChest === 0
}

export interface ChestOutcome {
  mimic: boolean
  /** Le sort obtenu, null sur un Mimic. */
  spell: SpellId | null
}

/**
 * Ce qu'un coffre contenait. Le hasard vient de l'appelant : la mécanique décide,
 * elle ne tire pas — c'est ce qui la rend jouable sans horloge ni dé. Nommée pour
 * le geste qu'elle fait, jeter le dé, et non pour celui du joueur.
 *
 * Le Mimic n'attaque qu'après un sort : jamais sur le premier coffre ouvert
 * (`lastChest` null), jamais deux fois d'affilée. Son dé est jeté quand même :
 * le sort se tire toujours sur le second. Sans sort découvert, aucun dé :
 * c'est Vitalité.
 * Voir specs/bonus.md#coffre-et-mimic.
 */
export function rollChest(
  rules: FloorRules,
  random: () => number,
  lastChest: User['lastChest'],
  spellDiscovered: boolean,
): ChestOutcome {
  if (!spellDiscovered) {
    return { mimic: false, spell: FIRST_SPELL }
  }

  const mimicRoll = random()

  if (lastChest === 'spell' && mimicRoll < rules.mimicChance) {
    return { mimic: true, spell: null }
  }

  // Tiré au hasard dans le catalogue, indépendamment du stock déjà possédé :
  // les doublons sont illimités.
  return { mimic: false, spell: SPELL_IDS[Math.floor(random() * SPELL_IDS.length)] }
}

/**
 * La cible, tirée parmi les éligibles **classés par progression croissante** —
 * le moins avancé en tête. Le poids est le rang, jamais la progression réelle :
 * c'est ce qui borne le biais quel que soit l'écart, le premier valant *n* fois
 * le dernier et jamais cinquante fois.
 *
 * Une seule fonction, lue dans les deux sens : on tape le plus fort, on soutient
 * le plus faible. Sur un pool vide, personne — le sort part et ne fait rien.
 *
 * Le hasard vient de l'appelant, comme pour le coffre : la mécanique décide,
 * elle ne tire pas. Voir specs/bonus.md#tirage-de-la-cible.
 */
export function drawByRank<T>(ranked: T[], kind: DrawnTargetKind, random: () => number): T | null {
  if (!ranked.length) {
    return null
  }

  // Poids d'un rang : sa place en partant du haut pour un allié, du bas pour un
  // ennemi. Somme identique dans les deux sens, celle des n premiers entiers.
  const weightOf = (index: number): number => (kind === 'ally' ? ranked.length - index : index + 1)
  const total = (ranked.length * (ranked.length + 1)) / 2

  let drawn = random() * total

  for (const [index, candidate] of ranked.entries()) {
    drawn -= weightOf(index)

    if (drawn < 0) {
      return candidate
    }
  }

  // Un tirage à 1 exactement tomberait ici : la dernière part le reçoit.
  return ranked[ranked.length - 1]
}

export type PoolMove =
  | { leaves: true }
  | { leaves: false, poolSuccesses: number, lastFailedAt: Date }

/**
 * Le compteur d'une question du Pool Échecs après une réponse de rattrapage :
 * incrémenté sur une bonne réponse, remis à zéro sur une mauvaise, et le seuil
 * atteint fait sortir la question du pool.
 *
 * Une mauvaise réponse remonte aussi la date d'échec : ce qui résiste revient en
 * tête de la fiche de révision.
 */
export function movePoolCounter(
  entry: Pick<MissedPoolEntry, 'poolSuccesses' | 'lastFailedAt'>,
  correct: boolean,
  rules: FloorRules,
  now: Date,
): PoolMove {
  const poolSuccesses = correct ? entry.poolSuccesses + 1 : 0

  if (poolSuccesses >= rules.poolSuccessesToLeave) {
    return { leaves: true }
  }

  return {
    leaves: false,
    poolSuccesses,
    lastFailedAt: correct ? entry.lastFailedAt : now,
  }
}

/**
 * Le pool permet-il de tirer un rattrapage ? Deux règles chiffrées le disent — la
 * taille minimale du pool et le nombre de questions à tirer — et il faut les deux :
 * en dessous, l'attente se termine par une simple reprise.
 */
export function canDrawRecovery(poolSize: number, rules: FloorRules): boolean {
  return poolSize >= rules.poolSizeForRecovery && poolSize >= rules.recoveryQuestions
}

/**
 * Combien de bonnes réponses ce rattrapage exige. Une seule d'ordinaire — le
 * seuil vit dans les règles, et une Indulgence noire l'y porte au nombre de
 * questions tirées.
 *
 * Borné par ce que le rattrapage a réellement tiré : le pool s'arrête à ce qu'il
 * contient, et un perfect exigé sur plus de questions qu'il n'y en a serait
 * inatteignable. Voir specs/bonus.md#catalogue.
 */
export function recoveryThreshold(drawn: number, rules: FloorRules): number {
  return Math.min(rules.recoverySuccessesToResume, drawn)
}

export function resumesRecovery(successes: number, drawn: number, rules: FloorRules): boolean {
  return successes >= recoveryThreshold(drawn, rules)
}

/**
 * Le verdict du rattrapage est-il scellé — soit parce que le quota de bonnes
 * réponses est atteint (succès), soit parce qu'il est mathématiquement
 * impossible de l'atteindre avec les questions restantes (échec). Dans les deux
 * cas, les questions non jouées ne se jouent pas.
 * Voir specs/mecanique.md#déroulement-du-rattrapage.
 */
export function sealedRecovery(
  successes: number,
  played: number,
  total: number,
  rules: FloorRules,
): boolean {
  const threshold = recoveryThreshold(total, rules)
  const remaining = total - played
  return successes >= threshold || successes + remaining < threshold
}

export interface RecoveryVerdict {
  resumes: boolean
  livesAfter: number
  cooldownUntil: Date | null
}

/**
 * Ce que vaut un rattrapage une fois toutes ses questions jouées : une seule
 * bonne réponse rend les vies, aucune relance une attente plus courte.
 */
export function judgeRecovery(
  successes: number,
  drawn: number,
  rules: FloorRules,
  now: Date,
): RecoveryVerdict {
  const resumes = resumesRecovery(successes, drawn, rules)

  return {
    resumes,
    livesAfter: resumes ? rules.lives : 0,
    cooldownUntil: resumes ? null : new Date(now.getTime() + rules.cooldownAfterFailedRecoveryMs),
  }
}

/**
 * Le début de partie : étage 1, vies pleines selon le jeu de règles. Écrit à la
 * création de tout compte — réel, test ou de dev — comme à sa remise à zéro,
 * pour qu'aucun ne parte de la valeur par défaut de la colonne.
 * Voir specs/spec.md#glossaire.
 */
export function startOfGame(): Pick<User, 'currentFloor' | 'lives'> {
  return { currentFloor: 1, lives: rulesForFloor(1).lives }
}
