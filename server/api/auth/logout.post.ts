export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const session = await useAuthSession(event)
  await session.clear()
  return { ok: true }
})
