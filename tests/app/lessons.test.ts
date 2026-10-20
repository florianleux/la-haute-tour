import { describe, expect, it } from 'vitest'
import { advancesOnBubble, campLesson, fallLesson, lessonDims, practiceLesson, practiceVerdictLesson, recoveryLesson, lessonStart, locksOverlay, replayedLesson, spotlightOn } from '../../utils/lessons'

// Voir specs/ecrans.md#leçons-de-michel (Chute).
describe('la leçon de la chute', () => {
  const lines = fallLesson()

  it('s ouvre sur la même entrée que la leçon du camp : la pause, puis « HÉ ! »', () => {
    expect(lines.slice(0, 2)).toEqual(campLesson({ team: null }).slice(0, 2))
  })

  it('montre la bannière du poster, puis le parchemin, dans cet ordre', () => {
    const shown = lines.map(line => line.spotlight).filter(spot => spot && spot !== 'michel')

    expect([...new Set(shown)]).toEqual(['posterBanner', 'scroll'])
  })

  it('fait ouvrir le Volumen, y parle, puis le fait refermer', () => {
    const scroll = lines.findIndex(line => line.spotlight === 'scroll')

    expect(lines.slice(scroll).map(line => [line.overlay, line.awaits]).slice(0, 3)).toEqual([
      [undefined, 'click'],
      ['questionLog', undefined],
      ['questionLog', 'close'],
    ])
  })

  it('finit sur un au revoir jusqu à la fin de l attente, qui avance au clic', () => {
    expect(lines.at(-1)).toMatchObject({ text: 'On se voit une fois ton attente finie pour la suite !' })
    expect(lines.at(-1)?.awaits).toBeUndefined()
  })
})

// Voir specs/ecrans.md#leçons-de-michel (Rattrapage).
describe('la leçon du rattrapage', () => {
  it('s ouvre sur la même entrée que les autres leçons', () => {
    expect(recoveryLesson({ total: 6, required: 1 }).slice(0, 2)).toEqual(fallLesson().slice(0, 2))
  })

  it('annonce les chiffres du rattrapage qu on lui donne', () => {
    expect(recoveryLesson({ total: 3, required: 1 }).map(line => line.text))
      .toContain('Trois questions que tu as ratées précédemment te seront présentées, donne une bonne réponse pour reprendre ton ascension !')
    expect(recoveryLesson({ total: 6, required: 6 }).map(line => line.text))
      .toContain('Six questions que tu as ratées précédemment te seront présentées, donne six bonnes réponses pour reprendre ton ascension !')
  })

  it('n attend aucun geste : « Commencer » n apparaît qu après elle', () => {
    expect(recoveryLesson({ total: 3, required: 1 }).every(line => !line.awaits || line.awaits === 'pause')).toBe(true)
  })
})

describe('la leçon du camp', () => {
  it('montre Michel, le sac, la bannière puis la corde, dans cet ordre', () => {
    const shown = campLesson({ team: 'MIDI' }).map(line => line.spotlight).filter(Boolean)

    expect([...new Set(shown)]).toEqual(['michel', 'backpack', 'banner', 'rope'])
  })

  // Sans équipe, pas de bannière au camp. Voir specs/ecrans.md#leçons-de-michel.
  it('saute la bannière et les Haut-faits pour un joueur sans équipe', () => {
    const lines = campLesson({ team: null })

    expect(lines.some(line => line.spotlight === 'banner' || line.overlay === 'achievements')).toBe(false)
  })

  it('nomme la guilde du joueur', () => {
    expect(campLesson({ team: 'MIDI' }).some(line => line.text.includes('Méridiens'))).toBe(true)
    expect(campLesson({ team: 'TLM' }).some(line => line.text.includes('Fauteuillistes'))).toBe(true)
  })

  // Michel se fait attendre, puis s'annonce : on l'entend avant de le voir.
  it('attend, puis montre la bulle seule avant Michel', () => {
    const [pause, call, arrival] = campLesson({ team: 'MIDI' })

    expect(pause.awaits).toBe('pause')
    expect(call.bubbleOnly).toBe(true)
    expect(arrival.bubbleOnly).toBeUndefined()
  })

  it('explique l Inventaire avant de demander le Fromage', () => {
    const inside = campLesson({ team: 'MIDI' }).filter(line => line.overlay === 'inventory')

    expect(inside.map(line => line.awaits)).toEqual([undefined, 'use'])
  })

  it('attend que le joueur ouvre le sac, donne le Fromage, puis clique la corde', () => {
    const awaited = campLesson({ team: 'MIDI' }).filter(line => line.awaits)

    expect(awaited.map(line => [line.spotlight, line.awaits])).toEqual([
      [null, 'pause'],
      ['backpack', 'click'],
      [null, 'use'],
      ['banner', 'click'],
      [null, 'close'],
      ['rope', 'click'],
      ['michel', 'ascent'],
    ])
  })

  // Au clic sur la corde, Michel dit au revoir ; « Suivant » lance l'ascension.
  it('finit sur un au revoir après la corde', () => {
    const lines = campLesson({ team: 'MIDI' })

    expect(lines.at(-2)).toMatchObject({ spotlight: 'rope', awaits: 'click' })
    expect(lines.at(-1)).toMatchObject({ awaits: 'ascent' })
  })
})

// Recharger en pleine leçon la reprend sans redonner ni perdre le Fromage.
describe('la reprise de la leçon du camp', () => {
  const lines = campLesson({ team: 'MIDI' })

  it('reprend au début tant que le Fromage est dans le sac', () => {
    expect(lessonStart(lines, true)).toBe(0)
  })

  it('reprend juste après le don, le Fromage donné', () => {
    const start = lessonStart(lines, false)

    expect(lines[start - 1].awaits).toBe('use')
  })
})

// Rejouée, la leçon ne fait rien faire : rien ne s'ouvre, rien ne se donne.
describe('une leçon rejouée', () => {
  it('avance au clic à chaque réplique, sur le camp', () => {
    expect(replayedLesson(campLesson({ team: 'MIDI' })).every(line => !line.awaits && !line.overlay)).toBe(true)
  })

  it('garde ses répliques et ce qu elle éclaire, sans l attente', () => {
    const lines = campLesson({ team: 'MIDI' })
    const spoken = lines.filter(line => line.awaits !== 'pause')

    expect(replayedLesson(lines).map(line => [line.text, line.spotlight])).toEqual(spoken.map(line => [line.text, line.spotlight]))
  })
})

// Pendant la leçon, le camp reste dans l'ombre ; ce dont Michel parle
// s'éclaire, et ce qu'il demande d'ouvrir pulse et se clique, seul.
// Voir specs/spec.md (glossaire, « Éclairage »).
describe('l éclairage', () => {
  it('ne change rien hors leçon', () => {
    expect(spotlightOn(null, 'banner')).toEqual({ dimmed: false, clickable: true, pulses: false })
    expect(lessonDims(null)).toBe(false)
  })

  it('assombrit ce que la réplique ne montre pas, et le rend inerte', () => {
    expect(spotlightOn({ text: '', spotlight: 'backpack', awaits: 'click' }, 'banner')).toEqual({ dimmed: true, clickable: false, pulses: false })
  })

  it('fait pulser et cliquer ce que Michel demande d ouvrir', () => {
    expect(spotlightOn({ text: '', spotlight: 'backpack', awaits: 'click' }, 'backpack')).toEqual({ dimmed: false, clickable: true, pulses: true })
  })

  it('éclaire sans laisser cliquer ce que Michel montre seulement', () => {
    expect(spotlightOn({ text: '', spotlight: 'banner' }, 'banner')).toEqual({ dimmed: false, clickable: false, pulses: false })
  })

  it('laisse tout dans l ombre quand la réplique n éclaire rien', () => {
    expect(spotlightOn({ text: '', spotlight: null }, 'rope')).toEqual({ dimmed: true, clickable: false, pulses: false })
    expect(lessonDims({ text: '', spotlight: null })).toBe(true)
  })

  // Avant le cri de Michel, le camp se voit encore, mais ne répond plus.
  it('n assombrit rien pendant l attente, sans rien laisser cliquer', () => {
    const pause = { text: '', spotlight: null, awaits: 'pause' } as const

    expect(spotlightOn(pause, 'rope')).toEqual({ dimmed: false, clickable: false, pulses: false })
    expect(lessonDims(pause)).toBe(false)
  })
})

describe('ce que la réplique attend', () => {
  it('fait avancer la bulle quand elle n attend rien, ou l ascension', () => {
    expect(advancesOnBubble({ text: '', spotlight: null })).toBe(true)
    expect(advancesOnBubble({ text: '', spotlight: 'michel', awaits: 'ascent' })).toBe(true)
    expect(advancesOnBubble({ text: '', spotlight: 'rope', awaits: 'click' })).toBe(false)
  })

  // Une leçon ne se passe pas : la boîte d'où Michel parle ne se referme que
  // quand il le demande.
  it('verrouille la boîte d où Michel parle, sauf quand il demande de la refermer', () => {
    expect(locksOverlay(undefined)).toBe(false)
    expect(locksOverlay({ text: '', spotlight: null, overlay: 'inventory', awaits: 'use' })).toBe(true)
    expect(locksOverlay({ text: '', spotlight: null, overlay: 'achievements', awaits: 'close' })).toBe(false)
  })
})

// Voir specs/ecrans.md#leçons-de-michel (Camp, 5 et 6).
describe('la question d essai', () => {
  it('montre les rubans puis le chrono, chaque bulle avançant au clic', () => {
    const lines = practiceLesson()
    const shown = lines.map(line => line.spotlight).filter(Boolean)

    expect([...new Set(shown)]).toEqual(['ribbons', 'timer'])
    expect(lines.every(line => !line.awaits)).toBe(true)
  })

  it('montre « Contester » sur un verdict faux, puis ce qu une erreur coûte', () => {
    const shown = practiceVerdictLesson({ correct: false }).map(line => line.spotlight).filter(Boolean)

    expect([...new Set(shown)]).toEqual(['dispute', 'ribbons'])
  })

  it('ne montre pas « Contester » sur un verdict juste', () => {
    const shown = practiceVerdictLesson({ correct: true }).map(line => line.spotlight)

    expect(shown).not.toContain('dispute')
    expect(shown).toContain('ribbons')
  })

  it('avance au clic jusqu au bout du verdict : « Suivant » vient après', () => {
    expect(practiceVerdictLesson({ correct: false }).every(advancesOnBubble)).toBe(true)
  })
})

describe('l éclairage de l écran de question', () => {
  it('éclaire la cible que la réplique montre, et assombrit les autres', () => {
    expect(spotlightOn({ text: '', spotlight: 'timer' }, 'timer').dimmed).toBe(false)
    expect(spotlightOn({ text: '', spotlight: 'timer' }, 'ribbons').dimmed).toBe(true)
  })

  it('n assombrit rien quand Michel s est tu', () => {
    expect(spotlightOn(null, 'ribbons').dimmed).toBe(false)
  })
})
