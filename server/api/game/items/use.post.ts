import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { unlock } from '~~/server/utils/achievements'
import { requireCamp } from '~~/server/utils/camp'
import { ITEM_USES, readItems, takeItem } from '~~/server/utils/items'
import { ITEM_IDS } from '~~/shared/utils/items'
import type { ItemsView } from '~~/server/utils/items'
import type { AchievementId } from '~~/shared/utils/achievements'

const bodySchema = z.object({ item: z.enum(ITEM_IDS) })

export interface ItemUseView extends ItemsView {
  /** Les succès que ce geste vient de graver, pour le toast. */
  unlocked: AchievementId[]
}

/**
 * Utiliser un Objet de son sac : il le quitte, et fait ce que son entrée de
 * ITEM_USES dit. Une seule route pour tous les Objets. Refusé hors du camp, le
 * seul endroit où le sac s'ouvre ; refusé aussi quand l'Objet n'est pas dans le
 * sac, ou que son moment n'est pas venu (le Fromage, après la leçon du camp).
 * Rend le sac qui reste, que l'Inventaire réaffiche, et les succès gagnés.
 * Voir specs/spec.md (glossaire, « Utiliser ») et specs/ecrans.md#inventaire.
 */
export default defineEventHandler(async (event): Promise<ItemUseView> => {
  const user = await requireAuth(event)
  const { item } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const now = new Date()

  await requireCamp(db, user, now)

  if (!ITEM_USES[item].usableBy(user) || !await takeItem(db, user.id, item)) {
    throw createError({ statusCode: 409, statusMessage: 'Objet inutilisable' })
  }

  const [bag, unlocked] = await Promise.all([
    readItems(db, user),
    unlock(db, user, ITEM_USES[item].earns, now),
  ])

  return { ...bag, unlocked }
})
