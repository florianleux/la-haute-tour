import { effectScope, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { installAppGlobals } from '../helpers/app'
import { dialogueGesture, revealedLength } from '../../utils/dialogue'
import type { Dialogue, Speaker } from '../../utils/dialogue'
import type { Ref } from 'vue'

// Les auto-imports de Nuxt n'existent pas sous Vitest : `ref`, `computed` et
// `onScopeDispose` arrivent par là, comme pour les autres composables testés.
installAppGlobals()

const { useDialogue } = await import('../../composables/useDialogue')

const START = new Date('2026-09-17T12:00:00.000Z').getTime()

/**
 * Dans une page, le composant possède la portée du composable et la libère en se
 * démontant. Ici c'est le test.
 */
let scope = effectScope()

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
const PAIR: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  lines: [
    { place: 'left', text: 'Te voilà enfin.' },
    { place: 'right', text: 'Tu m\'attendais ?' },
  ],
}

const SOLO: Dialogue = {
  background: BG,
  center: GANDALF,
  revealMs: 60,
  lines: [
    { place: 'center', text: 'Personne d\'autre ne viendra.' },
    { place: 'center', text: 'La porte est refermée.' },
  ],
}

// @ts-expect-error un troisième interlocuteur n'a aucune place où se tenir
const THIRD_SPEAKER: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  center: SARUMAN,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

// @ts-expect-error personne ne se tient au milieu d'un dialogue à deux
const EMPTY_MIDDLE: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  lines: [{ place: 'center', text: 'Te voilà enfin.' }],
}

// @ts-expect-error un interlocuteur seul se tient au milieu, pas à gauche
const SOLO_ON_THE_LEFT: Dialogue = {
  background: BG,
  center: GANDALF,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

// @ts-expect-error un dialogue à deux qui n'en déclare qu'un
const HALF_PAIR: Dialogue = {
  background: BG,
  left: GANDALF,
  lines: [{ place: 'left', text: 'Te voilà enfin.' }],
}

const NO_LINES: Dialogue = {
  background: BG,
  left: GANDALF,
  right: EOWYN,
  // @ts-expect-error un dialogue sans réplique n'a rien à jouer
  lines: [],
}

describe('les formes qu un dialogue accepte', () => {
  it('porte deux interlocuteurs, un de chaque côté', () => {
    expect(PAIR.left).toEqual(GANDALF)
    expect(PAIR.right).toEqual(EOWYN)
  })

  it('ou un seul, au milieu', () => {
    expect(SOLO.center).toEqual(GANDALF)
    expect(SOLO.left).toBeUndefined()
  })

  it('refuse les formes bancales à la compilation, pas à l exécution', () => {
    // Ces cinq-là n'existent que pour leur `@ts-expect-error` ; les citer ici
    // empêche le lint de les déclarer inutilisées, et dit à quoi elles servent.
    expect([THIRD_SPEAKER, EMPTY_MIDDLE, SOLO_ON_THE_LEFT, HALF_PAIR, NO_LINES]).toHaveLength(5)
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

describe('le déroulé d un dialogue', () => {
  /**
   * L'horloge est celle du test, jamais celle du composable : `useDialogue` la
   * prend en option comme `useQuestionRun`, si bien qu'aucune minuterie ne
   * tourne ici et que le temps avance quand on le décide.
   */
  function play(dialogue: Dialogue, now: Ref<number>) {
    const ended: true[] = []
    const playback = scope.run(() => useDialogue(ref(dialogue), {
      onEnd: () => ended.push(true),
      now,
    }))!

    return { ...playback, ended }
  }

  beforeEach(() => {
    scope.stop()
    scope = effectScope()
  })

  it('ne montre rien au premier instant, comme le rendu serveur', () => {
    const now = ref(START)
    const { shown } = play(PAIR, now)

    expect(shown.value).toBe('')
  })

  it('sort la réplique caractère par caractère', () => {
    const now = ref(START)
    const { shown, revealed } = play(PAIR, now)

    now.value = START + 90
    expect(shown.value).toBe('Te ')
    expect(revealed.value).toBe(false)

    now.value = START + 450
    expect(shown.value).toBe('Te voilà enfin.')
    expect(revealed.value).toBe(true)
  })

  it('montre qui parle, et d où', () => {
    const now = ref(START)
    const { speaker, place } = play(PAIR, now)

    expect(speaker.value).toEqual(GANDALF)
    expect(place.value).toBe('left')
  })

  it('un geste pendant le défilé affiche la réplique en entier', () => {
    const now = ref(START)
    const { shown, revealed, advance } = play(PAIR, now)

    now.value = START + 60
    advance()

    expect(shown.value).toBe('Te voilà enfin.')
    expect(revealed.value).toBe(true)
  })

  it('le geste suivant passe à l interlocuteur d en face', () => {
    const now = ref(START)
    const { speaker, place, advance } = play(PAIR, now)

    advance()
    advance()

    expect(speaker.value).toEqual(EOWYN)
    expect(place.value).toBe('right')
  })

  it('remet le défilé à zéro d une réplique à l autre', () => {
    // Sans ça, le temps déjà écoulé sur la précédente ferait sortir la suivante
    // déjà entamée — ou entière.
    const now = ref(START)
    const { shown, advance } = play(PAIR, now)

    now.value = START + 450
    advance()

    expect(shown.value).toBe('')
  })

  it('pose l espace insécable avant la ponctuation double', () => {
    const now = ref(START)
    const { shown, advance } = play(PAIR, now)

    advance()
    advance()
    advance()

    expect(shown.value).toBe('Tu m\'attendais ?')
  })

  it('rend la main après la dernière réplique, et pas avant', () => {
    // Deux répliques, donc quatre gestes : révéler, passer, révéler, rendre la
    // main. Aucun raccourci — une réplique ne se saute pas à moitié lue.
    const now = ref(START)
    const { ended, advance } = play(SOLO, now)

    advance()
    advance()
    advance()
    expect(ended).toHaveLength(0)

    advance()
    expect(ended).toHaveLength(1)
  })

  it('suit le rythme que le dialogue demande', () => {
    // SOLO parle à 60 ms le caractère, deux fois le rythme du jeu.
    const now = ref(START)
    const { shown } = play(SOLO, now)

    now.value = START + 120
    expect(shown.value).toBe('Pe')
  })
})
