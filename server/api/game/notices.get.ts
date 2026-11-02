import { useDatabase } from '~~/server/db/client'
import { unreadNotices } from '~~/server/utils/notices'
import type { Notices } from '~~/server/utils/notices'

/**
 * Ce qui est arrivé au joueur sans lui et qu'il n'a pas encore lu. Lecture seule :
 * c'est son « OK » qui la date, pas l'affichage. Voir specs/ecrans.md#nouvelles.
 */
export default defineEventHandler(async (event): Promise<Notices> => {
  const user = await requireAuth(event)

  return unreadNotices(useDatabase(), user)
})
