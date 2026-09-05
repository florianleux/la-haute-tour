import { useDatabase } from '~~/server/db/client'
import { deleteTestPlayer, testPlayerFromRoute } from '~~/server/utils/testPlayers'

/**
 * Supprimer un joueur test, et sa partie avec lui. Un vrai joueur est refusé :
 * l'administration répare une partie, elle ne l'efface pas.
 * Voir specs/admin.md#joueurs-test.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await deleteTestPlayer(useDatabase(), await testPlayerFromRoute(event))

  return { ok: true }
})
