import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import type { Database } from '../db/client'

/** La ligne unique des réglages. Voir server/db/schema.ts. */
const SETTINGS_ROW = 1

/**
 * Ferme ou rouvre le jeu. Fermé, plus aucune question n'est servie aux joueurs —
 * mais ce qui est commencé se finit, et les attentes continuent de courir.
 * Voir specs/admin.md#maintenance.
 */
export async function setMaintenance(db: Database, closed: boolean, now: Date): Promise<void> {
  const maintenanceSince = closed ? now : null

  await db
    .insert(settings)
    .values({ id: SETTINGS_ROW, maintenanceSince })
    .onConflictDoUpdate({ target: settings.id, set: { maintenanceSince } })
}

/**
 * Depuis quand le jeu est fermé, null s'il est ouvert.
 *
 * La lecture du jeu, elle, ne passe pas par ici : elle lit le réglage dans la même
 * requête que le joueur, pour ne pas payer un aller-retour de plus à chaque
 * question. Voir server/utils/game.ts.
 */
export async function maintenanceSince(db: Database): Promise<Date | null> {
  const [row] = await db
    .select({ since: settings.maintenanceSince })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ROW))
    .limit(1)

  return row?.since ?? null
}
