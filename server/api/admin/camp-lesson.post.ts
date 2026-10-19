import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { items, users } from '~~/server/db/schema'
import { resetPlayer } from '~~/server/utils/players'
import { TEAM_IDS } from '~~/shared/utils/teams'

// La guilde à donner au joueur pour ce passage : sans équipe, la leçon
// sauterait la bannière et les Haut-faits.
const bodySchema = z.object({ team: z.enum(TEAM_IDS) })

/**
 * Le banc de la leçon du camp (pages/test/camp.vue) : remet le joueur servi à
 * la sortie de l'introduction — partie neuve, introduction finie, Fromage en
 * poche, leçon du camp à voir. Il arrive alors au camp comme un joueur neuf,
 * et rejoue le premier parcours jusqu'à la première question.
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

  const { team } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const now = new Date()

  await resetPlayer(db, player, now)
  await db.batch([
    db.insert(items).values({ userId: player.id, item: 'CHEESE', obtainedAt: now }),
    db.update(users).set({ introDoneAt: now, team }).where(eq(users.id, player.id)),
  ])

  return { ok: true }
})
