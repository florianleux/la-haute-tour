import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { useEmptyAnswerHold } from '../../composables/useEmptyAnswerHold'

// Une réponse vide coûte une vie, et Entrée vient de passer le verdict : un
// double appui un peu rapide grillerait la question qui s'affiche.
// Voir specs/ecrans.md#ascent--question.

let scope = effectScope()

afterEach(() => {
  scope.stop()
  scope = effectScope()
})

function hold(answer = '', question = 'q1') {
  const typed = ref(answer)
  const questionId = ref(question)
  const held = scope.run(() => useEmptyAnswerHold(() => typed.value, () => questionId.value))!

  return { typed, questionId, ...held }
}

describe('envoi vide retenu', () => {
  it('retient un premier envoi vide ou blanc et dit comment il est venu', () => {
    const { holds, heldEmptySend } = hold('   ')

    expect(holds('enter')).toBe(true)
    expect(heldEmptySend.value).toBe('enter')
  })

  it('laisse partir le second envoi, de l une ou l autre façon', () => {
    const { holds, heldEmptySend } = hold()

    holds('enter')

    expect(holds('click')).toBe(false)
    expect(heldEmptySend.value).toBeNull()
  })

  it('ne retient jamais une réponse écrite', () => {
    const { holds, heldEmptySend } = hold('bordeaux')

    expect(holds('enter')).toBe(false)
    expect(heldEmptySend.value).toBeNull()
  })

  it('oublie l envoi retenu dès que le joueur tape', async () => {
    const { typed, holds, heldEmptySend } = hold()

    holds('click')
    typed.value = 'b'
    expect(heldEmptySend.value).toBeNull()

    // Effacé de nouveau : le prochain envoi vide est retenu à son tour.
    typed.value = ''
    await nextTick()
    expect(holds('click')).toBe(true)
  })

  it('oublie l envoi retenu quand une autre question arrive', () => {
    const { questionId, holds, heldEmptySend } = hold()

    holds('enter')
    questionId.value = 'q2'

    expect(heldEmptySend.value).toBeNull()
  })
})
