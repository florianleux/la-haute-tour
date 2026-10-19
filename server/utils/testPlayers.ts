import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { useDatabase } from '../db/client'
import { upcomingQuestions } from './deck'
import { cooldownFields, cooldownFrom, startOfGame } from './mechanics'
import { requirePlayer, resetPlayer } from './players'
import { numericRouteId } from './routes'
import { rulesForFloor } from './rules'
import {
  pocketSpells,
  missedPool,
  questions,
  reservations,
  seenQuestions,
  users,
} from '../db/schema'
import type { H3Event } from 'h3'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { SpellId } from '../../shared/utils/spells'

/**
 * Les joueurs test : des joueurs créés par l'admin pour éprouver le jeu, sans
 * compte Discord derrière. Ils jouent une vraie partie — mêmes tables, mêmes
 * règles — mais dans un monde scellé, sans contact avec les vrais joueurs.
 * Voir specs/admin.md#joueurs-test.
 */

/**
 * Le joueur test qu'un geste d'admin vise. Un vrai joueur est refusé plutôt
 * qu'introuvable : le distinguer dit à l'appelant que la cible existe, mais
 * qu'elle n'est pas de celles qu'on manipule.
 */
export async function requireTestPlayer(db: Database, id: number): Promise<User> {
  const player = await requirePlayer(db, id)

  assertTestPlayer(player)

  return player
}

/**
 * Le joueur test que la route désigne. La lecture du paramètre vit dans
 * `numericRouteId()`, avec les gestes qui visent un joueur ordinaire — il n'y a
 * qu'un identifiant de route, donc qu'une définition de ce qu'il vaut.
 */
export async function testPlayerFromRoute(event: H3Event): Promise<User> {
  return requireTestPlayer(useDatabase(), numericRouteId(event, 'Joueur inconnu'))
}

export async function listTestPlayers(db: Database): Promise<User[]> {
  return db.select().from(users).where(eq(users.isTest, true)).orderBy(asc(users.id))
}

/**
 * Un joueur test de plus, nommé à la suite des autres — Testeur A, B, C. Le nom
 * suit le premier rang libre plutôt que le nombre de joueurs test : après une
 * suppression, c'est la lettre libérée qui resert, et deux joueurs test ne
 * portent jamais le même nom.
 *
 * Le `discordId` est synthétique et se lit comme tel : aucune connexion Discord
 * ne peut le produire, donc aucun compte réel ne viendra le heurter.
 */
export async function createTestPlayer(db: Database, now: Date): Promise<User> {
  const taken = new Set((await listTestPlayers(db)).map(player => player.username))

  let rank = 0
  while (taken.has(testPlayerName(rank))) {
    rank++
  }

  const [created] = await db
    .insert(users)
    .values({
      discordId: `test-${crypto.randomUUID()}`,
      username: testPlayerName(rank),
      isTest: true,
      ...startOfGame(),
      // Une tentative ouverte à l'instant : sans elle, tout ce que le joueur
      // test verra plus tard daterait de l'époque zéro.
      attemptStartedAt: now,
    })
    .returning()

  return created
}

/**
 * Supprime un joueur test et, avec lui, tout ce qu'il a joué : les clés
 * étrangères des tables de jeu sont en `cascade`.
 */
export async function deleteTestPlayer(db: Database, testPlayer: User): Promise<void> {
  assertTestPlayer(testPlayer)

  await db.delete(users).where(eq(users.id, testPlayer.id))
}

/**
 * Les gestes que l'admin exerce sur un joueur test. Chacun laisse la base dans
 * un état que le jeu sait produire de lui-même : ce sont des raccourcis vers
 * des situations de jeu, jamais des états impossibles — sans quoi on déboguerait
 * le jeu contre quelque chose qu'aucun joueur n'atteindra.
 * Voir specs/admin.md#réglages-dun-joueur-test.
 */

/** Un exemplaire de plus en poche, comme un coffre en donne un. */
export async function grantSpell(db: Database, testPlayer: User, spell: SpellId, now: Date): Promise<void> {
  assertTestPlayer(testPlayer)

  await db.insert(pocketSpells).values({ userId: testPlayer.id, spell, obtainedAt: now })
}

export interface AdvanceOptions {
  count: number
  /** Justes, ou fausses — les fausses remplissent le Pool Échecs comme en jeu. */
  correct: boolean
}

/**
 * Avancer dans l'étage sans le jouer : les `count` questions suivantes du deck
 * sont marquées vues. Le parcours est celui de l'ascension, à la lettre — un
 * joueur test avance donc dans le même ordre qu'un vrai joueur, et s'arrête à ce
 * que l'étage contient encore. Voir server/utils/deck.ts.
 */
export async function advanceTestPlayer(
  db: Database,
  testPlayer: User,
  { count, correct }: AdvanceOptions,
  now: Date,
): Promise<void> {
  assertTestPlayer(testPlayer)

  const upcoming = await upcomingQuestions(db, testPlayer, count)

  if (!upcoming.length) {
    return
  }

  const markSeen = db.insert(seenQuestions).values(upcoming.map(question => ({
    userId: testPlayer.id,
    questionId: question.id,
    floor: testPlayer.currentFloor,
    correct,
    seenAt: now,
  })))

  // Le curseur et les décomptes avancent ensemble, comme en jeu : le joueur
  // porte ses questions vues, il ne les compte pas. Voir server/db/schema.ts.
  const moveCursor = db
    .update(users)
    .set({
      floorCursor: upcoming[upcoming.length - 1].rank,
      floorSeen: sql`${users.floorSeen} + ${upcoming.length}`,
      attemptSeen: sql`${users.attemptSeen} + ${upcoming.length}`,
      seenTotal: sql`${users.seenTotal} + ${upcoming.length}`,
      // La série suit ce que le raccourci vient de faire : avancer en justes
      // l'allonge, avancer en fausses la casse. Sans quoi un joueur test poussé
      // jusqu'au palier y arriverait avec une série que sa partie ne décrit pas.
      streak: correct ? sql`${users.streak} + ${upcoming.length}` : sql`0`,
    })
    .where(eq(users.id, testPlayer.id))

  // Une erreur dépose la question au Pool Échecs, comme en jeu. Les deux lots
  // s'écrivent en entier plutôt que de se composer : Drizzle type un lot par
  // les tables qu'il touche, et un tableau qui grandit perd ce typage.
  if (correct) {
    await db.batch([markSeen, moveCursor])
    return
  }

  await db.batch([
    markSeen,
    moveCursor,
    db.insert(missedPool).values(upcoming.map(question => ({
      userId: testPlayer.id,
      questionId: question.id,
      floor: testPlayer.currentFloor,
      lastFailedAt: now,
    }))),
  ])
}

/**
 * Revenir en arrière dans l'étage : les `count` derniers passages sont effacés,
 * et le Pool Échecs perd les leurs — le passage n'a pas eu lieu, il n'a donc
 * rien pu y déposer. La réservation en cours part avec eux : elle pointerait un
 * passage disparu.
 */
export async function rewindTestPlayer(db: Database, testPlayer: User, count: number): Promise<void> {
  assertTestPlayer(testPlayer)

  const last = await db
    .select({ questionId: seenQuestions.questionId, rank: questions.rank })
    .from(seenQuestions)
    .innerJoin(questions, eq(questions.id, seenQuestions.questionId))
    .where(and(eq(seenQuestions.userId, testPlayer.id), eq(seenQuestions.floor, testPlayer.currentFloor)))
    .orderBy(desc(questions.rank))
    .limit(count)

  if (!last.length) {
    return
  }

  const erased = last.map(row => row.questionId)
  // Le curseur retombe sur le rang le plus haut qui reste vu — zéro quand il ne
  // reste rien, c'est-à-dire un étage jamais entamé.
  const cursor = Math.min(...last.map(row => row.rank)) - 1

  await db.batch([
    db
      .delete(seenQuestions)
      .where(and(eq(seenQuestions.userId, testPlayer.id), inArray(seenQuestions.questionId, erased))),
    db
      .delete(missedPool)
      .where(and(eq(missedPool.userId, testPlayer.id), inArray(missedPool.questionId, erased))),
    db.delete(reservations).where(eq(reservations.userId, testPlayer.id)),
    db
      .update(users)
      .set({
        floorCursor: cursor,
        floorSeen: sql`max(0, ${users.floorSeen} - ${erased.length})`,
        attemptSeen: sql`max(0, ${users.attemptSeen} - ${erased.length})`,
      })
      .where(eq(users.id, testPlayer.id)),
  ])
}

/**
 * Ouvrir une attente : c'est la seule phase où les Sorts se lancent, donc le
 * point de départ de la plupart des essais. La durée vient des règles, jamais
 * d'un nombre écrit ici.
 */
export async function sendToCooldown(db: Database, testPlayer: User, now: Date): Promise<void> {
  assertTestPlayer(testPlayer)

  await db.batch([
    // Une question réservée survivrait à la perte des vies et continuerait de
    // s'afficher : elle appartient à la tentative qui s'achève.
    db.delete(reservations).where(eq(reservations.userId, testPlayer.id)),
    db
      .update(users)
      .set({ lives: 0, ...cooldownFields(cooldownFrom(rulesForFloor(testPlayer.currentFloor), now), now) })
      .where(eq(users.id, testPlayer.id)),
  ])
}

/**
 * Effacer la partie d'un joueur test et le rendre neuf. Tous les effets partent
 * avec elle, donc écrire `attemptStartedAt` ici ne peut désaccorder aucune ancre
 * — c'est la seule raison pour laquelle ce geste peut se passer d'openAttempt().
 * La remise à zéro elle-même est partagée avec un vrai joueur : voir
 * `resetPlayer()` dans server/utils/players.ts. Voir server/utils/journey.ts.
 */
export async function resetTestPlayer(db: Database, testPlayer: User, now: Date): Promise<void> {
  assertTestPlayer(testPlayer)

  await resetPlayer(db, testPlayer, now)
}

/**
 * Les gestes ne s'exercent que sur un joueur test. La garde vit ici plutôt que
 * dans les seuls endpoints : c'est la fonction qui écrit qui doit refuser, pas
 * la route qui l'appelle.
 */
function assertTestPlayer(player: User): void {
  if (!player.isTest) {
    throw createError({ statusCode: 403, statusMessage: 'Réservé aux joueurs test' })
  }
}

/** Testeur A, B, C… puis Testeur AA quand l'alphabet est épuisé. */
function testPlayerName(rank: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const loops = Math.floor(rank / letters.length) + 1

  return `Testeur ${letters[rank % letters.length].repeat(loops)}`
}
