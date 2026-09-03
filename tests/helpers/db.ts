import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../../server/db/schema'
import type { Database } from '../../server/db/client'

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
  const [question] = await db
    .insert(schema.questions)
    .values({
      statement: seed.statement ?? 'Capitale de la Gironde ?',
      answerLabel: seed.answerLabel ?? 'BORDEAUX',
      floor: seed.floor ?? 1,
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
    .values({ discordId: '123456789', username: 'gandalf', ...state })
    .returning()

  return user.id
}
