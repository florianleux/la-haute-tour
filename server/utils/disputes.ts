import { and, asc, eq, ne, notInArray } from 'drizzle-orm'
import { grantLife } from './lives'
import {
  acceptedAnswers,
  disputes,
  focusLosses,
  missedPool,
  questions,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import type { Database } from '../db/client'
import type { User } from '../db/schema'

/**
 * La contestation : le joueur affirme que sa réponse valait la bonne, l'admin
 * tranche. Ce fichier décide de ce qui est contestable et de ce qu'accepter
 * change ; l'arbitrage lui-même est humain. Voir specs/validation.md#contestation.
 */

export interface ContestableError {
  questionId: string
  statement: string
  /** La réponse affichée de la question — celle que le joueur a lue sur son échec. */
  answerLabel: string
  submittedAnswer: string
}

/**
 * Les erreurs que le joueur peut encore contester : toutes celles de son Pool
 * Échecs sur l'étage courant, une seule fois par question.
 *
 * Une réponse vide n'en fait jamais partie : l'accepter ajouterait la chaîne
 * vide aux réponses acceptées, et validerait le vide pour tout le monde. Une
 * question résolue par un départ de page non plus.
 */
export async function contestableErrors(db: Database, user: User): Promise<ContestableError[]> {
  const alreadyDisputed = db
    .select({ questionId: disputes.questionId })
    .from(disputes)
    .where(eq(disputes.userId, user.id))

  // Quitter la page n'est pas un motif d'arbitrage : le joueur a perdu la main,
  // pas été mal jugé. Voir specs/anti-triche.md#perte-de-focus.
  const lostFocus = db
    .select({ questionId: focusLosses.questionId })
    .from(focusLosses)
    .where(eq(focusLosses.userId, user.id))

  const rows = await db
    .select({
      questionId: missedPool.questionId,
      statement: questions.statement,
      answerLabel: questions.answerLabel,
      submittedAnswer: seenQuestions.submittedAnswer,
    })
    .from(missedPool)
    .innerJoin(questions, eq(questions.id, missedPool.questionId))
    .leftJoin(seenQuestions, and(
      eq(seenQuestions.userId, missedPool.userId),
      eq(seenQuestions.questionId, missedPool.questionId),
    ))
    .where(and(
      eq(missedPool.userId, user.id),
      eq(missedPool.floor, user.currentFloor),
      ne(seenQuestions.submittedAnswer, ''),
      notInArray(missedPool.questionId, alreadyDisputed),
      notInArray(missedPool.questionId, lostFocus),
    ))
    .orderBy(asc(missedPool.lastFailedAt))

  return rows
    .filter((row): row is ContestableError => row.submittedAnswer !== null)
}

/**
 * Ouvre une contestation. Refusée si la question n'est pas contestable — réponse
 * vide, erreur d'une tentative passée, ou question déjà contestée : deux
 * contestations sur la même question n'ajoutent rien à arbitrer.
 */
export async function openDispute(
  db: Database,
  user: User,
  questionId: string,
  now: Date,
): Promise<void> {
  const contestable = await contestableErrors(db, user)

  if (!contestable.some(error => error.questionId === questionId)) {
    throw createError({ statusCode: 400, statusMessage: 'Question non contestable' })
  }

  await db.insert(disputes).values({ userId: user.id, questionId, createdAt: now })
}

export interface PendingDispute {
  id: number
  questionId: string
  username: string
  statement: string
  answerLabel: string
  /** Ce que le joueur avait répondu, face aux réponses acceptées. */
  submittedAnswer: string
  acceptedAnswers: string[]
}

/**
 * La file d'arbitrage : ce que l'admin voit dès sa connexion. Une seule requête,
 * les réponses acceptées comprises — la file est courte, mais elle est lue à
 * chaque ouverture du dashboard.
 */
export async function pendingDisputes(db: Database): Promise<PendingDispute[]> {
  const rows = await db
    .select({
      id: disputes.id,
      questionId: disputes.questionId,
      username: users.username,
      statement: questions.statement,
      answerLabel: questions.answerLabel,
      submittedAnswer: seenQuestions.submittedAnswer,
      accepted: acceptedAnswers.text,
    })
    .from(disputes)
    .innerJoin(users, eq(users.id, disputes.userId))
    .innerJoin(questions, eq(questions.id, disputes.questionId))
    .innerJoin(seenQuestions, and(
      eq(seenQuestions.userId, disputes.userId),
      eq(seenQuestions.questionId, disputes.questionId),
    ))
    .leftJoin(acceptedAnswers, eq(acceptedAnswers.questionId, disputes.questionId))
    // Les joueurs test n'entrent pas dans la file : elle sert à arbitrer de
    // vraies parties. Voir specs/admin.md#joueurs-test.
    .where(and(eq(disputes.status, 'pending'), eq(users.isTest, false)))
    .orderBy(asc(disputes.createdAt), asc(acceptedAnswers.id))

  const queue = new Map<number, PendingDispute>()

  for (const row of rows) {
    const dispute = queue.get(row.id) ?? {
      id: row.id,
      questionId: row.questionId,
      username: row.username,
      statement: row.statement,
      answerLabel: row.answerLabel,
      submittedAnswer: row.submittedAnswer ?? '',
      acceptedAnswers: [],
    }

    if (row.accepted !== null) {
      dispute.acceptedAnswers.push(row.accepted)
    }

    queue.set(row.id, dispute)
  }

  return [...queue.values()]
}

export type DisputeVerdict = 'accepted' | 'rejected'

/**
 * L'arbitrage. Rejeter clôt la contestation, sans autre effet.
 *
 * Accepter, c'est établir que le joueur avait raison : sa réponse rejoint les
 * réponses acceptées **pour tous les joueurs**, son verdict devient juste, la
 * question sort de son Pool Échecs — la garder ferait payer deux fois une erreur
 * d'arbitrage — et une vie lui revient. La progression, elle, ne bouge pas : la
 * question reste vue.
 */
export async function settleDispute(
  db: Database,
  id: number,
  verdict: DisputeVerdict,
  now: Date,
): Promise<void> {
  const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1)

  if (!dispute) {
    throw createError({ statusCode: 404, statusMessage: 'Contestation introuvable' })
  }

  if (dispute.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'Contestation déjà arbitrée' })
  }

  await db
    .update(disputes)
    .set({ status: verdict, settledAt: now })
    .where(eq(disputes.id, id))

  if (verdict === 'rejected') {
    return
  }

  const [player] = await db.select().from(users).where(eq(users.id, dispute.userId)).limit(1)
  const [seen] = await db
    .select()
    .from(seenQuestions)
    .where(and(
      eq(seenQuestions.userId, dispute.userId),
      eq(seenQuestions.questionId, dispute.questionId),
    ))
    .limit(1)

  await db.batch([
    // Pour tous les joueurs : ce que l'admin vient de reconnaître ne peut pas
    // rester faux pour le suivant.
    db.insert(acceptedAnswers).values({
      questionId: dispute.questionId,
      text: seen.submittedAnswer ?? '',
    }),
    db
      .update(seenQuestions)
      .set({ correct: true })
      .where(and(
        eq(seenQuestions.userId, dispute.userId),
        eq(seenQuestions.questionId, dispute.questionId),
      )),
    // Le verdict encore à l'écran suit la correction.
    db
      .update(reservations)
      .set({ correct: true })
      .where(and(
        eq(reservations.userId, dispute.userId),
        eq(reservations.questionId, dispute.questionId),
      )),
    db.delete(missedPool).where(and(
      eq(missedPool.userId, dispute.userId),
      eq(missedPool.questionId, dispute.questionId),
    )),
  ])

  // La vie rendue est le même geste que celui de l'administration : une seule
  // définition, dans lives.ts.
  await grantLife(db, player)
}
