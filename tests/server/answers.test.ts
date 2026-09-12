import { describe, expect, it } from 'vitest'
import { isAnswerAccepted, normalizeAnswer, phoneticKeys } from '../../server/utils/answers'

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

describe('lectures phonétiques', () => {
  it('rend une seule lecture pour un mot sans ambiguïté', () => {
    expect(phoneticKeys('sarkozy')).toHaveLength(1)
  })

  it('rend deux lectures quand un ch traîne, qui se dit /ʃ/ ou /k/', () => {
    expect(phoneticKeys('nabuchodonosor')).toHaveLength(2)
  })

  it('ne fait pas exploser le nombre de lectures avec le nombre de mots', () => {
    expect(phoneticKeys('chose chose chose chose')).toHaveLength(2)
  })
})

describe('validation à l oreille', () => {
  const accepted = ['Bordeaux', 'la ville de Bordeaux']

  it('accepte la réponse exacte', () => {
    expect(isAnswerAccepted('Bordeaux', accepted)).toBe(true)
  })

  it('accepte une autre orthographe du même son', () => {
    expect(isAnswerAccepted('Bordaux', accepted)).toBe(true)
    expect(isAnswerAccepted('Bordo', accepted)).toBe(true)
    expect(isAnswerAccepted('la ville de Bordo', accepted)).toBe(true)
  })

  it('accepte le s qui se prononce z entre deux voyelles', () => {
    expect(isAnswerAccepted('Sarkosy', ['Sarkozy'])).toBe(true)
  })

  it('accepte une consonne doublée ou non', () => {
    expect(isAnswerAccepted('Flemming', ['Fleming'])).toBe(true)
    expect(isAnswerAccepted('Vanesa', ['Vanessa'])).toBe(true)
  })

  it('accepte le ch dit /k/ des mots savants', () => {
    expect(isAnswerAccepted('Nabukodonosor', ['Nabuchodonosor'])).toBe(true)
  })

  it('accepte le pluriel comme le singulier, qui s entendent pareil', () => {
    expect(isAnswerAccepted('Escargots', ['Escargot'])).toBe(true)
  })

  it('refuse une faute qui change le son, même d une seule lettre', () => {
    expect(isAnswerAccepted('Rose', ['Rome'])).toBe(false)
    expect(isAnswerAccepted('Manet', ['Monet'])).toBe(false)
  })

  it('refuse une réponse sans rapport', () => {
    expect(isAnswerAccepted('Toulouse', accepted)).toBe(false)
  })

  it('refuse une réponse vide, quelles que soient les réponses acceptées', () => {
    expect(isAnswerAccepted('', accepted)).toBe(false)
    expect(isAnswerAccepted('   ', accepted)).toBe(false)
    expect(isAnswerAccepted('', ['ok'])).toBe(false)
  })
})

describe('chiffres', () => {
  it('refuse une année fausse d un seul chiffre', () => {
    expect(isAnswerAccepted('1880', ['1889'])).toBe(false)
    expect(isAnswerAccepted('1798', ['1789'])).toBe(false)
  })

  it('accepte l année juste', () => {
    expect(isAnswerAccepted('1889', ['1889'])).toBe(true)
  })

  it('garde la tolérance sur les mots qui entourent un nombre juste', () => {
    expect(isAnswerAccepted('42 195 km', ['42,195 km'])).toBe(true)
    expect(isAnswerAccepted('42 196 km', ['42,195 km'])).toBe(false)
  })

  it('refuse un chiffre romain pour un autre', () => {
    expect(isAnswerAccepted('Louis IX', ['Louis II'])).toBe(false)
    expect(isAnswerAccepted('Charles II', ['Charles III'])).toBe(false)
  })

  it('accepte le bon chiffre romain, la casse mise à part', () => {
    expect(isAnswerAccepted('louis ix', ['Louis IX'])).toBe(true)
  })
})

describe('prénom et nom', () => {
  const fleming = ['Fleming', 'Alexander Fleming', 'Fleming Alexander']

  it('accepte le nom de famille seul', () => {
    expect(isAnswerAccepted('Fleming', fleming)).toBe(true)
  })

  it('refuse le prénom seul, qui n identifie personne', () => {
    expect(isAnswerAccepted('Alexander', fleming)).toBe(false)
  })

  it('accepte le prénom écrit à la française', () => {
    expect(isAnswerAccepted('Alexandre Fleming', fleming)).toBe(true)
  })

  it('accepte le prénom réduit à son initiale', () => {
    expect(isAnswerAccepted('A. Fleming', fleming)).toBe(true)
  })

  it('accepte une initiale qui est aussi un chiffre romain', () => {
    // C, D, I, L, M, V et X ouvrent des prénoms courants autant qu'elles
    // chiffrent des rois.
    expect(isAnswerAccepted('I. Fleming', ['Fleming', 'Ian Fleming'])).toBe(true)
    expect(isAnswerAccepted('V. Hugo', ['Hugo', 'Victor Hugo'])).toBe(true)
    expect(isAnswerAccepted('C. Monet', ['Monet', 'Claude Monet'])).toBe(true)
  })

  it('refuse une lettre seule en face d un vrai chiffre romain', () => {
    expect(isAnswerAccepted('Louis I', ['Louis II'])).toBe(false)
  })

  it('accepte un prénom homophone du bon', () => {
    expect(isAnswerAccepted('Yann Fleming', ['Fleming', 'Ian Fleming'])).toBe(true)
  })

  it('refuse un prénom qui désigne quelqu un d autre', () => {
    expect(isAnswerAccepted('Ian Fleming', fleming)).toBe(false)
    expect(isAnswerAccepted('Arthur Fleming', fleming)).toBe(false)
  })

  it('refuse d aligner plusieurs noms pour ratisser', () => {
    expect(isAnswerAccepted('Fleming Pasteur', fleming)).toBe(false)
  })

  it('n accorde ce jeu qu à un seul mot', () => {
    expect(isAnswerAccepted('Alexandre Flemingue', fleming)).toBe(false)
  })

  it('n accorde aucun jeu à une réponse d un seul mot', () => {
    expect(isAnswerAccepted('Manet', ['Monet'])).toBe(false)
  })

  it('n accorde aucun jeu à un chiffre romain', () => {
    expect(isAnswerAccepted('Charles III', ['Charles II'])).toBe(false)
  })
})
