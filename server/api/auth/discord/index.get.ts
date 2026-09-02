import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event): Promise<void> => {
  const { discord } = useRuntimeConfig(event)
  const state = randomUUID()

  const session = await useAuthSession(event)
  await session.update({ oauthState: state })

  return sendRedirect(event, buildAuthorizeUrl({
    clientId: discord.clientId,
    redirectUri: discord.redirectUri,
    state,
  }))
})
