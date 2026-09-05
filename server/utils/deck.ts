import { count, eq } from 'drizzle-orm'
import { questions } from '../db/schema'
import type { Database } from '../db/client'

/**
 * Combien de questions un étage contient.
 *
 * C'est une propriété du deck : partagée par tous les joueurs, et changée
 * seulement quand l'administration l'édite. Elle était pourtant recomptée à
 * chaque lecture d'état — 166 lignes lues aujourd'hui, 1000 quand le deck sera
 * plein, pour un nombre qui ne bouge pas. Turso facture les lignes lues.
 *
 * Gardée en mémoire du processus : une instance qui vient de démarrer la relit
 * une fois, puis la sert sans requête. La péremption borne l'écart pour les
 * autres instances, que `forgetDeckSizes()` ne peut pas atteindre.
 */
const TTL_MS = 30_000

interface KnownSize {
  total: number
  readAt: number
}

const sizes = new Map<number, KnownSize>()

export async function floorSize(db: Database, floor: number, now: Date): Promise<number> {
  const known = sizes.get(floor)

  if (known && now.getTime() - known.readAt < TTL_MS) {
    return known.total
  }

  const [row] = await db
    .select({ value: count() })
    .from(questions)
    .where(eq(questions.floor, floor))

  sizes.set(floor, { total: row.value, readAt: now.getTime() })

  return row.value
}

/**
 * À appeler dès qu'une question entre ou sort du deck. Sans ça, l'étage garderait
 * sa taille d'avant jusqu'à la péremption — et le palier tomberait au mauvais
 * endroit. Les tests s'en servent aussi pour repartir d'une mémoire vide.
 */
export function forgetDeckSizes(): void {
  sizes.clear()
}
