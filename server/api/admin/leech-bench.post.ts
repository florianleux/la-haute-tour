import { and, eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { acceptedAnswers, items, pocketSpells, reservations, seenQuestions, users } from '~~/server/db/schema'
import { serveNextQuestion, submitAnswer } from '~~/server/utils/game'
import { LESSON_COLUMNS } from '~~/server/utils/lessons'
import { requirePlayer, resetPlayer } from '~~/server/utils/players'
import { rulesForFloor } from '~~/server/utils/rules'
import { LESSON_IDS } from '~~/shared/utils/lessons'
import { FIRST_SPELL } from '~~/shared/utils/spells'

// Les échecs de rattrapage posés sur les premières questions vues, ratées en
// tête : de quoi voir le tri, une égalité et une question sous le seuil. Toutes
// passent fausses, comme en vrai : seule une question ratée va au rattrapage.
// Celles que la partie a vraiment ratées restent au Pool Échecs, les autres en
// sont sorties.
const RECOVERY_FAILURES = [5, 4, 3, 3, 2]

/**
 * Le banc des Sangsues (pages/test/leeches.vue). Remet le joueur servi juste
 * avant le coffre du Filet à sangsues, par le vrai jeu : partie neuve, Plume et
 * Vitalité au sac, toutes les leçons vues sauf celle du Filet, puis une
 * ascension jouée jusqu'à la première question loot, réussie. Il arrive sur son
 * verdict, coffre fermé, à une vie : une erreur le ramène ensuite au camp, où
 * Michel parle du Filet et où le Volumen a ses Sangsues.
 *
 * Admin seulement. Le joueur servi est le joueur test incarné : hors
 * développement, la partie d'un vrai compte ne se jette pas pour un banc.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const player = await requireAuth(event)

  if (!player.isTest && !import.meta.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Incarne un joueur test' })
  }

  const db = useDatabase()
  const now = new Date()
  const rules = rulesForFloor(player.currentFloor)

  await resetPlayer(db, player, now)
  await db.batch([
    db.update(users).set({
      introDoneAt: now,
      ...Object.fromEntries(LESSON_IDS.filter(lesson => lesson !== 'leechNet').map(lesson => [LESSON_COLUMNS[lesson], now])),
    }).where(eq(users.id, player.id)),
    db.insert(items).values({ userId: player.id, item: 'SCRIBE_QUILL', obtainedAt: now }),
    db.insert(pocketSpells).values({ userId: player.id, spell: FIRST_SPELL, obtainedAt: now }),
  ])

  // Les erreurs d'abord, jusqu'à la dernière vie ; le reste juste, jusqu'au
  // coffre. Rien ne relit le joueur pour lui : servir et répondre le font.
  for (let played = 1; played <= rules.questionsPerChest; played++) {
    await serveNextQuestion(db, await requirePlayer(db, player.id), now)
    const [reserved] = await db
      .select({ text: acceptedAnswers.text })
      .from(reservations)
      .innerJoin(acceptedAnswers, eq(acceptedAnswers.questionId, reservations.questionId))
      .where(eq(reservations.userId, player.id))
      .limit(1)
    await submitAnswer(db, await requirePlayer(db, player.id), played < rules.lives ? '' : reserved.text, now)
  }

  const seen = await db
    .select({ questionId: seenQuestions.questionId, correct: seenQuestions.correct })
    .from(seenQuestions)
    .where(eq(seenQuestions.userId, player.id))
  const missedFirst = seen.toSorted((a, b) => Number(a.correct) - Number(b.correct))

  for (const [index, recoveryFailures] of RECOVERY_FAILURES.entries()) {
    await db
      .update(seenQuestions)
      .set({ recoveryFailures, correct: false })
      .where(and(eq(seenQuestions.userId, player.id), eq(seenQuestions.questionId, missedFirst[index].questionId)))
  }

  return { ok: true }
})
