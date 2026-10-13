import { isAnswering, isAtCamp } from './phase'
import type { GameState } from '~~/server/utils/game'

/**
 * Ce que devient une icône de la barre : un lien vers une page atteignable, la
 * mise en avant de la page qu'on regarde — inerte, on ne clique pas vers là où
 * on est déjà —, ou une icône éteinte quand on ne peut pas y aller maintenant.
 * Voir specs/ecrans.md#principes.
 */
export type NavIconState = 'link' | 'active' | 'disabled'

export type NavIconKey = 'tower' | 'wand' | 'trophy' | 'profile' | 'admin'

export interface NavIcon {
  key: NavIconKey
  to: string
  /** Ce que lit une synthèse vocale : une icône seule ne dit rien d'elle-même. */
  label: string
  state: NavIconState
}

export interface NavContext {
  /** La route affichée. */
  path: string
  isAdmin: boolean
  /** L'état de jeu tel qu'il est en cache, null tant qu'il n'a pas été lu. */
  game: GameState | null
}

interface NavEntry {
  key: NavIconKey
  to: string
  label: string
  /** Réservée à l'administration : les autres ne la voient pas du tout. */
  adminOnly?: boolean
}

const ENTRIES: NavEntry[] = [
  { key: 'tower', to: '/', label: 'Le jeu' },
  { key: 'wand', to: '/sorts', label: 'Grimoire' },
  { key: 'trophy', to: '/succes', label: 'Haut-faits' },
  { key: 'profile', to: '/profil', label: 'Mon profil' },
  { key: 'admin', to: '/admin', label: 'Administration', adminOnly: true },
]

/**
 * La barre permanente, une icône à la fois. Elle ne disparaît jamais : ce sont
 * ses liens qui s'éteignent.
 *
 * Deux extinctions, et deux seulement. Tant qu'un chrono tourne, tout s'éteint —
 * en ascension comme en rattrapage, suivre un lien soumettrait la réponse en
 * l'état, donc le lien éteint retire un piège plutôt qu'il n'enferme. Et la
 * baguette s'éteint hors du camp, le seul moment où le lancer existe.
 *
 * La question ne compte que sur la page de jeu : l'état reste en cache après
 * qu'on l'a quittée, et une question laissée en cours éteindrait sinon la barre
 * du profil, où plus rien ne ramènerait au jeu.
 * Voir specs/ecrans.md#principes.
 */
export function navIcons({ path, isAdmin, game }: NavContext): NavIcon[] {
  const answering = path === '/' && isAnswering(game)
  const spellsOpen = isAtCamp(game)

  return ENTRIES
    .filter(entry => !entry.adminOnly || isAdmin)
    .map(({ key, to, label }) => {
      const reachable = !answering && (key !== 'wand' || spellsOpen)

      return {
        key,
        to,
        label,
        state: !reachable ? 'disabled' : path === to ? 'active' : 'link',
      }
    })
}
