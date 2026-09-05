import { isAnswerAccepted } from './answers'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { SPELL_IDS } from '../../shared/utils/spells'
import type { FloorRules } from './rules'
import type { SpellId } from '../../shared/utils/spells'
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
    const waiting = user.cooldownUntil !== null && now < user.cooldownUntil
    return waiting ? 'cooldown' : 'recovery'
  }

  return 'ascent'
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

/** Une seule bonne réponse suffit à repartir — le seuil vit dans les règles. */
export function resumesRecovery(successes: number, rules: FloorRules): boolean {
  return successes >= rules.recoverySuccessesToResume
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
export function judgeRecovery(successes: number, rules: FloorRules, now: Date): RecoveryVerdict {
  const resumes = resumesRecovery(successes, rules)

  return {
    resumes,
    livesAfter: resumes ? rules.lives : 0,
    cooldownUntil: resumes ? null : new Date(now.getTime() + rules.cooldownAfterFailedRecoveryMs),
  }
}
