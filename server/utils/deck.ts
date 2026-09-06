import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm'
import { deckFloors, questions, seenQuestions, users } from '../db/schema'
import type { Database } from '../db/client'
import type { Question, User } from '../db/schema'

/**
 * Combien de questions un étage contient.
 *
 * Lu, jamais compté : une ligne, quel que soit le deck. Un `count(*)` parcourt
 * l'index de l'étage entier — mille lignes facturées pour un nombre qui ne
 * bouge pas entre deux éditions de l'administration. Un cache mémoire ne
 * sauvait rien : en serverless, chaque invocation froide repart d'un process
 * neuf, donc d'un cache vide.
 *
 * Rend 0 pour un étage que le deck ne porte pas — la ligne n'existe que là où
 * une question a été rangée.
 */
export async function floorSize(db: Database, floor: number): Promise<number> {
  return sizeOf(await floorSizeQuery(db, floor))
}

/**
 * La même lecture, rendue plutôt qu'exécutée : l'instantané du joueur la fait
 * voyager dans le même lot que sa réservation, pour que la taille de l'étage ne
 * coûte pas un aller-retour réseau de plus par question.
 * Voir tests/server/query-budget.test.ts.
 */
export function floorSizeQuery(db: Database, floor: number) {
  return db
    .select({ total: deckFloors.total })
    .from(deckFloors)
    .where(eq(deckFloors.floor, floor))
    .limit(1)
}

/** Ce que ces lignes valent : le compte de l'étage, ou zéro s'il n'en a aucune. */
export function sizeOf(rows: { total: number }[]): number {
  return rows[0]?.total ?? 0
}

/**
 * Les questions que le joueur n'a pas encore rencontrées à son étage, dans
 * l'ordre du deck : celles dont le rang dépasse son curseur d'étage. Un saut
 * dans l'index, `limit` lignes lues, quel que soit le nombre de questions que
 * l'étage contient.
 *
 * C'est le curseur qui dit où le joueur en est, et non sa réservation — un
 * rattrapage écrase celle-ci avec une question du Pool Échecs, dont le rang n'a
 * rien à voir. Voir specs/spec.md#glossaire, « Curseur d'étage ».
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
  user: Pick<User, 'currentFloor' | 'floorCursor'>,
  limit: number,
): Promise<Question[]> {
  return db
    .select()
    .from(questions)
    .where(and(
      eq(questions.floor, user.currentFloor),
      gt(questions.rank, user.floorCursor),
    ))
    .orderBy(asc(questions.rank))
    .limit(limit)
}

/**
 * Le compte d'un étage bouge d'autant. Rendu comme requête plutôt qu'exécuté :
 * l'édition du deck l'écrit dans le même lot que la question elle-même, sinon
 * une interruption au milieu laisserait le compte en désaccord avec ce que
 * l'étage contient.
 *
 * `delta` vaut +1 quand une question entre, -1 quand elle sort.
 */
export function shiftFloorSize(db: Database, floor: number, delta: number) {
  return db
    .insert(deckFloors)
    .values({ floor, total: delta })
    .onConflictDoUpdate({
      target: deckFloors.floor,
      set: { total: sql`${deckFloors.total} + ${delta}` },
    })
}

/**
 * Recale les décomptes de questions vues des joueurs nommés, depuis les lignes
 * elles-mêmes.
 *
 * Nécessaire quand le deck bouge sous eux : supprimer une question efface par
 * cascade les passages qu'elle a laissés, et un compteur porté ne peut pas
 * deviner qu'il vient de perdre une ligne. Le coût d'un `count(*)` est ici sans
 * conséquence — l'administration édite le deck, elle ne joue pas.
 * Voir server/db/schema.ts.
 */
export async function recountSeenBy(db: Database, userIds: number[]): Promise<void> {
  if (!userIds.length) {
    return
  }

  await db
    .update(users)
    .set({
      floorSeen: sql`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.floor} = ${users.currentFloor})`,
      attemptSeen: sql`(select count(*) from ${seenQuestions}
        where ${seenQuestions.userId} = ${users.id}
          and ${seenQuestions.seenAt} >= ${users.attemptStartedAt})`,
    })
    .where(inArray(users.id, userIds))
}

/**
 * Recompte les étages depuis les questions elles-mêmes. Le compte est tenu à
 * chaque édition ; ceci est le filet — l'import de masse s'en sert plutôt que
 * d'incrémenter des milliers de fois, et un doute se lève en l'appelant.
 */
export async function recountDeckFloors(db: Database): Promise<void> {
  const totals = await db
    .select({ floor: questions.floor, total: count() })
    .from(questions)
    .groupBy(questions.floor)

  await db.delete(deckFloors)

  if (totals.length) {
    await db.insert(deckFloors).values(totals)
  }
}
