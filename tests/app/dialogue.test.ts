import { describe, expect, it } from 'vitest'
import { dialogueGesture, revealedLength } from '../../utils/dialogue'
import type { Dialogue, Speaker } from '../../utils/dialogue'

const GANDALF: Speaker = { name: 'Gandalf', portrait: '/gandalf.webp' }
const EOWYN: Speaker = { name: 'Éowyn', portrait: '/eowyn.webp' }
const SARUMAN: Speaker = { name: 'Saroumane', portrait: '/saroumane.webp' }

const BG = '/images/play-bg.webp'

/**
 * Ce que la forme d'un dialogue refuse. Ces déclarations ne s'exécutent jamais :
 * c'est `nuxt typecheck` qui les lit, et un `@ts-expect-error` échoue le jour où
 * l'erreur qu'il attend cesse d'arriver. C'est là que vit l'invariant « deux
 * interlocuteurs au plus, et personne ne parle d'une place vide » depuis qu'il a
 * quitté le runtime. Voir ADR 0010.
 */
const DUO: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  lines: [
    { place: 'left', text: 'Te voilà enfin.' },
    { place: 'right', text: 'Tu m\'attendais ?' },
  ],
}

const SEUL: Dialogue = {
  background: BG,
  center: GANDALF,
  revealMs: 60,
  lines: [{ place: 'center', text: 'Personne d\'autre ne viendra.' }],
}

// @ts-expect-error un troisième interlocuteur n'a aucune place où se tenir
const TROIS: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  center: SARUMAN,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

// @ts-expect-error personne ne se tient au milieu d'un dialogue à deux
const MILIEU_SANS_PERSONNE: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  lines: [{ place: 'center', text: 'Te voilà enfin.' }],
}

// @ts-expect-error un interlocuteur seul se tient au milieu, pas à gauche
const SEUL_A_GAUCHE: Dialogue = {
  background: BG,
  center: GANDALF,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

// @ts-expect-error un dialogue à deux qui n'en déclare qu'un
const DUO_AMPUTE: Dialogue = {
  background: BG,
  left: GANDALF,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

describe('les formes qu un dialogue accepte', () => {
  it('porte deux interlocuteurs, un de chaque côté', () => {
    expect(DUO.left).toEqual(GANDALF)
    expect(DUO.right).toEqual(EOWYN)
  })

  it('ou un seul, au milieu', () => {
    expect(SEUL.center).toEqual(GANDALF)
    expect(SEUL.left).toBeUndefined()
  })

  it('refuse les formes bancales à la compilation, pas à l exécution', () => {
    // Ces quatre-là n'existent que pour leur `@ts-expect-error` ; les citer ici
    // empêche le lint de les déclarer inutilisées, et dit à quoi elles servent.
    expect([TROIS, MILIEU_SANS_PERSONNE, SEUL_A_GAUCHE, DUO_AMPUTE]).toHaveLength(4)
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

  it('suit le rythme qu on lui donne : deux fois plus lent, deux fois moins sorti', () => {
    expect(revealedLength(120, 60, 10)).toBe(2)
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
