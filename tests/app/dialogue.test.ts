import { describe, expect, it } from 'vitest'
import { dialogueGesture, dialogueStage, revealedLength } from '../../utils/dialogue'
import type { DialogueLine, Speaker } from '../../utils/dialogue'

const GANDALF: Speaker = { name: 'Gandalf', portrait: '/gandalf.webp', side: 'left' }
const EOWYN: Speaker = { name: 'Éowyn', portrait: '/eowyn.webp', side: 'right' }
const SARUMAN: Speaker = { name: 'Saroumane', portrait: '/saroumane.webp', side: 'left' }

function line(speaker: Speaker, text = 'Te voilà.'): DialogueLine {
  return { speaker, text }
}

describe('qui tient l affiche', () => {
  it('pose un portrait de chaque côté', () => {
    expect(dialogueStage([line(GANDALF), line(EOWYN)])).toEqual({
      left: GANDALF,
      right: EOWYN,
    })
  })

  it('pose les deux dès la première réplique, avant même que le second parle', () => {
    // Sans ça, le portrait de droite apparaîtrait au milieu du dialogue.
    expect(dialogueStage([line(GANDALF), line(EOWYN)]).right).toEqual(EOWYN)
  })

  it('laisse un côté vide quand personne n y parle', () => {
    expect(dialogueStage([line(GANDALF)])).toEqual({ left: GANDALF, right: null })
  })

  it('donne le côté au premier rencontré quand deux s y disputent la place', () => {
    expect(dialogueStage([line(GANDALF), line(SARUMAN)]).left).toEqual(GANDALF)
  })
})

describe('ce qu un geste fait du dialogue', () => {
  it('affiche la réplique en entier tant qu elle défile', () => {
    expect(dialogueGesture({ index: 0, revealed: false }, 3)).toBe('reveal')
  })

  it('passe à la suivante une fois qu elle est sortie', () => {
    expect(dialogueGesture({ index: 0, revealed: true }, 3)).toBe('next')
  })

  it('rend la main après la dernière', () => {
    expect(dialogueGesture({ index: 2, revealed: true }, 3)).toBe('end')
  })

  it('révèle d abord la dernière, sans la sauter', () => {
    // Un dialogue ne se termine jamais sur une réplique à moitié lue.
    expect(dialogueGesture({ index: 2, revealed: false }, 3)).toBe('reveal')
  })

  it('rend la main dès la première quand il n y en a qu une', () => {
    expect(dialogueGesture({ index: 0, revealed: true }, 1)).toBe('end')
  })
})

describe('le défilé du texte', () => {
  it('ne sort rien au premier instant', () => {
    expect(revealedLength(0, 30, 10)).toBe(0)
  })

  it('sort un caractère par battement', () => {
    expect(revealedLength(30, 30, 10)).toBe(1)
    expect(revealedLength(90, 30, 10)).toBe(3)
  })

  it('ne sort le caractère qu une fois son temps écoulé', () => {
    expect(revealedLength(29, 30, 10)).toBe(0)
  })

  it('s arrête à la fin du texte', () => {
    // Le temps continue de courir après le dernier caractère : sans la borne,
    // le découpage partirait au-delà de la réplique.
    expect(revealedLength(10_000, 30, 10)).toBe(10)
  })

  it('ne sort rien d un texte vide', () => {
    expect(revealedLength(10_000, 30, 0)).toBe(0)
  })
})
