import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { LESSON_COLUMNS } from '~~/server/utils/lessons'
import { LESSON_IDS } from '~~/shared/utils/lessons'

const bodySchema = z.object({ lesson: z.enum(LESSON_IDS) })

/**
 * Le joueur a fini une leçon de Michel : elle ne se jouera plus d'elle-même.
 * Datée une fois : une leçon rejouée ne réécrit pas sa date. Le joueur servi
 * par le jeu, comme pour l'introduction — le joueur test incarné le cas échéant.
 * Voir specs/spec.md (glossaire, « Leçon ») et specs/ecrans.md#leçons-de-michel.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)
  const { lesson } = await readValidatedBody(event, bodySchema.parse)
  const column = LESSON_COLUMNS[lesson]

  await useDatabase()
    .update(users)
    .set({ [column]: new Date() })
    .where(and(eq(users.id, user.id), isNull(users[column])))

  return { ok: true }
})
