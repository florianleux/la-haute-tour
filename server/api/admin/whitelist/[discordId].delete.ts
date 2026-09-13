import { eq } from 'drizzle-orm'
import { useDatabase } from '~~/server/db/client'
import { whitelist } from '~~/server/db/schema'

/**
 * Désinviter un Discord ID. Le retrait ferme la porte tout de suite, session en
 * cours comprise : c'est `loadUser()` qui cesse de servir un joueur que la
 * whitelist ne porte plus. Voir server/utils/auth.ts.
 *
 * La partie, elle, ne bouge pas — compte, étage, vies, Pool Échecs et succès
 * restent en place, et ré-ajouter l'ID rouvre l'accès sur la partie telle
 * qu'elle était. Voir specs/admin.md#whitelist-discord.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const admin = await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const discordId = getRouterParam(event, 'discordId') ?? ''

  // Se retirer soi-même, c'est se verrouiller dehors sans autre issue que la
  // base : l'admin perdrait du même coup l'écran qui aurait pu le ré-inviter.
  if (discordId === admin.discordId) {
    throw createError({ statusCode: 409, statusMessage: 'Un admin ne se retire pas lui-même' })
  }

  const removed = await useDatabase()
    .delete(whitelist)
    .where(eq(whitelist.discordId, discordId))
    .returning()

  if (!removed.length) {
    throw createError({ statusCode: 404, statusMessage: 'Discord ID absent de la whitelist' })
  }

  return { ok: true }
})
