import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { settleDispute } from '~~/server/utils/disputes'

const bodySchema = z.object({
  verdict: z.enum(['accepted', 'rejected']),
})

/**
 * L'arbitrage : accepter ou rejeter. Accepter est ce qui répare — réponse
 * ajoutée pour tous, verdict corrigé, vie rendue. Voir specs/validation.md.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  // Nitro ne route ici que si le segment existe ; le défaut n'est là que pour le typage.
  const id = Number(getRouterParam(event, 'id') ?? '')
  const { verdict } = await readValidatedBody(event, bodySchema.parse)

  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Contestation inconnue' })
  }

  await settleDispute(useDatabase(), id, verdict, new Date())

  return { ok: true }
})
