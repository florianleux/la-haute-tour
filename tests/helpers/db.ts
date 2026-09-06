import { createClient } from '@libsql/client'
import { eq, max } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../server/db/schema'
import { shiftFloorSize } from '../../server/utils/deck'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

/** In-memory SQLite with the migrations applied — one per test. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return db
}

interface QuestionSeed {
  statement?: string
  answerLabel?: string
  floor?: number
  accepted?: string[]
}

/** A question of the shared deck, with its accepted answers. */
export async function createQuestion(db: Database, seed: QuestionSeed = {}): Promise<string> {
  const floor = seed.floor ?? 1
  // Le deck a un ordre : une question créée se range à la fin de son étage, comme
  // l'import et l'administration le font.
  const [{ last }] = await db
    .select({ last: max(schema.questions.rank) })
    .from(schema.questions)
    .where(eq(schema.questions.floor, floor))

  const [question] = await db
    .insert(schema.questions)
    .values({
      statement: seed.statement ?? 'Capitale de la Gironde ?',
      answerLabel: seed.answerLabel ?? 'BORDEAUX',
      floor,
      rank: (last ?? 0) + 1,
    })
    .returning()

  await db
    .insert(schema.acceptedAnswers)
    .values((seed.accepted ?? ['Bordeaux']).map(text => ({ questionId: question.id, text })))

  // Le compte de l'étage suit la question, comme l'administration le fait : un
  // deck monté à la main dans un test doit décrire le même monde qu'en jeu.
  // Voir server/utils/deck.ts.
  await shiftFloorSize(db, floor, 1)

  return question.id
}

type PlayerState = Partial<typeof schema.users.$inferInsert>

/** A player in the database, spelling out only what the test looks at. */
export async function createPlayer(db: Database, state: PlayerState = {}): Promise<number> {
  const [user] = await db
    .insert(schema.users)
    .values({
      discordId: '123456789',
      username: 'gandalf',
      // Une tentative ouverte depuis toujours : les tests jouent à une heure
      // qu'ils choisissent, et l'horloge de la base ne la connaît pas.
      attemptStartedAt: new Date(0),
      ...state,
    })
    .returning()

  return user.id
}

/** Ce qu'un test précise d'un passage : le reste a un défaut jouable. */
type SeenState = Partial<Omit<typeof schema.seenQuestions.$inferInsert, 'userId' | 'questionId'>>

/**
 * Une question déjà vue par un joueur, décomptes compris.
 *
 * Le joueur porte ses questions vues plutôt que de les compter : les insérer
 * sans faire bouger ses compteurs monterait un monde que le jeu ne peut pas
 * produire, et le palier tomberait ailleurs qu'en vrai. Le helper tient
 * l'invariant, comme `resolve()` le tient en jeu.
 * Voir server/db/schema.ts et server/utils/game.ts.
 */
export async function markSeen(
  db: Database,
  userId: number,
  questionIds: string | string[],
  state: SeenState = {},
): Promise<void> {
  const ids = Array.isArray(questionIds) ? questionIds : [questionIds]

  if (!ids.length) {
    return
  }

  const player = await loadPlayer(db, userId)
  const floor = state.floor ?? player.currentFloor

  await db.insert(schema.seenQuestions).values(ids.map(questionId => ({
    correct: true,
    ...state,
    userId,
    questionId,
    floor,
  })))

  await db
    .update(schema.users)
    .set({
      // Seules les questions de l'étage où se tient le joueur comptent pour son
      // palier ; sa tentative, elle, compte tout ce qu'il vient de voir.
      floorSeen: floor === player.currentFloor ? player.floorSeen + ids.length : player.floorSeen,
      attemptSeen: player.attemptSeen + ids.length,
    })
    .where(eq(schema.users.id, userId))
}

/**
 * Le joueur tel que la base le porte maintenant. Les fonctions du jeu prennent
 * le joueur en argument : un test qui vient d'en écrire un le relit avant de
 * rejouer, sinon il pilote une copie périmée.
 */
export async function loadPlayer(db: Database, userId: number): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId))

  return user
}
