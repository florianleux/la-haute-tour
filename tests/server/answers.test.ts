import { describe, expect, it } from 'vitest'
import { isAnswerAccepted, normalizeAnswer } from '../../server/utils/answers'

describe('normalisation', () => {
  it('met de côté casse, espaces, accents et ponctuation', () => {
    expect(normalizeAnswer('  Élysée !  ')).toBe('elysee')
  })

  it('laisse tomber les articles', () => {
    expect(normalizeAnswer('la ville de Bordeaux')).toBe('ville bordeaux')
  })

  it('rend une chaîne vide pour une réponse vide', () => {
    expect(normalizeAnswer('   ')).toBe('')
  })
})

describe('tolérance aux fautes', () => {
  const accepted = ['Bordeaux', 'la ville de Bordeaux']

  it('accepte la réponse exacte', () => {
    expect(isAnswerAccepted('Bordeaux', accepted)).toBe(true)
  })

  it('accepte une faute de frappe sur n importe quelle réponse acceptée', () => {
    expect(isAnswerAccepted('Bordaux', accepted)).toBe(true)
    expect(isAnswerAccepted('la ville de Bordaux', accepted)).toBe(true)
  })

  it('accepte jusqu à deux fautes, pas trois', () => {
    expect(isAnswerAccepted('Bordeuax', ['Bordeaux'])).toBe(true)
    expect(isAnswerAccepted('Brdax', ['Bordeaux'])).toBe(false)
  })

  it('refuse une réponse vide, quelles que soient les réponses acceptées', () => {
    expect(isAnswerAccepted('', accepted)).toBe(false)
    expect(isAnswerAccepted('   ', accepted)).toBe(false)
  })

  it('refuse une réponse vide même face à une réponse acceptée très courte', () => {
    expect(isAnswerAccepted('', ['ok'])).toBe(false)
  })

  it('refuse une réponse sans rapport', () => {
    expect(isAnswerAccepted('Toulouse', accepted)).toBe(false)
  })
})
