import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { playerFromRoute } from '~~/server/utils/players'
import { TEAM_IDS } from '~~/shared/utils/teams'

const bodySchema = z.object({
  /** L'équipe visée, ou null pour l'en retirer : l'appartenance est facultative. */
  team: z.enum(TEAM_IDS).nullable(),
})

/**
 * Mettre un joueur dans une équipe, l'en changer, ou l'en retirer. Assignation
 * manuelle : rien ne l'attribue tout seul, et rien n'équilibre les effectifs.
 *
 * Ce qui est déjà lancé ne bouge pas — un effet porte la face gravée au moment
 * du lancer. Le changement ne vaut que pour les lancers à venir, donc il n'y a
 * rien d'autre à écrire ici. Voir specs/equipes.md#changer-déquipe-en-cours-de-partie.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  // Le corps d'abord : une requête mal formée se refuse sans aller lire un
  // joueur en base, et garde son 400 plutôt que de se faire devancer par le 404
  // d'un identifiant inconnu.
  const { team } = await readValidatedBody(event, bodySchema.parse)
  const player = await playerFromRoute(event)

  await useDatabase().update(users).set({ team }).where(eq(users.id, player.id))

  return { ok: true }
})
