import { isAnswerAccepted } from './answers'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { isCooldownBound, SPELL_IDS } from '../../shared/utils/spells'
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
export type Phase = 'ascent' | 'cooldown' | 'recovery' | 'floorEnd' | 'gameOver'

export interface PhaseInput {
  user: Pick<User, 'lives' | 'currentFloor' | 'cooldownUntil'>
  /**
   * Une question encore en jeu, c'est-à-dire une réservation non résolue. Un
   * verdict, lui, n'en est plus une : il se lit sur l'écran de la phase suivante.
   */
  hasLiveReservation: boolean
  /** Questions vues à l'étage courant. */
  seen: number
  /** Questions que l'étage courant contient. */
  floorTotal: number
}

/**
 * Dérivée à chaque lecture, jamais stockée : elle se déduit des vies, de la
 * réservation, de la fin d'attente et du décompte des questions vues.
 */
export function phaseOf(input: PhaseInput, now: Date): Phase {
  const { user, hasLiveReservation, seen, floorTotal } = input

  // L'étage épuisé prime sur les vies : le Pool Échecs de cet étage est sur le
  // point d'être abandonné, donc il n'y a plus rien à y rattraper — et un joueur
  // qui n'a plus rien à monter n'a plus de vies à récupérer.
  if (!hasLiveReservation && seen >= floorTotal) {
    return user.currentFloor >= FLOOR_COUNT ? 'gameOver' : 'floorEnd'
  }

  if (user.lives <= 0) {
    const inCooldown = user.cooldownUntil !== null && now < user.cooldownUntil
    return inCooldown ? 'cooldown' : 'recovery'
  }

  return 'ascent'
}

/**
 * Le joueur a-t-il vu ne serait-ce qu'une question ? Un compte créé et jamais
 * ouvert se reconnaît à ça : premier étage, rien de vu, rien en main.
 *
 * Il n'existe pas de phase pour le dire — un joueur qui n'a jamais commencé est
 * en `ascent` comme les autres, l'écran de jeu l'y invite. C'est pourtant une
 * cible que rien n'atteindrait : le tirage l'écarte.
 * Voir specs/bonus.md#tirage-de-la-cible.
 */
export function hasStarted(
  user: Pick<User, 'currentFloor' | 'floorSeen'>,
  hasLiveReservation: boolean,
): boolean {
  return hasLiveReservation || user.currentFloor > 1 || user.floorSeen > 0
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
 * Voir specs/bonus.md#coffre-et-mimic.
 */
export function rollChest(rules: FloorRules, random: () => number): ChestOutcome {
  if (random() < rules.mimicChance) {
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
