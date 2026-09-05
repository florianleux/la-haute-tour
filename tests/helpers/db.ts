import { createClient } from '@libsql/client'
import { eq, max } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../server/db/schema'
import { forgetDeckSizes } from '../../server/utils/deck'
import type { Database } from '../../server/db/client'
import type { User } from '../../server/db/schema'

/** In-memory SQLite with the migrations applied — one per test. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  // La taille des étages est mémorisée par processus, pas par base : un test qui
  // ouvre un monde neuf doit oublier le deck du précédent.
  forgetDeckSizes()
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

/**
 * Le joueur tel que la base le porte maintenant. Les fonctions du jeu prennent
 * le joueur en argument : un test qui vient d'en écrire un le relit avant de
 * rejouer, sinon il pilote une copie périmée.
 */
export async function loadPlayer(db: Database, userId: number): Promise<User> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId))

  return user
}
