import { useDatabase } from '~~/server/db/client'
import { createTestPlayer } from '~~/server/utils/testPlayers'

export interface CreatedTestPlayer {
  id: number
  username: string
}

/**
 * Créer un joueur test. Sans corps : le nom se choisit tout seul à la suite des
 * autres, et rien d'autre n'est à décider à la création — la progression se
 * règle ensuite, par gestes.
 *
 * Ce qui revient se limite à de quoi le nommer : la ligne entière porterait son
 * état de jeu, qui se lit à l'endroit prévu pour ça.
 * Voir specs/admin.md#joueurs-test.
 */
export default defineEventHandler(async (event): Promise<CreatedTestPlayer> => {
  await requireAdmin(event)

  const created = await createTestPlayer(useDatabase(), new Date())

  return { id: created.id, username: created.username }
})
