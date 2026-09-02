import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'

const querySchema = z.object({
  code: z.string(),
  state: z.string(),
})

export default defineEventHandler(async (event): Promise<void> => {
  const rawQuery = getQuery(event)

  // Discord sends back `error=access_denied` when the player cancels the consent
  // screen. Changing your mind isn't an error — send them back to the login page.
  if (rawQuery.error) {
    const session = await useAuthSession(event)
    await session.clear()
    return sendRedirect(event, '/login')
  }

  const query = querySchema.safeParse(rawQuery)
  if (!query.success) {
    throw createError({ statusCode: 400, statusMessage: 'Callback Discord invalide' })
  }

  const session = await useAuthSession(event)
  if (!session.data.oauthState || session.data.oauthState !== query.data.state) {
    throw createError({ statusCode: 400, statusMessage: 'State OAuth invalide' })
  }

  const { discord } = useRuntimeConfig(event)
  const accessToken = await exchangeCodeForToken({
    code: query.data.code,
    clientId: discord.clientId,
    clientSecret: discord.clientSecret,
    redirectUri: discord.redirectUri,
  })
  const profile = await fetchDiscordProfile(accessToken)

  const result = await loginWithDiscord(useDatabase(), profile)
  if (result.status === 'refused') {
    await session.clear()
    return sendRedirect(event, '/refus')
  }

  await session.update({ userId: result.user.id, oauthState: undefined })
  return sendRedirect(event, '/')
})
