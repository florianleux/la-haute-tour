import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { acceptedAnswers, questions } from '../db/schema'
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

/** Le filtre de la liste : un étage de la tour, ou rien — tout le deck. */
export const floorFilterSchema = z.object({
  // La query arrive en chaîne : la coercition est ce qui la rend comparable.
  floor: z.coerce.number().pipe(floorSchema()).optional(),
})

function floorSchema(): z.ZodNumber {
  return z.number().int().min(1).max(FLOOR_COUNT)
}

/**
 * Les questions de l'étage demandé, ou tout le deck. Une seule requête : les
 * réponses acceptées arrivent avec leur question plutôt qu'en N+1.
 */
export async function listQuestions(db: Database, floor?: number): Promise<AdminQuestion[]> {
  const rows = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      answerLabel: questions.answerLabel,
      floor: questions.floor,
      // Une question sans réponse acceptée existe en base ; l'admin doit pouvoir
      // la voir pour la réparer, d'où la jointure externe.
      accepted: acceptedAnswers.text,
    })
    .from(questions)
    .leftJoin(acceptedAnswers, eq(acceptedAnswers.questionId, questions.id))
    .where(floor === undefined ? undefined : eq(questions.floor, floor))
    .orderBy(asc(questions.floor), asc(questions.createdAt), asc(acceptedAnswers.id))

  const listed = new Map<string, AdminQuestion>()

  for (const row of rows) {
    const question = listed.get(row.id) ?? {
      id: row.id,
      statement: row.statement,
      answerLabel: row.answerLabel,
      floor: row.floor,
      acceptedAnswers: [],
    }

    if (row.accepted !== null) {
      question.acceptedAnswers.push(row.accepted)
    }

    listed.set(row.id, question)
  }

  return [...listed.values()]
}

export async function addQuestion(db: Database, draft: QuestionDraft): Promise<AdminQuestion> {
  const [created] = await db
    .insert(questions)
    .values({
      statement: draft.statement,
      answerLabel: draft.answerLabel,
      floor: draft.floor,
    })
    .returning()

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
  const deleted = await db.delete(questions).where(eq(questions.id, id)).returning()

  return deleted.length > 0
}

/**
 * Les réponses acceptées d'une question sont une liste, pas des lignes qu'on
 * modifie une à une : l'admin envoie celle qu'il veut, on remplace.
 */
async function replaceAcceptedAnswers(db: Database, id: string, texts: string[]): Promise<void> {
  await db.delete(acceptedAnswers).where(eq(acceptedAnswers.questionId, id))

  await db.insert(acceptedAnswers).values(texts.map(text => ({ questionId: id, text })))
}
