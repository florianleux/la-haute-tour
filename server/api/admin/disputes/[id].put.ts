import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { settleDispute } from '~~/server/utils/disputes'
import { numericRouteId } from '~~/server/utils/routes'

const bodySchema = z.object({
  verdict: z.enum(['accepted', 'rejected']),
})

/**
 * L'arbitrage : accepter ou rejeter. Accepter est ce qui répare — réponse
 * ajoutée pour tous, verdict corrigé, vie rendue. Voir specs/validation.md.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)

  const id = numericRouteId(event, 'Contestation inconnue')
  const { verdict } = await readValidatedBody(event, bodySchema.parse)

  await settleDispute(useDatabase(), id, verdict, new Date())

  return { ok: true }
})
