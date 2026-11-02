import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { markAchievementsAnnounced, markNoticesRead, unreadNotices } from '~~/server/utils/notices'
import { ACHIEVEMENT_IDS } from '~~/shared/utils/achievements'
import type { Notices } from '~~/server/utils/notices'

const ids = z.array(z.number().int().positive())

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('notices'), disputes: ids, spells: ids }),
  // Les toasts de ces succès débloqués sans lui viennent d'être joués.
  z.object({ kind: z.literal('achievements'), ids: z.array(z.enum(ACHIEVEMENT_IDS)) }),
])

/** Ce que le client envoie : des nouvelles lues, ou des toasts joués. */
export type NoticesReadBody = z.infer<typeof bodySchema>

/**
 * Le joueur a lu : une nouvelle (« OK »), celles du poster (« Tout marquer
 * lu »), ou les toasts de ses succès débloqués sans lui. Rend les nouvelles qui
 * restent : le poster réaffiche ce que le serveur dit, il ne retire rien de
 * lui-même. Voir specs/ecrans.md#nouvelles.
 */
export default defineEventHandler(async (event): Promise<Notices> => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const now = new Date()

  if (body.kind === 'achievements') {
    await markAchievementsAnnounced(db, user, body.ids, now)
  }
  else {
    await markNoticesRead(db, user, body, now)
  }

  return unreadNotices(db, user)
})
