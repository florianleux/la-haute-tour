import { useDatabase } from '~~/server/db/client'
import { users, whitelist } from '~~/server/db/schema'
import { startOfGame } from '~~/server/utils/players'

/**
 * Connexion locale, sans Discord : un admin de développement, créé à la
 * première visite dans la base locale. Pour regarder les pages de test sans
 * application Discord configurée, ou depuis un navigateur sans session.
 *
 * `import.meta.dev` est remplacé au build : en production ce handler ne fait que
 * répondre 404, la branche qui connecte n'existe pas dans le bundle.
 */
const DEV_DISCORD_ID = 'dev-local-admin'

export default defineEventHandler(async (event): Promise<void> => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }

  const db = useDatabase()
  const now = new Date()

  // Whitelisté : la lecture du joueur à chaque requête relit la whitelist.
  // Voir server/utils/auth.ts#loadUser.
  await db.insert(whitelist).values({ discordId: DEV_DISCORD_ID }).onConflictDoNothing()

  // Admin pour ouvrir les pages de test, introduction faite pour ne pas y être
  // ramené à chaque page, tentative ouverte comme celle d'un joueur test.
  const [user] = await db
    .insert(users)
    .values({
      discordId: DEV_DISCORD_ID,
      username: 'Admin local',
      isAdmin: true,
      ...startOfGame(),
      introDoneAt: now,
      attemptStartedAt: now,
    })
    .onConflictDoUpdate({ target: users.discordId, set: { isAdmin: true } })
    .returning({ id: users.id })

  await signIn(event, user.id)

  return sendRedirect(event, '/')
})
