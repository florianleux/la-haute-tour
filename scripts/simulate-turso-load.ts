/**
 * Simulation de consommation Turso — lignes lues, lignes écrites, stockage.
 *
 * Ne modélise rien : fait jouer le vrai code du jeu (serveNextQuestion,
 * submitAnswer, readGameState, openPlayerChest, readMissedPool, readInventory,
 * castFromInventory) sur une base SQLite en mémoire montée avec les vraies
 * migrations, et compte ce que chaque instruction SQL réellement partie
 * coûterait chez Turso.
 *
 * Usage :
 *   pnpm tsx scripts/simulate-turso-load.ts [--players=20] [--days=30] [--qpd=250]
 *                                           [--accuracy=0.97] [--deck=1250]
 *                                           [--spells] [--label="…"] [--json=chemin]
 */
import { createClient } from '@libsql/client'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../server/db/schema'
import { openPlayerChest, readGameState, readMissedPool, serveNextQuestion, submitAnswer } from '../server/utils/game'
import { castFromInventory, readInventory } from '../server/utils/inventory'
import { FLOOR_COUNT } from '../shared/utils/floors'
import type { Database } from '../server/db/client'
import type { User } from '../server/db/schema'

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres
// ─────────────────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const hit = process.argv.find(value => value.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const PLAYERS = Number(arg('players', '20'))
const DAYS = Number(arg('days', '30'))
const QPD = Number(arg('qpd', '250'))
const ACCURACY = Number(arg('accuracy', '0.97'))
const DECK_PER_FLOOR = Number(arg('deck', '1250'))
const SPELLS = process.argv.includes('--spells')
/** Le mois est un calendrier, pas un quota : le joueur s'arrête quand il finit. */
const CALENDAR = process.argv.includes('--calendar')
const LABEL = arg('label', 'scénario')
const JSON_OUT = arg('json', '')

/** Le temps que le joueur passe sur une question, verdict compris. */
const SECONDS_PER_QUESTION = 20

// ─────────────────────────────────────────────────────────────────────────────
// Le compteur : ce que Turso facturerait pour chaque instruction partie
// ─────────────────────────────────────────────────────────────────────────────

interface Bucket {
  statements: number
  rowsRead: number
  rowsWritten: number
}

type RawClient = {
  execute: (stmt: unknown) => Promise<{ rows: unknown[], rowsAffected: number }>
  batch: (stmts: unknown[], mode?: unknown) => Promise<{ rows: unknown[], rowsAffected: number }[]>
}

const byOp = new Map<string, Bucket>()
const byShape = new Map<string, Bucket>()
const plans = new Map<string, string[]>()
const tableSizes = new Map<string, number>()
let roundTrips = 0
let op = 'boot'

function bucket(map: Map<string, Bucket>, key: string): Bucket {
  let found = map.get(key)
  if (!found) {
    found = { statements: 0, rowsRead: 0, rowsWritten: 0 }
    map.set(key, found)
  }
  return found
}

/** Une signature courte et lisible d'une requête : verbe + tables touchées. */
function shapeOf(sql: string): string {
  const flat = sql.replace(/\s+/g, ' ').trim()
  const verb = flat.split(' ')[0].toLowerCase()
  const tables = [...flat.matchAll(/(?:from|join|into|update)\s+"([a-z_]+)"/gi)].map(match => match[1])
  return `${verb} ${[...new Set(tables)].join('+') || '?'}`
}

/**
 * Les lignes qu'une requête fait lire, comptées comme Turso les compte : une
 * ligne touchée est une ligne lue. Un parcours d'index qui ne rend qu'une ligne
 * en lit une ; un `count(*)` en lit autant qu'il en compte ; un balayage de
 * table en lit toute la table.
 */
function rowsReadOf(sql: string, plan: string[], returned: number, first: unknown): number {
  const flat = sql.replace(/\s+/g, ' ').toLowerCase()

  // Un agrégat rend une ligne mais en lit autant qu'il en agrège : son propre
  // résultat dit combien.
  if (/count\(\*\)/.test(flat) && typeof first === 'number') {
    return Math.max(1, first)
  }

  let total = 0
  for (const detail of plan) {
    const table = /(?:SCAN|SEARCH) (?:TABLE )?([a-z_]+)/.exec(detail)?.[1]
    if (!table) {
      continue
    }
    total += detail.startsWith('SCAN') && !/USING (COVERING )?INDEX/.test(detail)
      ? tableSizes.get(table) ?? 1
      : Math.max(1, returned)
  }

  return Math.max(total, returned, 1)
}

let raw: RawClient

function install(db: Database): void {
  const client = (db as unknown as { $client: RawClient }).$client
  const execute = client.execute.bind(client)
  const batch = client.batch.bind(client)
  raw = { execute, batch }

  async function account(stmt: unknown, result: { rows: unknown[], rowsAffected: number }): Promise<void> {
    const sql = typeof stmt === 'string' ? stmt : String((stmt as { sql: string }).sql)
    const args = typeof stmt === 'string' ? [] : (stmt as { args?: unknown[] }).args ?? []
    const reads = /^\s*(select|with)/i.test(sql)

    let plan = plans.get(sql)
    if (plan === undefined) {
      plan = []
      if (reads) {
        try {
          const explained = await execute({ sql: `explain query plan ${sql}`, args })
          plan = explained.rows.map(row => String((row as Record<string, unknown>).detail ?? ''))
        }
        catch {
          plan = []
        }
      }
      plans.set(sql, plan)
    }

    const firstRow = result.rows[0] as Record<string, unknown> | undefined
    const first = firstRow ? Object.values(firstRow)[0] : undefined
    const written = result.rowsAffected ?? 0
    // Une mise à jour ou une suppression a d'abord trouvé ses lignes : elle les
    // a donc lues. Un insert, non.
    const seeks = /^\s*(update|delete)/i.test(sql) ? written : 0
    const read = reads ? rowsReadOf(sql, plan, result.rows.length, first) : seeks

    for (const entry of [bucket(byOp, op), bucket(byShape, shapeOf(sql))]) {
      entry.statements += 1
      entry.rowsRead += read
      entry.rowsWritten += written
    }
  }

  client.execute = async (stmt: unknown) => {
    const result = await execute(stmt)
    roundTrips += 1
    await account(stmt, result)
    return result
  }

  client.batch = async (stmts: unknown[], mode?: unknown) => {
    const results = await batch(stmts, mode)
    roundTrips += 1
    for (const [index, stmt] of stmts.entries()) {
      await account(stmt, results[index] ?? { rows: [], rowsAffected: 0 })
    }
    return results
  }
}

const TABLES = [
  'users', 'questions', 'accepted_answers', 'seen_questions', 'missed_pool', 'reservations',
  'recovery_questions', 'inventory', 'active_effects', 'achievements', 'attempts', 'deck_floors',
  'whitelist', 'settings', 'disputes', 'focus_losses', 'question_categories', 'categories',
]

async function refreshSizes(): Promise<void> {
  for (const table of TABLES) {
    const result = await raw.execute(`select count(*) as n from ${table}`)
    tableSizes.set(table, Number((result.rows[0] as Record<string, unknown>).n))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Le monde : un deck, des joueurs
// ─────────────────────────────────────────────────────────────────────────────

async function build(): Promise<Database> {
  const db = drizzle(createClient({ url: ':memory:' }), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  const questionRows: (typeof schema.questions.$inferInsert)[] = []
  const answerRows: (typeof schema.acceptedAnswers.$inferInsert)[] = []

  for (let floor = 1; floor <= FLOOR_COUNT; floor += 1) {
    for (let rank = 1; rank <= DECK_PER_FLOOR; rank += 1) {
      const id = `q-${floor}-${rank}`
      questionRows.push({
        id,
        statement: `Question ${rank} de l'étage ${floor} — un énoncé de longueur ordinaire, avec ce qu'il faut de contexte pour être jouable ?`,
        answerLabel: `RÉPONSE ${floor}-${rank}`,
        floor,
        rank,
      })
      // Deux libellés acceptés par question, comme l'import en produit.
      answerRows.push({ questionId: id, text: `reponse ${floor}-${rank}` })
      answerRows.push({ questionId: id, text: `la reponse ${floor}-${rank}` })
    }
  }

  for (let index = 0; index < questionRows.length; index += 400) {
    await db.insert(schema.questions).values(questionRows.slice(index, index + 400))
  }
  for (let index = 0; index < answerRows.length; index += 400) {
    await db.insert(schema.acceptedAnswers).values(answerRows.slice(index, index + 400))
  }
  await db.insert(schema.deckFloors).values(
    Array.from({ length: FLOOR_COUNT }, (_, index) => ({ floor: index + 1, total: DECK_PER_FLOOR })),
  )

  const teams = ['CRIMSON', 'AZURE'] as const
  for (let index = 0; index < PLAYERS; index += 1) {
    const discordId = `discord-${index}`
    await db.insert(schema.whitelist).values({ discordId })
    await db.insert(schema.users).values({
      discordId,
      username: `joueur-${index}`,
      team: teams[index % teams.length],
      attemptStartedAt: new Date(0),
    })
  }

  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing()

  return db
}

// ─────────────────────────────────────────────────────────────────────────────
// Le joueur, tel que le client l'anime
// ─────────────────────────────────────────────────────────────────────────────

/** Ce que `requireAuth` lit en tête de chaque requête protégée. */
async function authenticated(db: Database, id: number): Promise<User> {
  const [row] = await db
    .select({ user: schema.users, invited: schema.whitelist.discordId })
    .from(schema.users)
    .leftJoin(schema.whitelist, eq(schema.whitelist.discordId, schema.users.discordId))
    .where(eq(schema.users.id, id))
    .limit(1)

  return row.user
}

interface Tally {
  ascent: number
  recovery: number
  cooldowns: number
  chests: number
  casts: number
  days: number
  finished: boolean
}

/** xorshift : reproductible, pour que deux exécutions se comparent. */
function random(seed: { value: number }): number {
  seed.value ^= seed.value << 13
  seed.value ^= seed.value >>> 17
  seed.value ^= seed.value << 5
  return Math.abs(seed.value % 100_000) / 100_000
}

/** Le libellé accepté d'une question, tel que le deck l'a écrit. */
function acceptedFor(questionId: string): string {
  const [, floor, rank] = questionId.split('-')
  return `reponse ${floor}-${rank}`
}

async function playerLoop(
  db: Database,
  id: number,
  tally: Tally,
  seed: { value: number },
  start: Date,
): Promise<void> {
  let now = new Date(start.getTime() + id * 37_000)
  const target = QPD * DAYS
  let answered = 0
  let guard = 0
  let lastDay = ''

  const deadline = start.getTime() + DAYS * 24 * 60 * 60 * 1000

  while (answered < target && guard < target * 8) {
    guard += 1

    if (CALENDAR && now.getTime() > deadline) {
      return
    }

    // Une session : l'application s'ouvre, l'identité et l'état se lisent.
    const day = now.toISOString().slice(0, 10)
    if (day !== lastDay) {
      lastDay = day
      tally.days += 1
      op = 'GET /api/auth/me'
      await authenticated(db, id)
      await authenticated(db, id)
      op = 'GET /api/game/state'
      await readGameState(db, await authenticated(db, id), now)
    }

    op = 'POST /api/game/next'
    let state = await serveNextQuestion(db, await authenticated(db, id), now)

    if (state.phase === 'gameOver') {
      tally.finished = true
      return
    }

    if (state.chest && !state.chest.opened) {
      op = 'POST /api/game/chest'
      await openPlayerChest(db, await authenticated(db, id), now, () => random(seed))
      tally.chests += 1
      continue
    }

    if (state.phase === 'cooldown' && state.cooldownUntil) {
      tally.cooldowns += 1

      // L'attente : le joueur ouvre sa fiche de révision, puis ses Sorts.
      op = 'GET /api/game/pool'
      await readMissedPool(db, await authenticated(db, id), { limit: 20, offset: 0, order: 'desc' })

      if (SPELLS) {
        try {
          op = 'GET /api/game/inventory'
          const view = await readInventory(db, await authenticated(db, id), now)
          const owned = view.entries.filter(entry => entry.count > 0)
          for (let cast = 0; cast < Math.min(view.castsLeft, owned.length); cast += 1) {
            op = 'POST /api/game/cast'
            await castFromInventory(
              db,
              await authenticated(db, id),
              owned[cast].spell,
              random(seed) < 0.5 ? 'ally' : 'foe',
              now,
            )
            tally.casts += 1
          }
        }
        catch {
          // La garde a refusé : l'attente s'est achevée entre-temps.
        }
      }

      // Le joueur revient quand l'attente est finie.
      now = new Date(new Date(state.cooldownUntil).getTime() + 60_000)
      continue
    }

    if (!state.question) {
      // Verdict à lire, palier franchi, rattrapage scellé : le joueur reclique.
      now = new Date(now.getTime() + 5_000)
      continue
    }

    const recovering = state.phase === 'recovery'
    const questionId = state.question.id
    const correct = random(seed) < ACCURACY

    now = new Date(now.getTime() + SECONDS_PER_QUESTION * 1_000)

    op = 'POST /api/game/answer'
    state = await submitAnswer(
      db,
      await authenticated(db, id),
      correct ? acceptedFor(questionId) : 'une reponse fausse',
      now,
    )

    if (recovering) {
      tally.recovery += 1
    }
    else {
      tally.ascent += 1
      answered += 1
    }

    if (state.chest && !state.chest.opened) {
      op = 'POST /api/game/chest'
      await openPlayerChest(db, await authenticated(db, id), now, () => random(seed))
      tally.chests += 1
    }

    now = new Date(now.getTime() + 4_000)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortie
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return Math.round(value).toLocaleString('fr-FR')
}

async function main(): Promise<void> {
  // Les handlers Nitro comptent sur des auto-imports : hors serveur, on les pose.
  Object.assign(globalThis, { createError })

  const db = await build()
  install(db)
  await refreshSizes()

  const start = new Date('2026-10-01T08:00:00.000Z')
  const tallies: Tally[] = []
  const seed = { value: 20260913 }

  for (let index = 0; index < PLAYERS; index += 1) {
    const [player] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, `joueur-${index}`))

    const tally: Tally = { ascent: 0, recovery: 0, cooldowns: 0, chests: 0, casts: 0, days: 0, finished: false }
    tallies.push(tally)
    await playerLoop(db, player.id, tally, seed, start)
    await refreshSizes()
    process.stderr.write(
      `  joueur ${index + 1}/${PLAYERS} — ascension ${tally.ascent}, rattrapage ${tally.recovery}, `
      + `attentes ${tally.cooldowns}, jours ${tally.days}${tally.finished ? ', tour finie' : ''}\n`,
    )
  }

  const pageSize = Number(Object.values((await raw.execute('pragma page_size')).rows[0] as Record<string, unknown>)[0])
  const pages = Number(Object.values((await raw.execute('pragma page_count')).rows[0] as Record<string, unknown>)[0])

  const totals = [...byOp.values()].reduce(
    (sum, entry) => ({
      statements: sum.statements + entry.statements,
      rowsRead: sum.rowsRead + entry.rowsRead,
      rowsWritten: sum.rowsWritten + entry.rowsWritten,
    }),
    { statements: 0, rowsRead: 0, rowsWritten: 0 },
  )

  const sum = (pick: (tally: Tally) => number): number => tallies.reduce((total, tally) => total + pick(tally), 0)
  const ascent = sum(tally => tally.ascent)

  console.log(`\n═══ ${LABEL} ═══`)
  console.log(`${PLAYERS} joueurs · cible ${QPD} q/j × ${DAYS} j · réussite ${Math.round(ACCURACY * 100)} %`
    + ` · deck ${DECK_PER_FLOOR * FLOOR_COUNT} questions · sorts ${SPELLS ? 'oui' : 'non'}`
    + ` · ${CALENDAR ? 'arrêt au 30e jour' : 'arrêt au volume atteint'}`)
  console.log(`\nquestions d'ascension   ${fmt(ascent)}`)
  console.log(`questions de rattrapage ${fmt(sum(tally => tally.recovery))}`)
  console.log(`attentes                ${fmt(sum(tally => tally.cooldowns))}`)
  console.log(`coffres ouverts         ${fmt(sum(tally => tally.chests))}`)
  console.log(`sorts lancés            ${fmt(sum(tally => tally.casts))}`)
  console.log(`jours de jeu (moyenne)  ${(sum(tally => tally.days) / PLAYERS).toFixed(1)}`)
  console.log(`tours finies            ${tallies.filter(tally => tally.finished).length}/${PLAYERS}`)

  console.log(`\nlignes lues     ${fmt(totals.rowsRead)}`)
  console.log(`lignes écrites  ${fmt(totals.rowsWritten)}`)
  console.log(`requêtes SQL    ${fmt(totals.statements)}`)
  console.log(`allers-retours  ${fmt(roundTrips)}`)
  console.log(`stockage        ${(pages * pageSize / 1024 / 1024).toFixed(1)} Mo`)

  if (ascent > 0) {
    console.log(`\npar question d'ascension : ${(totals.rowsRead / ascent).toFixed(1)} lues`
      + ` · ${(totals.rowsWritten / ascent).toFixed(1)} écrites`)
  }

  console.log('\n── par endpoint ──')
  for (const [name, entry] of [...byOp.entries()].sort((a, b) => b[1].rowsRead - a[1].rowsRead)) {
    console.log(`${name.padEnd(24)} lues ${fmt(entry.rowsRead).padStart(12)}`
      + `  écrites ${fmt(entry.rowsWritten).padStart(10)}  requêtes ${fmt(entry.statements).padStart(10)}`)
  }

  console.log('\n── par requête (top 18 en lecture) ──')
  for (const [shape, entry] of [...byShape.entries()].sort((a, b) => b[1].rowsRead - a[1].rowsRead).slice(0, 18)) {
    console.log(`${shape.padEnd(34)} lues ${fmt(entry.rowsRead).padStart(12)}`
      + `  écrites ${fmt(entry.rowsWritten).padStart(10)}  × ${fmt(entry.statements)}`)
  }

  if (JSON_OUT) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(JSON_OUT, JSON.stringify({
      label: LABEL,
      params: { PLAYERS, DAYS, QPD, ACCURACY, DECK_PER_FLOOR, SPELLS, CALENDAR },
      play: {
        ascent,
        recovery: sum(tally => tally.recovery),
        cooldowns: sum(tally => tally.cooldowns),
        chests: sum(tally => tally.chests),
        casts: sum(tally => tally.casts),
        days: sum(tally => tally.days) / PLAYERS,
        finished: tallies.filter(tally => tally.finished).length,
      },
      totals,
      roundTrips,
      bytes: pages * pageSize,
      byOp: Object.fromEntries(byOp),
      byShape: Object.fromEntries(byShape),
    }, null, 2))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
