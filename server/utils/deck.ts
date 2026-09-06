import { and, asc, count, eq, gt } from 'drizzle-orm'
import { questions } from '../db/schema'
import type { Database } from '../db/client'
import type { Question, User } from '../db/schema'

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
 * Où le joueur en est du deck : la place qu'il occupe à son étage. Ce n'est pas
 * sa réservation qui la porte — un rattrapage l'écrase avec une question du Pool
 * Échecs, dont le rang n'a rien à voir — mais son curseur.
 */
export type DeckPosition = Pick<User, 'currentFloor' | 'floorCursor'>

/**
 * Les questions que le joueur n'a pas encore rencontrées à son étage, dans
 * l'ordre du deck : celles dont le rang dépasse son curseur. Un saut dans
 * l'index, `limit` lignes lues, quel que soit le nombre de questions que
 * l'étage contient.
 *
 * Rend une liste vide quand l'étage est épuisé — c'est ce qui fait le palier.
 *
 * Le même parcours sert l'ascension, qui en réserve une, et le geste
 * d'administration qui fait avancer un joueur test de plusieurs d'un coup :
 * l'ordre du deck n'a qu'une définition, donc un joueur test avance exactement
 * là où un vrai joueur avancerait. Voir specs/admin.md#joueurs-test.
 */
export async function upcomingQuestions(
  db: Database,
  position: DeckPosition,
  limit: number,
): Promise<Question[]> {
  return db
    .select()
    .from(questions)
    .where(and(
      eq(questions.floor, position.currentFloor),
      gt(questions.rank, position.floorCursor),
    ))
    .orderBy(asc(questions.rank))
    .limit(limit)
}

/**
 * À appeler dès qu'une question entre ou sort du deck. Sans ça, l'étage garderait
 * sa taille d'avant jusqu'à la péremption — et le palier tomberait au mauvais
 * endroit. Les tests s'en servent aussi pour repartir d'une mémoire vide.
 */
export function forgetDeckSizes(): void {
  sizes.clear()
}
