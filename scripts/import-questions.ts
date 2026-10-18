import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createDatabase, type Database } from '../server/db/client'
import { CATEGORY_LABELS, type CategoryCode } from '../shared/utils/categories'
import { FLOOR_COUNT } from '../shared/utils/floors'
import {
  acceptedAnswers,
  categories,
  deckFloors,
  questionCategories,
  questions,
  users,
} from '../server/db/schema'

/**
 * Loads the shared deck into the database. Runs once, by hand, before launch:
 * `pnpm db:import <fichier.json>`, pointed at the local file in dev or at Turso
 * through TURSO_DATABASE_URL. See specs/architecture.md.
 */

const categoryCodes = Object.keys(CATEGORY_LABELS) as [CategoryCode, ...CategoryCode[]]

/** Shape of one entry in the source file. Anything else is skipped, never fatal. */
const sourceQuestionSchema = z.object({
  statement: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  answerLabel: z.string().trim().min(1),
  variants: z.array(z.string()).default([]),
  categories: z.array(z.enum(categoryCodes)).default([]),
})

export interface ParsedQuestion {
  statement: string
  answerLabel: string
  floor: number
  acceptedAnswers: string[]
  categories: string[]
}

export interface ParseResult {
  parsed: ParsedQuestion[]
  total: number
  skipped: { index: number, reason: string }[]
}

/** Case-insensitive dedup that keeps the first spelling seen. */
function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (trimmed === '' || seen.has(key)) continue
    seen.add(key)
    kept.push(trimmed)
  }
  return kept
}

/** Fisher-Yates, en place. */
function shuffle<T>(values: T[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const held = values[index]!
    values[index] = values[swap]!
    values[swap] = held
  }
}

/**
 * Valide le fichier source et répartit les questions sur les étages, au hasard.
 *
 * Rien ne préside à cette répartition : les 6 étages sont équivalents, monter n'est
 * pas monter en difficulté. Voir specs/spec.md.
 *
 * Mélange, puis distribution à tour de rôle. C'est le tour de rôle qui garantit
 * l'équilibre — six tirages indépendants par question laisseraient un étage se
 * dégarnir, là où celui-ci les tient égaux à une question près, quel que soit le
 * volume du deck.
 *
 * `random` est injectable pour que la répartition puisse se rejouer sous test.
 */
export function parseQuestions(raw: unknown, random: () => number = Math.random): ParseResult {
  if (!Array.isArray(raw)) {
    throw new Error('Le fichier doit contenir un tableau de questions')
  }

  const skipped: { index: number, reason: string }[] = []
  const kept: Omit<ParsedQuestion, 'floor'>[] = []

  raw.forEach((entry, index) => {
    const result = sourceQuestionSchema.safeParse(entry)
    if (!result.success) {
      const reason = result.error.issues
        .map(issue => `${issue.path.join('.') || '(racine)'}: ${issue.message}`)
        .join(', ')
      skipped.push({ index, reason })
      return
    }

    const source = result.data
    kept.push({
      statement: source.statement,
      answerLabel: source.answerLabel,
      acceptedAnswers: dedupe([source.answer, ...source.variants]),
      categories: dedupe(source.categories),
    })
  })

  shuffle(kept, random)

  const parsed = kept.map((question, position) => ({
    ...question,
    floor: (position % FLOOR_COUNT) + 1,
  }))

  return { parsed, total: raw.length, skipped }
}

/** Keeps each statement under the SQLite bound-parameter limit. */
function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks
}

export interface ImportCounts {
  questions: number
  acceptedAnswers: number
  categories: number
  byFloor: Map<number, number>
}

/**
 * Wipe and load: the deck is imported once, so there is no incremental upsert to
 * build. Ids are generated here rather than read back, so children can be built
 * without a round-trip per row.
 */
export async function importQuestions(
  db: Database,
  parsed: ParsedQuestion[],
): Promise<ImportCounts> {
  const categoryNames = dedupe(parsed.flatMap(question => question.categories))

  // Le rang fige l'ordre du deck, étage par étage : ce que le joueur parcourra est
  // ce qui a été écrit ici, une fois pour toutes. L'ordre reçu est déjà celui du
  // mélange fait par `parseQuestions`, donc l'ordre du fichier ne transparaît nulle
  // part. Voir specs/mecanique.md#ascension.
  const nextRank = new Map<number, number>()
  const questionRows = parsed.map((question) => {
    const rank = (nextRank.get(question.floor) ?? 0) + 1
    nextRank.set(question.floor, rank)

    return {
      id: crypto.randomUUID(),
      statement: question.statement,
      answerLabel: question.answerLabel,
      floor: question.floor,
      rank,
    }
  })

  const answerRows = parsed.flatMap((question, index) =>
    question.acceptedAnswers.map(text => ({ questionId: questionRows[index]!.id, text })),
  )

  return db.transaction(async (tx) => {
    await tx.delete(questionCategories)
    await tx.delete(acceptedAnswers)
    await tx.delete(questions)
    await tx.delete(categories)

    for (const rows of chunk(categoryNames, 400)) {
      await tx.insert(categories).values(rows.map(name => ({ name })))
    }
    const categoryIds = new Map(
      (await tx.select().from(categories)).map(row => [row.name.toLowerCase(), row.id]),
    )

    for (const rows of chunk(questionRows, 200)) {
      await tx.insert(questions).values(rows)
    }
    for (const rows of chunk(answerRows, 400)) {
      await tx.insert(acceptedAnswers).values(rows)
    }

    const linkRows = parsed.flatMap((question, index) =>
      question.categories.map(name => ({
        questionId: questionRows[index]!.id,
        categoryId: categoryIds.get(name.toLowerCase())!,
      })),
    )
    for (const rows of chunk(linkRows, 400)) {
      await tx.insert(questionCategories).values(rows)
    }

    const byFloor = new Map<number, number>()
    for (const row of questionRows) {
      byFloor.set(row.floor, (byFloor.get(row.floor) ?? 0) + 1)
    }

    // Le compte de chaque étage s'écrit ici plutôt que de se laisser compter à
    // chaque lecture d'état. Voir server/utils/deck.ts.
    await tx.delete(deckFloors)
    await tx.insert(deckFloors).values(
      [...byFloor].map(([floor, total]) => ({ floor, total })),
    )

    // Le deck effacé a emporté les questions vues par cascade : les décomptes
    // que les joueurs portaient ne décrivent plus rien.
    await tx.update(users).set({ floorSeen: 0, attemptSeen: 0, floorCursor: 0 })

    return {
      questions: questionRows.length,
      acceptedAnswers: answerRows.length,
      categories: categoryNames.length,
      byFloor,
    }
  })
}

async function main(): Promise<void> {
  const [filePath] = process.argv.slice(2)
  if (!filePath) {
    console.error('Usage : pnpm db:import <fichier.json>')
    process.exit(1)
  }

  const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'))
  const { parsed, total, skipped } = parseQuestions(raw)

  const db = await createDatabase()
  const counts = await importQuestions(db, parsed)

  // The only check on the import before it reaches production: read these numbers.
  console.log(`\nImport terminé — ${filePath}`)
  console.log(`  lues       ${total}`)
  console.log(`  importées  ${counts.questions}`)
  console.log(`  ignorées   ${skipped.length}`)
  for (const { index, reason } of skipped) {
    console.log(`    ligne ${index} — ${reason}`)
  }
  console.log(`\n  réponses acceptées  ${counts.acceptedAnswers}`)
  console.log(`  catégories          ${counts.categories}`)
  console.log('\n  par étage')
  for (let floor = 1; floor <= FLOOR_COUNT; floor += 1) {
    const count = counts.byFloor.get(floor) ?? 0
    console.log(`    étage ${floor}  ${count}${count === 0 ? '  ⚠ vide' : ''}`)
  }
  console.log()
}

main().catch((error: unknown) => {
  console.error(`Import échoué : ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
