import { useDatabase } from '~~/server/db/client'
import { sendToCooldown, testPlayerFromRoute } from '~~/server/utils/testPlayers'

/** Ouvrir l'attente d'un joueur test : la seule phase où les Sorts se lancent. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  await sendToCooldown(useDatabase(), await testPlayerFromRoute(event), new Date())

  return { ok: true }
})
