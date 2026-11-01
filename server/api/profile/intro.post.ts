import { useDatabase } from '~~/server/db/client'
import { users } from '~~/server/db/schema'
import { introUnfinished } from '~~/server/utils/intro'
import { grantItemWhere } from '~~/server/utils/items'

/**
 * Le joueur a pris le Fromage que L'Inconnu lui tend : l'introduction est
 * finie, elle ne lui sera plus imposée. Le joueur servi par le jeu, comme pour
 * le genre — le joueur test incarné le cas échéant.
 *
 * N'agit qu'une fois par partie : une introduction déjà finie ne redonne pas le
 * Fromage et ne réécrit pas sa date. Les deux écritures partent dans un même
 * lot, gardées sur la même condition — le Fromage d'abord, tant que la fin
 * n'est pas posée — si bien qu'aucun appel ne pose l'une sans l'autre.
 * Voir specs/spec.md (glossaire, « Introduction »).
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const user = await requireAuth(event)
  const db = useDatabase()
  const now = new Date()
  const unfinished = introUnfinished(user.id)

  await db.batch([
    grantItemWhere(db, user.id, 'CHEESE', now, unfinished),
    db.update(users).set({ introDoneAt: now }).where(unfinished),
  ])

  return { ok: true }
})
