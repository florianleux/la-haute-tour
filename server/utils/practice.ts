import { isAnswerAccepted } from '../../shared/utils/answers'
import { rulesForFloor } from './rules'
import type { User } from '../db/schema'
import type { ShownQuestion, Verdict } from './game'

/**
 * La question d'essai de la leçon du camp : écrite ici, jamais dans le deck.
 * Voir specs/spec.md (glossaire, « Question d'essai »).
 */
const PRACTICE_QUESTION = {
  id: 'practice',
  statement: 'De quelle couleur était le cheval blanc d\'Henri IV ?',
  answerLabel: 'Blanc',
  acceptedAnswers: ['Blanc'],
}

/**
 * Ce que l'écran de l'essai affiche avant la réponse : ce qu'une question servie
 * montre, sans échéance — le chrono part quand Michel se tait.
 */
export interface PracticeQuestion extends ShownQuestion {
  /** Le chrono de l'étage du joueur, lu dans les règles : rien ne l'écrit en dur. */
  timerMs: number
}

export function practiceQuestion(user: User): PracticeQuestion {
  return {
    id: PRACTICE_QUESTION.id,
    statement: PRACTICE_QUESTION.statement,
    lootQuestion: false,
    timerMs: rulesForFloor(user.currentFloor).ascentTimerMs,
  }
}

/**
 * Le verdict de l'essai : le même juge qu'une vraie question, tolérance aux
 * fautes comprise, mais rien ne s'écrit — ni vie, ni série, ni vue, ni Pool
 * Échecs, ni coffre.
 */
export function judgePractice(answer: string): Verdict {
  return {
    questionId: PRACTICE_QUESTION.id,
    statement: PRACTICE_QUESTION.statement,
    correct: isAnswerAccepted(answer, PRACTICE_QUESTION.acceptedAnswers),
    answerLabel: PRACTICE_QUESTION.answerLabel,
    submittedAnswer: answer,
    lifeLost: false,
    leftThePage: false,
  }
}
