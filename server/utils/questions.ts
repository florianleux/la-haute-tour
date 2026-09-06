import { and, asc, count, eq, inArray, like, max } from 'drizzle-orm'
import { z } from 'zod'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { floorSize, recountSeenBy, shiftFloorSize, wholeDeckSize } from './deck'
import { acceptedAnswers, questions, seenQuestions } from '../db/schema'
import type { Database } from '../db/client'

/**
 * Le deck vu par l'administration : une question et tout ce qui la valide, lus et
 * écrits ensemble — l'admin n'édite jamais une réponse acceptée toute seule.
 * L'étage, lui, ne s'édite pas : la répartition en 6 étages appartient au script
 * d'import. Voir specs/admin.md#gestion-des-questions.
 */
export interface AdminQuestion {
  id: string
  statement: string
  answerLabel: string
  floor: number
  acceptedAnswers: string[]
}

/** Ce qu'il faut pour créer une question : son contenu et l'étage qui l'accueille. */
export type QuestionDraft = Omit<AdminQuestion, 'id'>

/** Ce qui s'édite : le contenu, sans l'étage. */
export type QuestionEdit = Omit<QuestionDraft, 'floor'>

/**
 * Les deux écritures partagent la même frontière : un énoncé et une réponse
 * affichée non vides, et au moins une réponse acceptée — sans elle, la question
 * serait imbattable.
 */
export const questionEditSchema = z.object({
  statement: z.string().trim().min(1),
  answerLabel: z.string().trim().min(1),
  acceptedAnswers: z.array(z.string().trim().min(1)).min(1),
}) satisfies z.ZodType<QuestionEdit>

/** La création choisit en plus l'étage, qui doit être un étage de la tour. */
export const questionDraftSchema = questionEditSchema.extend({
  floor: floorSchema(),
}) satisfies z.ZodType<QuestionDraft>

/** Le filtre de la liste : un étage de la tour, une recherche, et la page. */
export const questionsQuerySchema = z.object({
  // La query arrive en chaîne : la coercition est ce qui la rend comparable.
  floor: z.coerce.number().pipe(floorSchema()).optional(),
  // Recherche en texte libre sur l'énoncé : un fragment suffit, insensible à la
  // casse. Vide signifie « toutes ».
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export interface QuestionsQuery {
  floor?: number
  search?: string
  limit: number
  offset: number
}

function floorSchema(): z.ZodNumber {
  return z.number().int().min(1).max(FLOOR_COUNT)
}

/**
 * Les questions de la page demandée, avec leurs réponses acceptées et le total
 * au-dessus du filtre. La pagination se fait sur les questions, pas sur la
 * jointure : les réponses acceptées d'une question peuvent être nombreuses sans
 * repousser les questions suivantes hors de la page.
 */
export async function listQuestions(
  db: Database,
  query: QuestionsQuery,
): Promise<{ questions: AdminQuestion[]; total: number }> {
  // `LIKE` est insensible à la casse en SQLite pour l'ASCII : un fragment
  // d'énoncé suffit, sans distinguer majuscules et minuscules.
  const conditions = [
    query.floor === undefined ? undefined : eq(questions.floor, query.floor),
    query.search ? like(questions.statement, `%${query.search}%`) : undefined,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== undefined)
  const where = conditions.length ? and(...conditions) : undefined

  // Sans recherche, le total se lit au deck : une ligne par étage, contre un
  // parcours du deck entier. Une recherche, elle, impose le parcours — un
  // `LIKE '%…%'` ne s'indexe pas — mais c'est le seul cas qui le paie.
  // Voir server/utils/deck.ts.
  const total = query.search
    ? (await db.select({ value: count() }).from(questions).where(where))[0].value
    : query.floor === undefined
        ? await wholeDeckSize(db)
        : await floorSize(db, query.floor)

  // Paginer sur les questions : on tire d'abord les ids de la page, puis on
  // ramène leurs réponses acceptées — sinon une question à plusieurs réponses
  // pousserait la suivante hors de la page.
  //
  // Trié dans l'ordre du deck, celui que l'index `(floor, rank)` porte déjà :
  // la page est un saut dans l'index, là où trier par date de création
  // parcourait tout le deck et le triait en mémoire, à chaque frappe de la
  // recherche. C'est aussi l'ordre que le joueur rencontrera.
  const idRows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(where)
    .orderBy(asc(questions.floor), asc(questions.rank))
    .limit(query.limit)
    .offset(query.offset)

  const ids = idRows.map(row => row.id)

  if (!ids.length) {
    return { questions: [], total }
  }

  const rows = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      answerLabel: questions.answerLabel,
      floor: questions.floor,
      accepted: acceptedAnswers.text,
    })
    .from(questions)
    .leftJoin(acceptedAnswers, eq(acceptedAnswers.questionId, questions.id))
    .where(inArray(questions.id, ids))
    .orderBy(asc(questions.floor), asc(questions.rank), asc(acceptedAnswers.id))

  // Une question sans réponse acceptée existe en base ; l'admin doit pouvoir
  // la voir pour la réparer, d'où la jointure externe. L'ordre des ids de la
  // page est préservé.
  const listed = new Map<string, AdminQuestion>()

  for (const id of ids) {
    listed.set(id, { id, statement: '', answerLabel: '', floor: 0, acceptedAnswers: [] })
  }

  for (const row of rows) {
    const question = listed.get(row.id)!
    question.statement = row.statement
    question.answerLabel = row.answerLabel
    question.floor = row.floor

    if (row.accepted !== null) {
      question.acceptedAnswers.push(row.accepted)
    }
  }

  return { questions: ids.map(id => listed.get(id)!), total }
}

export async function addQuestion(db: Database, draft: QuestionDraft): Promise<AdminQuestion> {
  // Une question ajoutée se range à la fin de son étage : les rangs déjà servis
  // ne bougent pas, sinon les joueurs en cours sauteraient des questions ou en
  // reverraient. Voir specs/mecanique.md#ascension.
  const [{ last }] = await db
    .select({ last: max(questions.rank) })
    .from(questions)
    .where(eq(questions.floor, draft.floor))

  const [created] = await db
    .insert(questions)
    .values({
      statement: draft.statement,
      answerLabel: draft.answerLabel,
      floor: draft.floor,
      rank: (last ?? 0) + 1,
    })
    .returning()

  // L'étage vient de grandir : son compte suit, dans le même lot que la
  // question — comptés séparément, les deux pourraient se contredire.
  // Voir server/utils/deck.ts.
  await db.batch([shiftFloorSize(db, draft.floor, 1)])

  await replaceAcceptedAnswers(db, created.id, draft.acceptedAnswers)

  // Recomposée plutôt que diffusée : la ligne Drizzle porte un `createdAt` que
  // l'administration n'a pas demandé, et qui partirait dans le JSON.
  return { ...draft, id: created.id }
}

/** Rend null quand la question n'existe pas : l'appelant en fait un 404. */
export async function editQuestion(
  db: Database,
  id: string,
  edit: QuestionEdit,
): Promise<AdminQuestion | null> {
  const [updated] = await db
    .update(questions)
    .set({ statement: edit.statement, answerLabel: edit.answerLabel })
    .where(eq(questions.id, id))
    .returning()

  if (!updated) {
    return null
  }

  await replaceAcceptedAnswers(db, id, edit.acceptedAnswers)

  return { ...edit, id, floor: updated.floor }
}

/**
 * Rend false quand la question n'existait pas.
 *
 * Supprimer une question l'efface partout, par cascade : ses réponses acceptées,
 * mais aussi les traces qu'elle a laissées chez les joueurs — vue, Pool Échecs,
 * réservation en cours. C'est cohérent plutôt que destructeur : l'étage perd une
 * question *et* une question vue, donc la progression ne bouge pas ; seul un
 * joueur qui la tenait à l'instant même la voit disparaître de son écran.
 */
export async function removeQuestion(db: Database, id: string): Promise<boolean> {
  // Qui l'avait vue, lu avant la suppression : la cascade emporte ces lignes-là,
  // et un décompte porté ne peut pas deviner qu'il vient d'en perdre une.
  const seenBy = await db
    .select({ userId: seenQuestions.userId })
    .from(seenQuestions)
    .where(eq(seenQuestions.questionId, id))

  const [deleted] = await db.delete(questions).where(eq(questions.id, id)).returning()

  if (!deleted) {
    return false
  }

  // L'étage vient de rétrécir : le palier tomberait au mauvais endroit si on
  // gardait l'ancien compte. Voir server/utils/deck.ts.
  await db.batch([shiftFloorSize(db, deleted.floor, -1)])
  await recountSeenBy(db, [...new Set(seenBy.map(row => row.userId))])

  return true
}

/**
 * Les réponses acceptées d'une question sont une liste, pas des lignes qu'on
 * modifie une à une : l'admin envoie celle qu'il veut, on remplace.
 */
async function replaceAcceptedAnswers(db: Database, id: string, texts: string[]): Promise<void> {
  await db.delete(acceptedAnswers).where(eq(acceptedAnswers.questionId, id))

  await db.insert(acceptedAnswers).values(texts.map(text => ({ questionId: id, text })))
}
