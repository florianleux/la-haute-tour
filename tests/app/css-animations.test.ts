import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../assets/css/main.css', import.meta.url), 'utf8')

function duplicates(names: string[]): string[] {
  return names.filter((name, index) => names.indexOf(name) !== index)
}

// Deux @keyframes du même nom ne se signalent nulle part : la dernière gagne en
// silence, et c'est l'écran qui le montre — le toast des succès a déjà fait
// s'envoler les rubans d'étage en reprenant `ribbon-out`.
describe('les animations de main.css', () => {
  it('ont chacune un nom à elles', () => {
    const keyframes = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]!)

    expect(duplicates(keyframes)).toEqual([])
  })

  it('ont chacune une seule utilité animate-*', () => {
    const utilities = [...css.matchAll(/--animate-([\w-]+)\s*:/g)].map(match => match[1]!)

    expect(duplicates(utilities)).toEqual([])
  })
})
