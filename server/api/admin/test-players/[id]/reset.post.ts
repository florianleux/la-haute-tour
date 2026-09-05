import { useDatabase } from '~~/server/db/client'
import { resetTestPlayer, testPlayerFromRoute } from '~~/server/utils/testPlayers'

/** Effacer la partie d'un joueur test et le rendre neuf. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await resetTestPlayer(useDatabase(), await testPlayerFromRoute(event), new Date())

  return { ok: true }
})
