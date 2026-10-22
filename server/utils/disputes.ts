import { and, asc, eq, ne, notExists, notInArray } from 'drizzle-orm'
import { unlock } from './achievements'
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

/**
 * Une erreur contestable, telle que l'écran la connaît : son identifiant, et
 * rien d'autre. Ni l'énoncé ni la réponse — cette lecture reste ouverte pendant
 * le rattrapage, qui tire ses questions parmi ces erreurs-là, et en lire les
 * réponses y serait tricher, comme au Volumen. Voir server/utils/camp.ts.
 */
export interface DisputableError {
  questionId: string
}

/**
 * Les erreurs contestables du joueur. Voir specs/validation.md#quand.
 *
 * Une réponse vide n'en fait jamais partie : l'accepter ajouterait la chaîne
 * vide aux réponses acceptées, et validerait le vide pour tout le monde.
 */
export async function disputableErrors(db: Database, user: User): Promise<DisputableError[]> {
  const alreadyDisputed = db
    .select({ questionId: disputes.questionId })
    .from(disputes)
    .where(eq(disputes.userId, user.id))

  // Quitter la page n'est pas un motif d'arbitrage : le joueur a perdu la main,
  // pas été mal jugé. Ce qui est écarté, c'est la réponse que le départ de page
  // a soumise — la question vue et la perte de focus portent le même instant,
  // celui de submitAnswer —, pas la question. Voir specs/validation.md#quand.
  const lostFocus = db
    .select({ id: focusLosses.id })
    .from(focusLosses)
    .where(and(
      eq(focusLosses.userId, missedPool.userId),
      eq(focusLosses.questionId, missedPool.questionId),
      eq(focusLosses.lostAt, seenQuestions.seenAt),
    ))

  // `<> ''` écarte aussi une réponse absente : comparé à null, rien n'est vrai.
  return db
    .select({ questionId: missedPool.questionId })
    .from(missedPool)
    .leftJoin(seenQuestions, and(
      eq(seenQuestions.userId, missedPool.userId),
      eq(seenQuestions.questionId, missedPool.questionId),
    ))
    .where(and(
      eq(missedPool.userId, user.id),
      eq(missedPool.floor, user.currentFloor),
      ne(seenQuestions.submittedAnswer, ''),
      notInArray(missedPool.questionId, alreadyDisputed),
      notExists(lostFocus),
    ))
    .orderBy(asc(missedPool.lastFailedAt))
}

/**
 * Ouvre une contestation. Refusée si la question n'est pas parmi les erreurs
 * contestables (disputableErrors).
 */
export async function openDispute(
  db: Database,
  user: User,
  questionId: string,
  now: Date,
): Promise<void> {
  const disputable = await disputableErrors(db, user)

  if (!disputable.some(error => error.questionId === questionId)) {
    throw createError({ statusCode: 400, statusMessage: 'Question non contestable' })
  }

  await db.insert(disputes).values({ userId: user.id, questionId, createdAt: now })

  // Gravé ici et pas annoncé : la page Succès le montrera. Il n'y a pas d'état de
  // jeu à porter sur ce chemin, et un toast n'aurait de toute façon aucun sens sur
  // les deux autres succès de contestation, arbitrés des heures plus tard.
  // Voir specs/succes.md#affichage.
  await unlock(db, user, ['DISPUTE_OPENED'], now)
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

  // L'arbitrage et le contestataire partent dans le même lot : ils ne dépendent
  // pas l'un de l'autre, et la base est distante. Le joueur se lit quel que soit
  // le verdict — c'est lui qui porte son palmarès, et l'écriture du succès a
  // besoin de le connaître.
  const [, [player]] = await db.batch([
    db
      .update(disputes)
      .set({ status: verdict, settledAt: now })
      .where(eq(disputes.id, id)),
    db.select().from(users).where(eq(users.id, dispute.userId)).limit(1),
  ])

  // Le succès va au joueur qui a contesté, jamais à l'admin qui arbitre.
  await unlock(
    db,
    player,
    [verdict === 'accepted' ? 'DISPUTE_ACCEPTED' : 'DISPUTE_REJECTED'],
    now,
  )

  if (verdict === 'rejected') {
    return
  }

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
