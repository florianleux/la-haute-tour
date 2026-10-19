import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { items, users } from '~~/server/db/schema'
import { serveNextQuestion, submitAnswer } from '~~/server/utils/game'
import { LESSON_COLUMNS } from '~~/server/utils/lessons'
import { skipCooldown } from '~~/server/utils/lives'
import { requirePlayer, resetPlayer } from '~~/server/utils/players'
import { LESSON_IDS } from '~~/shared/utils/lessons'
import { TEAM_IDS } from '~~/shared/utils/teams'

// La guilde à donner au joueur pour ce passage : sans équipe, la leçon
// sauterait la bannière et les Haut-faits. La leçon à revoir : celle du camp
// par défaut, celle de la chute ou celle du rattrapage.
const bodySchema = z.object({
  team: z.enum(TEAM_IDS),
  lesson: z.enum(LESSON_IDS).default('camp'),
})

/**
 * Le banc des leçons de Michel (pages/test/camp.vue). Pour la leçon du camp,
 * remet le joueur servi à la sortie de l'introduction — partie neuve,
 * introduction finie, Fromage en poche, leçon du camp à voir. Il arrive alors
 * au camp comme un joueur neuf, et rejoue le premier parcours jusqu'à la
 * première question.
 *
 * Pour la leçon de la chute, le remet juste après sa première chute : partie
 * neuve, leçon du camp déjà vue, puis une vraie ascension perdue, une mauvaise
 * réponse par vie. L'attente, le Pool Échecs et le Volumen viennent du vrai
 * jeu, pas d'un état écrit à la main.
 *
 * Pour la leçon du rattrapage, la même chute, leçon de la chute vue, puis
 * l'attente passée : le joueur arrive au camp l'attente échue, avant
 * « Commencer ».
 *
 * Admin seulement. Le joueur servi est le joueur test incarné : hors
 * développement, la partie d'un vrai compte, celui de l'admin compris, ne se
 * jette pas pour un banc.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const player = await requireAuth(event)

  if (!player.isTest && !import.meta.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Incarne un joueur test' })
  }

  const { team, lesson } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const now = new Date()

  await resetPlayer(db, player, now)
  // Introduction finie, guilde donnée, et vues les leçons qui précèdent celle
  // à revoir.
  await db.update(users).set({
    introDoneAt: now,
    team,
    ...lesson !== 'camp' && { [LESSON_COLUMNS.camp]: now },
    ...lesson === 'recovery' && { [LESSON_COLUMNS.fall]: now },
  }).where(eq(users.id, player.id))

  if (lesson === 'camp') {
    await db.insert(items).values({ userId: player.id, item: 'CHEESE', obtainedAt: now })
    return { ok: true }
  }

  // Une réponse vide est toujours fausse. Le palier, sur un étage trop court,
  // arrêterait la boucle avant l'attente : ce n'est pas le cas d'un deck réel.
  // Le joueur est relu une fois, remis à zéro : servir et répondre relisent
  // eux-mêmes ce qui bouge.
  const fresh = await requirePlayer(db, player.id)
  let state = await serveNextQuestion(db, fresh, now)
  while (state.lives > 0 && state.question) {
    await submitAnswer(db, fresh, '', now)
    state = await serveNextQuestion(db, fresh, now)
  }

  if (lesson === 'recovery') {
    // L'échéance que la chute vient de poser, relue pour la passer.
    await skipCooldown(db, await requirePlayer(db, player.id), now)
  }

  return { ok: true }
})
