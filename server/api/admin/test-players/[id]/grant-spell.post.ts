import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { grantSpell, testPlayerFromRoute } from '~~/server/utils/testPlayers'
import { SPELL_IDS } from '~~/shared/utils/spells'

const bodySchema = z.object({ spell: z.enum(SPELL_IDS) })

/** Un exemplaire de plus dans la poche d'un joueur test, sans attendre un coffre. */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const { spell } = await readValidatedBody(event, bodySchema.parse)

  await grantSpell(useDatabase(), await testPlayerFromRoute(event), spell, new Date())

  return { ok: true }
})
